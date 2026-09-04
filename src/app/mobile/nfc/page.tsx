import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Quét NFC – NVQS",
};

export default function LegacyMobileNfcPage() {
  redirect("/mobile/connect");
}
