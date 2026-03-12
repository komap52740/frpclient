import { Box, Container } from "@mui/material";
import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import AppBottomNav from "../../components/ui/AppBottomNav";
import AppFab from "../../components/ui/AppFab";
import PageMotion from "../../components/ui/PageMotion";
import { useAuth } from "../../features/auth/hooks/useAuth";
import {
  buildB2BPanel,
  buildMenu,
  buildWholesaleBadge,
  getRoleLabel,
  hasWholesalePortalAccess,
  resolveQuickAction,
  resolveRouteContext,
} from "./layoutConfig";
import ShellDrawer from "./ShellDrawer";
import ShellTopBar from "./ShellTopBar";

export default function AppShell({ children, role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const effectiveRole = role || user?.role;
  const roleLabel = useMemo(() => getRoleLabel(effectiveRole), [effectiveRole]);
  const wholesaleBadge = useMemo(() => buildWholesaleBadge(user), [user]);
  const b2bPanel = useMemo(() => buildB2BPanel(user), [user]);
  const showB2BNav = useMemo(() => hasWholesalePortalAccess(user), [user]);
  const route = useMemo(
    () => resolveRouteContext(effectiveRole, location.pathname),
    [effectiveRole, location.pathname]
  );
  const quickAction = useMemo(
    () => resolveQuickAction(effectiveRole, location.pathname, user),
    [effectiveRole, location.pathname, user]
  );
  const menuItems = useMemo(() => buildMenu(effectiveRole, user), [effectiveRole, user]);

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={{ minHeight: "100vh", width: "100%", overflowX: "clip" }}>
      <ShellTopBar
        route={route}
        quickAction={quickAction}
        roleLabel={roleLabel}
        wholesaleBadge={wholesaleBadge}
        onOpenDrawer={() => setDrawerOpen(true)}
        onLogout={onLogout}
      />

      <ShellDrawer
        drawerOpen={drawerOpen}
        menuItems={menuItems}
        onClose={() => setDrawerOpen(false)}
        onLogout={onLogout}
        roleLabel={roleLabel}
        user={user}
        wholesaleBadge={wholesaleBadge}
        b2bPanel={b2bPanel}
      />

      <Container
        maxWidth="lg"
        sx={{
          py: { xs: 1.4, md: 2.8 },
          pb: { xs: 12, md: 3 },
          px: { xs: 1.1, sm: 1.8, md: 2.2 },
          width: "100%",
          overflowX: "clip",
        }}
      >
        <PageMotion>{children}</PageMotion>
      </Container>

      <AppFab role={effectiveRole} />
      <AppBottomNav role={effectiveRole} showB2BNav={showB2BNav} />
    </Box>
  );
}
