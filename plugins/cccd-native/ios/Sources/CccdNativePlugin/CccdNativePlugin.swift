import Foundation
import Capacitor

@objc(CccdNativePlugin)
public class CccdNativePlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "CccdNativePlugin"
  public let jsName = "CccdNative"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "scanNfc", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "captureIdCard", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "ocrIdCard", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "clearTempImages", returnType: CAPPluginReturnPromise)
  ]

  private let nfc = CccdNfcReader()
  private let ocr = CccdOcr()
  private let capture = CccdCapture()

  @objc func scanNfc(_ call: CAPPluginCall) {
    let can = call.getString("can")
    let mrz = call.getString("mrz")
    DispatchQueue.main.async {
      self.nfc.scan(can: can, mrz: mrz) { result in
        call.resolve(result)
      }
    }
  }

  @objc func captureIdCard(_ call: CAPPluginCall) {
    let side = call.getString("side") ?? "front"
    DispatchQueue.main.async {
      self.capture.capture(side: side, from: self.bridge?.viewController) { result in
        call.resolve(result)
      }
    }
  }

  @objc func ocrIdCard(_ call: CAPPluginCall) {
    let image = call.getString("imageBase64") ?? ""
    let side = call.getString("side") ?? "front"
    DispatchQueue.global(qos: .userInitiated).async {
      let result = self.ocr.recognize(imageBase64: image, side: side)
      call.resolve(result)
    }
  }

  @objc func clearTempImages(_ call: CAPPluginCall) {
    CccdCapture.clearTemp()
    call.resolve(["ok": true])
  }
}
