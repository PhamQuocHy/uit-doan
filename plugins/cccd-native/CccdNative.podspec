Pod::Spec.new do |s|
  s.name = 'CccdNative'
  s.version = '0.1.0'
  s.summary = 'CCCD Core NFC / Vision / Camera'
  s.license = 'UNLICENSED'
  s.homepage = 'https://localhost'
  s.author = 'YMSA'
  s.source = { :git => 'https://localhost', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/CccdNativePlugin/**/*.{swift,h,m}'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.9'
  s.frameworks = 'CoreNFC', 'Vision', 'AVFoundation', 'UIKit', 'CryptoKit'
end
