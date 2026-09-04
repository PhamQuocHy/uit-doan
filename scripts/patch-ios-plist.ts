/**
 * After `npx cap add ios`, merge NFC/Camera Info.plist keys and copy entitlements.
 * Usage: npx tsx scripts/patch-ios-plist.ts
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const plistPath = path.join(root, "ios", "App", "App", "Info.plist");
const entitlementsSrc = path.join(root, "native", "ios", "App.entitlements");
const entitlementsDest = path.join(root, "ios", "App", "App", "App.entitlements");

if (!fs.existsSync(plistPath)) {
  console.error("ios/ project not found. On a Mac run: npx cap add ios");
  process.exit(1);
}

let plist = fs.readFileSync(plistPath, "utf8");
const additions: [string, string][] = [
  ["NFCReaderUsageDescription", "Ứng dụng đọc chip NFC trên CCCD để xác thực thông tin công dân."],
  ["NSCameraUsageDescription", "Ứng dụng chụp ảnh CCCD để nhận dạng OCR trên thiết bị."],
];

for (const [key, value] of additions) {
  if (!plist.includes(`<key>${key}</key>`)) {
    plist = plist.replace(
      "</dict>\n</plist>",
      `  <key>${key}</key>\n  <string>${value}</string>\n</dict>\n</plist>`,
    );
  }
}

if (!plist.includes("nfc.readersession.iso7816.select-identifiers")) {
  plist = plist.replace(
    "</dict>\n</plist>",
    `  <key>com.apple.developer.nfc.readersession.iso7816.select-identifiers</key>
  <array>
    <string>A0000002471001</string>
    <string>D2760000850101</string>
  </array>
  <key>com.apple.developer.nfc.readersession.formats</key>
  <array>
    <string>TAG</string>
  </array>
</dict>\n</plist>`,
  );
}

fs.writeFileSync(plistPath, plist);
fs.copyFileSync(entitlementsSrc, entitlementsDest);
console.log("Patched iOS Info.plist and entitlements.");
