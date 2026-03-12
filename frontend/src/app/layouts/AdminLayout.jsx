import AppShell from "./AppShell";

export default function AdminLayout({ children }) {
  return <AppShell role="admin">{children}</AppShell>;
}
