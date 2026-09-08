"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Route cũ — chuyển vào tab Giọng nói trên trang nhận diện */
export default function AIVoicePageRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/ai-face?tab=voice");
  }, [router]);
  return null;
}
