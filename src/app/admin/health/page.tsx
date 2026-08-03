import { redirect } from "next/navigation";

export default function HealthRedirectPage() {
  redirect("/admin/citizens");
}
