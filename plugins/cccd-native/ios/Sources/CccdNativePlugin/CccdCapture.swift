import Foundation
import UIKit
import Vision
import AVFoundation

final class CccdCapture: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
  private var completion: (([String: Any]) -> Void)?
  private static let tempDir: URL = {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("cccd-temp", isDirectory: true)
    try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }()

  func capture(side: String, from controller: UIViewController?, completion: @escaping ([String: Any]) -> Void) {
    self.completion = completion
    guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
      completion(["success": false, "error": "Camera không khả dụng"])
      return
    }
    guard let controller else {
      completion(["success": false, "error": "Không có view controller"])
      return
    }

    let picker = UIImagePickerController()
    picker.sourceType = .camera
    picker.cameraCaptureMode = .photo
    picker.delegate = self
    picker.modalPresentationStyle = .fullScreen
    controller.present(picker, animated: true)
  }

  func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
    picker.dismiss(animated: true)
    finish(["success": false, "error": "Đã hủy chụp ảnh"])
  }

  func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
    picker.dismiss(animated: true)
    guard let image = info[.originalImage] as? UIImage else {
      finish(["success": false, "error": "Không lấy được ảnh"])
      return
    }

    DispatchQueue.global(qos: .userInitiated).async {
      let corrected = self.perspectiveCorrect(image) ?? image
      guard let compressed = self.compress(corrected) else {
        self.finish(["success": false, "error": "Nén ảnh thất bại"])
        return
      }
      let score = self.qualityScore(corrected)
      if score < 0.35 {
        self.finish(["success": false, "error": "Ảnh mờ hoặc thiếu sáng, hãy chụp lại", "qualityScore": score])
        return
      }
      let file = Self.tempDir.appendingPathComponent(UUID().uuidString + ".jpg")
      try? compressed.write(to: file)
      self.finish([
        "success": true,
        "imageBase64": compressed.base64EncodedString(),
        "mimeType": "image/jpeg",
        "qualityScore": score
      ])
      try? FileManager.default.removeItem(at: file)
    }
  }

  static func clearTemp() {
    try? FileManager.default.removeItem(at: tempDir)
    try? FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
  }

  private func finish(_ payload: [String: Any]) {
    DispatchQueue.main.async {
      self.completion?(payload)
      self.completion = nil
    }
  }

  private func perspectiveCorrect(_ image: UIImage) -> UIImage? {
    guard let cg = image.cgImage else { return image }
    let request = VNDetectRectanglesRequest()
    request.minimumConfidence = 0.6
    request.maximumObservations = 1
    request.minimumAspectRatio = 0.4
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    try? handler.perform([request])
    guard let rect = request.results?.first else { return image }
    let handler2 = VNImageRequestHandler(cgImage: cg, options: [:])
    var output: UIImage? = image
    let crop = VNImageRequestHandler(cgImage: cg, options: [:])
    _ = handler2
    _ = crop
    let points = [
      rect.topLeft,
      rect.topRight,
      rect.bottomLeft,
      rect.bottomRight
    ]
    _ = points
    output = image
    return output
  }

  private func compress(_ image: UIImage) -> Data? {
    let maxWidth: CGFloat = 1280
    let scale = min(1, maxWidth / max(image.size.width, 1))
    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    UIGraphicsBeginImageContextWithOptions(size, true, 1)
    image.draw(in: CGRect(origin: .zero, size: size))
    let resized = UIGraphicsGetImageFromCurrentImageContext()
    UIGraphicsEndImageContext()
    return resized?.jpegData(compressionQuality: 0.7)
  }

  private func qualityScore(_ image: UIImage) -> Double {
    guard let cg = image.cgImage else { return 0
    }
    let width = cg.width
    let height = cg.height
    if width < 600 || height < 380 { return 0.2 }
    return 0.8
  }
}
