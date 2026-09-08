import type { CapacitorConfig } from "@capacitor/cli";
import { config as loadEnv } from "dotenv";

loadEnv();

const serverUrl = process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_APP_URL;

const config: CapacitorConfig = {
  appId: "vn.ymsa.nhandangai",
  appName: "Nhận dạng AI",
  webDir: "native/www",
  server: {
    androidScheme: "https",
    iosScheme: "https",
    ...(serverUrl
      ? {
          url: serverUrl,
          cleartext: serverUrl.startsWith("http://"),
        }
      : {}),
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "Nhan Dang AI",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: "#3b491e",
      showSpinner: false,
      androidSplashResourceName: "splash",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
    },
  },
};

export default config;
