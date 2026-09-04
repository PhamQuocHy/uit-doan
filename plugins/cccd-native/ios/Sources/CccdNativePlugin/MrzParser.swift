import Foundation

struct ParsedCitizen {
  var fullName: String
  var personalId: String
  var dateOfBirth: String
  var gender: String
  var nationality: String
  var placeOfOrigin: String
  var placeOfResidence: String
  var documentNumber: String
  var mrz: String
}

enum MrzParser {
  static func parse(dg1: Data) -> ParsedCitizen? {
    guard let mrz = extractMrz(from: dg1) else { return nil }
    return parseMrz(mrz)
  }

  static func parseDg11(_ data: Data) -> (placeOfOrigin: String, placeOfResidence: String) {
    let text = String(data: data.filter { ($0 >= 32 && $0 < 127) || $0 >= 192 }, encoding: .utf8) ?? ""
    return (placeOfOrigin: text, placeOfResidence: "")
  }

  private static func extractMrz(from dg1: Data) -> String? {
    if let range = indexOfTag(0x5F1F, in: dg1) {
      let len = Int(dg1[range + 2])
      let start = range + 3
      if start + len <= dg1.count, let s = String(bytes: dg1[start..<(start + len)], encoding: .ascii) {
        return s
      }
    }
    return String(data: dg1.filter { $0 >= 32 && $0 < 127 }, encoding: .ascii)
  }

  private static func indexOfTag(_ tag: UInt16, in data: Data) -> Int? {
    let b1 = UInt8(tag >> 8)
    let b2 = UInt8(tag & 0xFF)
    if data.count < 2 { return nil }
    for i in 0..<(data.count - 1) {
      if data[i] == b1 && data[i + 1] == b2 { return i }
    }
    return nil
  }

  static func parseMrz(_ raw: String) -> ParsedCitizen? {
    let mrz = raw.replacingOccurrences(of: "\r", with: "").replacingOccurrences(of: "\n", with: "")
    if mrz.count >= 90 {
      return parseTd1(String(mrz.prefix(90)))
    }
    if mrz.count >= 88 {
      return parseTd3(String(mrz.prefix(88)))
    }
    return nil
  }

  private static func parseTd1(_ mrz: String) -> ParsedCitizen {
    let l1 = substring(mrz, 0, 30)
    let l2 = substring(mrz, 30, 30)
    let l3 = substring(mrz, 60, 30)
    let doc = substring(l1, 5, 9).replacingOccurrences(of: "<", with: "")
    let optional = substring(l1, 15, 15).replacingOccurrences(of: "<", with: "")
    let personalId = optional.isEmpty ? doc : optional
    let dob = formatDate(substring(l2, 0, 6))
    let sexChar = substring(l2, 7, 1)
    let nationality = substring(l2, 15, 3).replacingOccurrences(of: "<", with: "")
    let names = parseNames(l3)
    return ParsedCitizen(
      fullName: names,
      personalId: digits(personalId),
      dateOfBirth: dob,
      gender: sexChar == "F" ? "female" : "male",
      nationality: nationality == "VNM" ? "Việt Nam" : nationality,
      placeOfOrigin: "",
      placeOfResidence: "",
      documentNumber: doc,
      mrz: mrz
    )
  }

  private static func parseTd3(_ mrz: String) -> ParsedCitizen {
    let l1 = substring(mrz, 0, 44)
    let l2 = substring(mrz, 44, 44)
    let names = parseNames(String(l1.dropFirst(5)))
    let doc = substring(l2, 0, 9).replacingOccurrences(of: "<", with: "")
    let nationality = substring(l2, 10, 3)
    let dob = formatDate(substring(l2, 13, 6))
    let sexChar = substring(l2, 20, 1)
    let optional = substring(l2, 28, 14).replacingOccurrences(of: "<", with: "")
    return ParsedCitizen(
      fullName: names,
      personalId: digits(optional.isEmpty ? doc : optional),
      dateOfBirth: dob,
      gender: sexChar == "F" ? "female" : "male",
      nationality: nationality == "VNM" ? "Việt Nam" : nationality,
      placeOfOrigin: "",
      placeOfResidence: "",
      documentNumber: doc,
      mrz: mrz
    )
  }

  private static func parseNames(_ field: String) -> String {
    let parts = field.split(separator: "<", omittingEmptySubsequences: false).map(String.init)
    var surname: [String] = []
    var given: [String] = []
    var seenEmpty = false
    for part in parts {
      if part.isEmpty {
        seenEmpty = true
        continue
      }
      if seenEmpty { given.append(part) } else { surname.append(part) }
    }
    return (surname + given).joined(separator: " ")
  }

  private static func formatDate(_ yyMMdd: String) -> String {
    guard yyMMdd.count == 6 else { return yyMMdd }
    let yy = Int(substring(yyMMdd, 0, 2)) ?? 0
    let year = yy > 30 ? 1900 + yy : 2000 + yy
    return String(format: "%04d-%@-%@", year, substring(yyMMdd, 2, 2), substring(yyMMdd, 4, 2))
  }

  private static func digits(_ value: String) -> String {
    value.filter(\.isNumber)
  }

  private static func substring(_ s: String, _ start: Int, _ len: Int) -> String {
    guard s.count >= start + len else { return "" }
    let a = s.index(s.startIndex, offsetBy: start)
    let b = s.index(a, offsetBy: len)
    return String(s[a..<b])
  }
}
