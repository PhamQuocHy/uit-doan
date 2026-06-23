import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminLayoutClient from "@/components/admin/AdminLayoutClient";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <AdminLayoutClient
      userName={session.name}
      userRole={session.role}
      userHierarchyLevel={session.hierarchyLevel}
    >
      {children}
    </AdminLayoutClient>
  );
}
