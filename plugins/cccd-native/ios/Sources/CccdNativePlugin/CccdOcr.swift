import Foundation
import UIKit
import Vision

final class CccdOcr {
  func recognize(imageBase64: String, side: String) -> [String: Any] {
    guard let data = Data(base64Encoded: stripPrefix(imageBase64)),
          let image = UIImage(data: data),
          let cg = image.cgImage else {
      return ["success": false, "error": "Ảnh không hợp lệ"]
    }

    let processed = preprocess(cg)
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["vi-VN", "en-US"]

    let handler = VNImageRequestHandler(cgImage: processed, options: [:])
    do {
      try handler.perform([request])
    } catch {
      return ["success": false, "error": error.localizedDescription]
    }

    let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
    let raw = lines.joined(separator: "\n")
    let parsed = extractFields(lines: lines, side: side, raw: raw)
    return [
      "success": true,
      "data": parsed
    ]
  }

  private func stripPrefix(_ value: String) -> String {
    if let range = value.range(of: "base64,") {
      return String(value[range.upperBound...])
    }
    return value
  }

  private func preprocess(_ image: CGImage) -> CGImage {
    image
  }

  private func extractFields(lines: [String], side: String, raw: String) -> [String: String] {
    let joined = lines.joined(separator: " ")
    let personalId = firstMatch(#"\b\d{12}\b"#, in: joined)
    let can = firstMatch(#"\b\d{6}\b"#, in: raw.uppercased().contains("CAN") ? raw : "")
    let dob = normalizeDate(firstMatch(#"\b\d{2}[/\.-]\d{2}[/\.-]\d{4}\b"#, in: joined))
    let gender: String
    if joined.uppercased().contains("NỮ") || joined.uppercased().contains("NU") || joined.uppercased().contains("FEMALE") {
      gender = "female"
    } else if joined.uppercased().contains("NAM") || joined.uppercased().contains("MALE") {
      gender = "male"
    } else {
      gender = ""
    }

    var fullName = ""
    if let idx = lines.firstIndex(where: { $0.uppercased().contains("HỌ VÀ TÊN") || $0.uppercased().contains("HO VA TEN") || $0.uppercased().contains("FULL NAME") }) {
      if idx + 1 < lines.count { fullName = lines[idx + 1] }
    }
    if fullName.isEmpty {
      fullName = lines.first(where: { $0.split(separator: " ").count >= 2 && $0.rangeOfCharacter(from: .decimalDigits) == nil }) ?? ""
    }

    var origin = ""
    var residence = ""
    if let idx = lines.firstIndex(where: { $0.uppercased().contains("QUÊ QUÁN") || $0.uppercased().contains("PLACE OF ORIGIN") }) {
      if idx + 1 < lines.count { origin = lines[idx + 1] }
    }
    if let idx = lines.firstIndex(where: { $0.uppercased().contains("NƠI THƯỜNG TRÚ") || $0.uppercased().contains("RESIDENCE") }) {
      if idx + 1 < lines.count { residence = lines[idx + 1] }
    }

    let mrz = lines.filter { $0.contains("<") && $0.count >= 20 }.joined()

    return [
      "fullName": fullName.trimmingCharacters(in: .whitespacesAndNewlines),
      "personalId": personalId,
      "dateOfBirth": dob,
      "gender": gender,
      "nationality": joined.uppercased().contains("VIỆT") || joined.uppercased().contains("VIET") ? "Việt Nam" : "",
      "placeOfOrigin": origin,
      "placeOfResidence": residence,
      "can": can,
      "mrz": mrz,
      "rawText": side == "back" || side == "front" ? String(raw.prefix(400)) : ""
    ]
  }

  private func firstMatch(_ pattern: String, in text: String) -> String {
    guard let regex = try? NSRegularExpression(pattern: pattern) else { return "" }
    let range = NSRange(text.startIndex..., in: text)
    guard let match = regex.firstMatch(in: text, range: range),
          let swiftRange = Range(match.range, in: text) else { return "" }
    return String(text[swiftRange])
  }

  private func normalizeDate(_ value: String) -> String {
    let digits = value.filter(\.isNumber)
    guard digits.count == 8 else { return value }
    return "\(digits.suffix(4))-\(digits.dropLast(4).suffix(2))-\(digits.prefix(2))"
  }
}
