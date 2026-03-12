import AdminLayout from "../app/layouts/AdminLayout";
import AppShell from "../app/layouts/AppShell";
import ClientLayout from "../app/layouts/ClientLayout";
import MasterLayout from "../app/layouts/MasterLayout";
import { useAuth } from "../features/auth/hooks/useAuth";

export default function MainLayout({ children }) {
  const { user } = useAuth();

  if (user?.role === "client") {
    return <ClientLayout>{children}</ClientLayout>;
  }
  if (user?.role === "master") {
    return <MasterLayout>{children}</MasterLayout>;
  }
  if (user?.role === "admin") {
    return <AdminLayout>{children}</AdminLayout>;
  }
  return <AppShell>{children}</AppShell>;
}
