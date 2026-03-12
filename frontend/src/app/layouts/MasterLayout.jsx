import AppShell from "./AppShell";

export default function MasterLayout({ children }) {
  return <AppShell role="master">{children}</AppShell>;
}
