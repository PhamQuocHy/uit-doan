import Foundation
import CoreNFC

/// Reads Vietnamese CCCD (eID) over Core NFC / ISO 7816.
/// UID-only reads are intentionally insufficient: chip data is protected by PACE (CAN) or BAC (MRZ).
final class CccdNfcReader: NSObject, NFCTagReaderSessionDelegate {
  private var session: NFCTagReaderSession?
  private var completion: (([String: Any]) -> Void)?
  private var can: String?
  private var mrz: String?
  private var finished = false

  func scan(can: String?, mrz: String?, completion: @escaping ([String: Any]) -> Void) {
    self.can = can
    self.mrz = mrz
    self.completion = completion
    self.finished = false

    guard NFCTagReaderSession.readingAvailable else {
      completion(Self.fail("Thiết bị không hỗ trợ Core NFC", code: "PERMISSION", chip: false))
      return
    }

    session = NFCTagReaderSession(pollingOption: [.iso14443], delegate: self, queue: nil)
    session?.alertMessage = "Đưa CCCD gắn chip lại gần mặt lưng iPhone"
    session?.begin()
  }

  func tagReaderSessionDidBecomeActive(_ session: NFCTagReaderSession) {}

  func tagReaderSession(_ session: NFCTagReaderSession, didInvalidateWithError error: Error) {
    let ns = error as NSError
    if finished { return }
    if ns.code == 200 { // user cancel
      finish(Self.fail("Đã hủy quét NFC", code: "USER_CANCELLED", chip: false))
      return
    }
    finish(Self.fail(error.localizedDescription, code: "READ_FAILED", chip: false))
  }

  func tagReaderSession(_ session: NFCTagReaderSession, didDetect tags: [NFCTag]) {
    guard let tag = tags.first else { return }
    session.connect(to: tag) { error in
      if let error {
        session.invalidate(errorMessage: error.localizedDescription)
        self.finish(Self.fail(error.localizedDescription, code: "READ_FAILED", chip: true))
        return
      }
      guard case let .iso7816(iso) = tag else {
        session.invalidate(errorMessage: "Thẻ không phải CCCD ISO 7816")
        self.finish(Self.fail("Thẻ không phải CCCD chip (ISO 7816)", code: "TAG_NOT_CCCD", chip: true))
        return
      }
      Task {
        await self.handleISO7816(iso, session: session)
      }
    }
  }

  private func handleISO7816(_ tag: NFCISO7816Tag, session: NFCTagReaderSession) async {
    let access = EmrtdAccess(tag: tag)
    do {
      try await access.selectEmrtdApplication()
      let cardAccess = try await access.readCardAccess()
      let usesPace = cardAccess.containsPace

      if usesPace && (can == nil || can?.count != 6) {
        session.invalidate(errorMessage: "Cần mã CAN 6 số trên mặt sau CCCD")
        finish(Self.fail("Chip CCCD yêu cầu PACE với CAN", code: "NEED_CAN", chip: true))
        return
      }

      if !usesPace && (mrz == nil || (mrz?.count ?? 0) < 24) {
        session.invalidate(errorMessage: "Cần MRZ từ mặt sau CCCD")
        finish(Self.fail("Chip yêu cầu BAC từ MRZ", code: "NEED_MRZ", chip: true))
        return
      }

      if usesPace {
        try await access.performPace(can: can ?? "")
      } else if let mrz {
        try await access.performBac(mrz: mrz)
      }

      let dg1 = try await access.readFile(fid: [0x01, 0x01])
      guard let parsed = MrzParser.parse(dg1: dg1) else {
        session.invalidate(errorMessage: "Không phân tích được DG1")
        finish(Self.fail("Đọc chip thành công nhưng không parse được DG1", code: "READ_FAILED", chip: true))
        return
      }

      var data: [String: Any] = [
        "fullName": parsed.fullName,
        "personalId": parsed.personalId,
        "dateOfBirth": parsed.dateOfBirth,
        "gender": parsed.gender,
        "nationality": parsed.nationality,
        "placeOfOrigin": parsed.placeOfOrigin,
        "placeOfResidence": parsed.placeOfResidence,
        "documentNumber": parsed.documentNumber,
        "mrz": parsed.mrz
      ]

      if let dg11 = try? await access.readFile(fid: [0x01, 0x0B]) {
        let extra = MrzParser.parseDg11(dg11)
        if !extra.placeOfOrigin.isEmpty { data["placeOfOrigin"] = extra.placeOfOrigin }
        if !extra.placeOfResidence.isEmpty { data["placeOfResidence"] = extra.placeOfResidence }
      }

      session.alertMessage = "Đã đọc chip CCCD"
      session.invalidate()
      finish([
        "success": true,
        "data": data,
        "chipDetected": true
      ])
    } catch let error as EmrtdError {
      session.invalidate(errorMessage: error.message)
      finish(Self.fail(error.message, code: error.code, chip: true))
    } catch {
      session.invalidate(errorMessage: error.localizedDescription)
      finish(Self.fail(error.localizedDescription, code: "READ_FAILED", chip: true))
    }
  }

  private func finish(_ payload: [String: Any]) {
    guard !finished else { return }
    finished = true
    completion?(payload)
    completion = nil
  }

  private static func fail(_ message: String, code: String, chip: Bool) -> [String: Any] {
    [
      "success": false,
      "error": message,
      "errorCode": code,
      "chipDetected": chip
    ]
  }
}
