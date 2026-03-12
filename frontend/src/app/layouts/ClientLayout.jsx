import AppShell from "./AppShell";

export default function ClientLayout({ children }) {
  return <AppShell role="client">{children}</AppShell>;
}
