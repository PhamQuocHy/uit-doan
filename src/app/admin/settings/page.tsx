import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import SettingsClient from "@/components/admin/SettingsClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <SettingsClient userName={session.name} />;
}
