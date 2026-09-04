import Foundation
import CoreNFC
import CryptoKit

struct EmrtdError: Error {
  let message: String
  let code: String
}

/// ISO 7816 APDU access for ICAO 9303 eMRTD / Vietnamese CCCD.
/// Personal data is never available from UID; BAC/PACE + secure messaging are required.
final class EmrtdAccess {
  private let tag: NFCISO7816Tag
  private var ksEnc: Data?
  private var ksMac: Data?
  private var ssc: UInt64 = 0

  init(tag: NFCISO7816Tag) {
    self.tag = tag
  }

  func selectEmrtdApplication() async throws {
    let aid = Data([0xA0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01])
    let response = try await transmit(Data([0x00, 0xA4, 0x04, 0x0C, UInt8(aid.count)]) + aid)
    try throwIfFailed(response, fallback: "Không chọn được ứng dụng CCCD/eMRTD")
  }

  func readCardAccess() async throws -> CardAccessInfo {
    // EF.CardAccess is in MF, FID 011C, readable without authentication.
    _ = try? await transmit(Data([0x00, 0xA4, 0x00, 0x0C, 0x00]))
    let select = try await transmit(Data([0x00, 0xA4, 0x02, 0x0C, 0x02, 0x01, 0x1C]))
    if statusWord(select) != 0x9000 {
      return CardAccessInfo(raw: Data(), containsPace: false)
    }
    let body = try await readBinary()
    let containsPace = body.contains(Data([0x04, 0x00, 0x7F, 0x00, 0x07, 0x02, 0x02, 0x04]))
      || body.map { String(format: "%02X", $0) }.joined().contains("04007F0007020204")
    return CardAccessInfo(raw: body, containsPace: containsPace || body.count > 0)
  }

  func performPace(can: String) async throws {
    guard can.count == 6, can.allSatisfy({ $0.isNumber }) else {
      throw EmrtdError(message: "CAN phải gồm 6 chữ số", code: "NEED_CAN")
    }
    // Full PACE (ECDH GM + AES-CMAC + secure messaging) depends on the curve in EF.CardAccess.
    // Vietnamese CCCD commonly uses brainpoolP256r1, which CryptoKit does not implement.
    // We still establish a Core NFC ISO7816 session and refuse silently faking DG1.
    do {
      try await PaceEngine.run(access: self, can: can)
    } catch {
      throw EmrtdError(
        message: "PACE thất bại. Kiểm tra CAN, hoặc bổ sung brainpoolP256r1 (OpenSSL) nếu chip không dùng secp256r1.",
        code: "PACE_FAILED"
      )
    }
  }

  func performBac(mrz: String) async throws {
    let keySeed = BacKeys.keySeed(from: mrz)
    guard let keys = BacKeys.derive(from: keySeed) else {
      throw EmrtdError(message: "Không tạo được khóa BAC từ MRZ", code: "BAC_FAILED")
    }
    let challenge = try await transmit(Data([0x00, 0x84, 0x00, 0x00, 0x08]))
    guard challenge.count >= 10 else {
      throw EmrtdError(message: "GET CHALLENGE thất bại", code: "BAC_FAILED")
    }
    let rndIcc = challenge.dropLast(2)
    var rndIfd = Data(count: 8)
    rndIfd.withUnsafeMutableBytes { _ = SecRandomCopyBytes(kSecRandomDefault, 8, $0.baseAddress!) }
    var kIfd = Data(count: 16)
    kIfd.withUnsafeMutableBytes { _ = SecRandomCopyBytes(kSecRandomDefault, 16, $0.baseAddress!) }

    let s = rndIfd + rndIcc + kIfd
    let eifd = try BacKeys.tripleDesEncrypt(s, key: keys.kEnc)
    let mac = BacKeys.retailMac(eifd, key: keys.kMac)
    let cmdData = eifd + mac
    let auth = try await transmit(Data([0x00, 0x82, 0x00, 0x00, UInt8(cmdData.count)]) + cmdData + Data([0x28]))
    try throwIfFailed(auth, fallback: "Mutual authenticate BAC thất bại", code: "BAC_FAILED")
    let payload = auth.dropLast(2)
    guard payload.count >= 40 else {
      throw EmrtdError(message: "Phản hồi BAC không hợp lệ", code: "BAC_FAILED")
    }
    let eicc = payload.prefix(32)
    let decrypted = try BacKeys.tripleDesDecrypt(eicc, key: keys.kEnc)
    let kIcc = decrypted.suffix(16)
    var kSeed = Data()
    for i in 0..<16 {
      kSeed.append(kIfd[i] ^ kIcc[kIcc.startIndex + i])
    }
    ksEnc = BacKeys.deriveEnc(from: kSeed)
    ksMac = BacKeys.deriveMac(from: kSeed)
    ssc = 0
  }

  func readFile(fid: [UInt8]) async throws -> Data {
    let select = try await transmitProtected(Data([0x00, 0xA4, 0x02, 0x0C, 0x02]) + Data(fid))
    try throwIfFailed(select, fallback: "Không chọn được file chip")
    return try await readBinaryProtected()
  }

  func transmitPublic(_ apdu: Data) async throws -> Data {
    try await transmit(apdu)
  }

  private func readBinary() async throws -> Data {
    var offset = 0
    var out = Data()
    while true {
      let p1 = UInt8((offset >> 8) & 0x7F)
      let p2 = UInt8(offset & 0xFF)
      let chunk = try await transmit(Data([0x00, 0xB0, p1, p2, 0xE0]))
      let sw = statusWord(chunk)
      if sw == 0x6A82 || sw == 0x6B00 { break }
      let body = chunk.dropLast(2)
      out.append(body)
      if body.count < 0xE0 { break }
      offset += body.count
      if offset > 4096 { break }
    }
    return out
  }

  private func readBinaryProtected() async throws -> Data {
    if ksEnc == nil {
      return try await readBinary()
    }
    var offset = 0
    var out = Data()
    while true {
      let p1 = UInt8((offset >> 8) & 0x7F)
      let p2 = UInt8(offset & 0xFF)
      let chunk = try await transmitProtected(Data([0x00, 0xB0, p1, p2, 0xE0]))
      let sw = statusWord(chunk)
      if sw != 0x9000 { break }
      let body = chunk.dropLast(2)
      out.append(body)
      if body.count < 0xE0 { break }
      offset += body.count
      if offset > 4096 { break }
    }
    return out
  }

  private func transmit(_ apdu: Data) async throws -> Data {
    let command = NFCISO7816APDU(data: apdu)!
    return try await withCheckedThrowingContinuation { cont in
      tag.sendCommand(apdu: command) { data, sw1, sw2, error in
        if let error {
          cont.resume(throwing: error)
          return
        }
        var response = data
        response.append(sw1)
        response.append(sw2)
        cont.resume(returning: response)
      }
    }
  }

  private func transmitProtected(_ apdu: Data) async throws -> Data {
    guard ksEnc != nil, ksMac != nil else {
      return try await transmit(apdu)
    }
    // Secure Messaging after BAC/PACE is session-specific; without valid session keys
    // we fail instead of returning fabricated citizen data.
    throw EmrtdError(message: "Secure Messaging chưa thiết lập sau PACE/BAC", code: "PACE_FAILED")
  }

  private func throwIfFailed(_ response: Data, fallback: String, code: String = "READ_FAILED") throws {
    if statusWord(response) != 0x9000 && statusWord(response) != 0x6982 {
      let sw = String(format: "%04X", statusWord(response))
      throw EmrtdError(message: "\(fallback) (SW=\(sw))", code: code)
    }
  }

  private func statusWord(_ data: Data) -> UInt16 {
    guard data.count >= 2 else { return 0 }
    return UInt16(data[data.count - 2]) << 8 | UInt16(data[data.count - 1])
  }
}

struct CardAccessInfo {
  let raw: Data
  let containsPace: Bool
}

/// Placeholder PACE runner: performs MSE:Set AT so the chip is exercised via Core NFC.
/// A production build should complete ECDH mapping for the curve advertised in CardAccess.
enum PaceEngine {
  static func run(access: EmrtdAccess, can: String) async throws {
    // OID id-PACE-ECDH-GM-AES-CBC-CMAC-128 = 0.4.0.127.0.7.2.2.4.2.2
    let oid: [UInt8] = [0x04, 0x00, 0x7F, 0x00, 0x07, 0x02, 0x02, 0x04, 0x02, 0x02]
    var data = Data([0x80, UInt8(oid.count)]) + Data(oid)
    data.append(contentsOf: [0x83, 0x01, 0x02]) // key id: CAN
    let mse = Data([0x00, 0x22, 0xC1, 0xA4, UInt8(data.count)]) + data
    let response = try await access.transmitPublic(mse)
    let sw = response.suffix(2)
    if sw != Data([0x90, 0x00]) {
      throw EmrtdError(message: "MSE:Set AT (PACE) bị từ chối", code: "PACE_FAILED")
    }
    // Remaining GA steps require the exact domain parameters from EF.CardAccess.
    throw EmrtdError(message: "NEED_PACE_CRYPTO", code: "PACE_FAILED")
  }
}

enum BacKeys {
  static func keySeed(from mrz: String) -> Data {
    let compact = mrz.uppercased().replacingOccurrences(of: "\n", with: "").replacingOccurrences(of: " ", with: "")
    let info = String(compact.prefix(24))
    return Data(Insecure.SHA1.hash(data: Data(info.utf8)))
  }

  static func derive(from seed: Data) -> (kEnc: Data, kMac: Data)? {
    guard let enc = deriveEnc(from: seed), let mac = deriveMac(from: seed) else { return nil }
    return (enc, mac)
  }

  static func deriveEnc(from seed: Data) -> Data? {
    derive(seed: seed, counter: 1)
  }

  static func deriveMac(from seed: Data) -> Data? {
    derive(seed: seed, counter: 2)
  }

  private static func derive(seed: Data, counter: UInt8) -> Data? {
    var d = seed
    d.append(contentsOf: [0, 0, 0, counter])
    let hash = Data(Insecure.SHA1.hash(data: d))
    return Data(hash.prefix(16))
  }

  static func tripleDesEncrypt(_ data: Data, key: Data) throws -> Data {
    // Production BAC uses 3DES-CBC. Implemented via CommonCrypto would go here.
    throw EmrtdError(message: "3DES BAC helper chưa liên kết CommonCrypto trong plugin", code: "BAC_FAILED")
  }

  static func tripleDesDecrypt(_ data: Data, key: Data) throws -> Data {
    throw EmrtdError(message: "3DES BAC helper chưa liên kết CommonCrypto trong plugin", code: "BAC_FAILED")
  }

  static func retailMac(_ data: Data, key: Data) -> Data {
    Data(count: 8)
  }
}
