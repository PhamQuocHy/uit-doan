import { redirect } from "next/navigation";

export default function ResidenceRedirectPage() {
  redirect("/admin/citizens");
}
