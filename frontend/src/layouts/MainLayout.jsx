import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useMemo, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import AppBottomNav from "../components/ui/AppBottomNav";
import AppFab from "../components/ui/AppFab";
import NotificationBell from "../components/ui/NotificationBell";
import PageMotion from "../components/ui/PageMotion";
import { useThemeMode } from "../theme/ThemeModeContext";

function buildMenu(role) {
  if (role === "client") {
    return [
      { label: "Р“Р»Р°РІРЅР°СЏ", to: "/client/home" },
      { label: "РќРѕРІР°СЏ Р·Р°СЏРІРєР°", to: "/client/create" },
      { label: "РњРѕРё Р·Р°СЏРІРєРё", to: "/client/my" },
      { label: "РџСЂРѕС„РёР»СЊ", to: "/client/profile" },
    ];
  }

  if (role === "master") {
    return [
      { label: "РќРѕРІС‹Рµ Р·Р°СЏРІРєРё", to: "/master/new" },
      { label: "РђРєС‚РёРІРЅС‹Рµ", to: "/master/active" },
      { label: "Клиенты", to: "/master/clients" },
      { label: "Р‘С‹СЃС‚СЂС‹Рµ РѕС‚РІРµС‚С‹", to: "/master/quick-replies" },
      { label: "РћС‚Р·С‹РІС‹", to: "/master/reviews" },
      { label: "РџСЂРѕС„РёР»СЊ", to: "/master/profile" },
    ];
  }

  if (role === "admin") {
    return [
      { label: "РЎРёСЃС‚РµРјР°", to: "/admin/system" },
      { label: "РџСЂРѕС„РёР»СЊ", to: "/admin/profile" },
      { label: "Р—Р°СЏРІРєРё", to: "/admin/appointments" },
      { label: "РџСЂР°РІРёР»Р°", to: "/admin/rules" },
      { label: "РћС‚Р·С‹РІС‹", to: "/admin/reviews" },
      { label: "РџРѕР»СЊР·РѕРІР°С‚РµР»Рё", to: "/admin/users" },
      { label: "РљР»РёРµРЅС‚С‹", to: "/admin/clients" },
      { label: "РњР°СЃС‚РµСЂР°", to: "/admin/masters" },
    ];
  }

  return [];
}

function getRoleLabel(role) {
  if (role === "client") return "РљР»РёРµРЅС‚";
  if (role === "master") return "РњР°СЃС‚РµСЂ";
  if (role === "admin") return "РђРґРјРёРЅ";
  return "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ";
}

function buildWholesaleBadge(user) {
  if (!user || user.role !== "client") {
    return null;
  }

  const status = user.wholesale_status || "none";
  if (status === "approved") {
    return {
      label: "РћРїС‚РѕРІС‹Р№ СЃРµСЂРІРёСЃ",
      color: "success",
      variant: "filled",
    };
  }
  if (status === "pending") {
    return {
      label: "РћРїС‚: РЅР° РїСЂРѕРІРµСЂРєРµ",
      color: "warning",
      variant: "outlined",
    };
  }
  if (status === "rejected") {
    return {
      label: "РћРїС‚: РѕС‚РєР»РѕРЅРµРЅРѕ",
      color: "error",
      variant: "outlined",
    };
  }
  return null;
}

function resolveRouteContext(role, pathname) {
  if (pathname.startsWith("/appointments/")) {
    return {
      title: "РљР°СЂС‚РѕС‡РєР° Р·Р°СЏРІРєРё",
      subtitle: "РЎС‚Р°С‚СѓСЃ, С‡Р°С‚, РѕРїР»Р°С‚Р° Рё СЃРѕР±С‹С‚РёСЏ РІ РѕРґРЅРѕРј РѕРєРЅРµ",
    };
  }

  if (role === "client") {
    if (pathname.startsWith("/client/home")) return { title: "Р“Р»Р°РІРЅР°СЏ", subtitle: "Р‘С‹СЃС‚СЂС‹Рµ РґРµР№СЃС‚РІРёСЏ Рё Р°РєС‚СѓР°Р»СЊРЅС‹Рµ СЃС‚Р°С‚СѓСЃС‹" };
    if (pathname.startsWith("/client/create")) return { title: "РќРѕРІР°СЏ Р·Р°СЏРІРєР°", subtitle: "РњРёРЅРёРјСѓРј РїРѕР»РµР№, РјР°РєСЃРёРјСѓРј СЃРєРѕСЂРѕСЃС‚Рё" };
    if (pathname.startsWith("/client/my")) return { title: "РњРѕРё Р·Р°СЏРІРєРё", subtitle: "РљРѕРЅС‚СЂРѕР»СЊ Р·Р°РєР°Р·РѕРІ Р±РµР· Р»РёС€РЅРµРіРѕ С€СѓРјР°" };
    if (pathname.startsWith("/client/profile")) return { title: "РџСЂРѕС„РёР»СЊ", subtitle: "РќР°СЃС‚СЂРѕР№РєРё Р°РєРєР°СѓРЅС‚Р° Рё Р±РµР·РѕРїР°СЃРЅРѕСЃС‚СЊ" };
  }

  if (role === "master") {
    if (pathname.startsWith("/master/new")) return { title: "РќРѕРІС‹Рµ Р·Р°СЏРІРєРё", subtitle: "Р’С‹Р±РµСЂРёС‚Рµ СЃР»РµРґСѓСЋС‰СѓСЋ Р·Р°РґР°С‡Сѓ" };
    if (pathname.startsWith("/master/active")) return { title: "РђРєС‚РёРІРЅС‹Рµ Р·Р°СЏРІРєРё", subtitle: "Р¤РѕРєСѓСЃ РЅР° С‚РµРєСѓС‰РёС… СЂР°Р±РѕС‚Р°С…" };
    if (pathname.startsWith("/master/clients")) return { title: "Клиенты", subtitle: "Профили клиентов и оптовые пометки" };
    if (pathname.startsWith("/master/quick-replies")) return { title: "Р‘С‹СЃС‚СЂС‹Рµ РѕС‚РІРµС‚С‹", subtitle: "Р›РёС‡РЅС‹Рµ С€Р°Р±Р»РѕРЅС‹ СЃ С„РѕС‚Рѕ Рё РІРёРґРµРѕ" };
    if (pathname.startsWith("/master/reviews")) return { title: "РћС‚Р·С‹РІС‹", subtitle: "РћС†РµРЅРєР° РєР°С‡РµСЃС‚РІР° РІР°С€РµР№ СЂР°Р±РѕС‚С‹" };
    if (pathname.startsWith("/master/profile")) return { title: "РџСЂРѕС„РёР»СЊ", subtitle: "РџСѓР±Р»РёС‡РЅС‹Рµ РґР°РЅРЅС‹Рµ РјР°СЃС‚РµСЂР°" };
  }

  if (role === "admin") {
    if (pathname.startsWith("/admin/system")) return { title: "РЎРёСЃС‚РµРјР°", subtitle: "РЎРѕСЃС‚РѕСЏРЅРёРµ РїР»Р°С‚С„РѕСЂРјС‹ Рё РєР»СЋС‡РµРІС‹Рµ РјРµС‚СЂРёРєРё" };
    if (pathname.startsWith("/admin/profile")) return { title: "РџСЂРѕС„РёР»СЊ", subtitle: "РџСѓР±Р»РёС‡РЅС‹Рµ РґР°РЅРЅС‹Рµ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°" };
    if (pathname.startsWith("/admin/appointments")) return { title: "Р—Р°СЏРІРєРё", subtitle: "РћРїРµСЂР°С†РёРѕРЅРЅС‹Р№ РєРѕРЅС‚СЂРѕР»СЊ Р·Р°РєР°Р·РѕРІ" };
    if (pathname.startsWith("/admin/users")) return { title: "РџРѕР»СЊР·РѕРІР°С‚РµР»Рё", subtitle: "РЈРїСЂР°РІР»РµРЅРёРµ РґРѕСЃС‚СѓРїР°РјРё Рё СЂРѕР»СЏРјРё" };
    if (pathname.startsWith("/admin/rules")) return { title: "РџСЂР°РІРёР»Р°", subtitle: "РђРІС‚РѕРјР°С‚РёР·Р°С†РёСЏ С‚СЂРёРіРіРµСЂРѕРІ Рё СѓРІРµРґРѕРјР»РµРЅРёР№" };
    if (pathname.startsWith("/admin/reviews")) return { title: "РћС‚Р·С‹РІС‹", subtitle: "РљРѕРЅС‚СЂРѕР»СЊ РєР°С‡РµСЃС‚РІР° СЃРµСЂРІРёСЃР°" };
    if (pathname.startsWith("/admin/masters")) return { title: "РњР°СЃС‚РµСЂР°", subtitle: "РљРІР°Р»РёС„РёРєР°С†РёСЏ Рё РґРѕСЃС‚СѓРї Рє Р·Р°СЏРІРєР°Рј" };
  }

  return { title: "FRP Client", subtitle: "Р Р°Р±РѕС‡РµРµ РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРѕ" };
}

function resolveQuickAction(role, pathname) {
  if (role === "client" && !pathname.startsWith("/client/create")) {
    return { label: "РќРѕРІР°СЏ Р·Р°СЏРІРєР°", to: "/client/create" };
  }
  if (role === "master" && !pathname.startsWith("/master/new")) {
    return { label: "РќРѕРІС‹Рµ Р·Р°СЏРІРєРё", to: "/master/new" };
  }
  if (role === "admin" && !pathname.startsWith("/admin/system")) {
    return { label: "РЎРёСЃС‚РµРјР°", to: "/admin/system" };
  }
  return null;
}

export default function MainLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { mode, toggleMode } = useThemeMode();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const roleLabel = useMemo(() => getRoleLabel(user?.role), [user?.role]);
  const wholesaleBadge = useMemo(() => buildWholesaleBadge(user), [user]);
  const route = useMemo(
    () => resolveRouteContext(user?.role, location.pathname),
    [user?.role, location.pathname]
  );
  const quickAction = useMemo(
    () => resolveQuickAction(user?.role, location.pathname),
    [user?.role, location.pathname]
  );
  const menuItems = useMemo(() => buildMenu(user?.role), [user?.role]);
  const controlSurfaceSx = useMemo(
    () => ({
      height: { xs: 36, md: 38 },
      borderRadius: 1.5,
      border: "1px solid",
      borderColor: (themeValue) => alpha(themeValue.palette.divider, 0.95),
      bgcolor: (themeValue) =>
        themeValue.palette.mode === "dark"
          ? alpha("#0b1322", 0.86)
          : alpha("#ffffff", 0.9),
      backdropFilter: "blur(6px)",
    }),
    []
  );
  const iconControlSx = useMemo(
    () => ({
      ...controlSurfaceSx,
      width: { xs: 36, md: 38 },
      minWidth: { xs: 36, md: 38 },
      p: 0,
      "& .MuiSvgIcon-root": { fontSize: 18 },
    }),
    [controlSurfaceSx]
  );
  const chipControlSx = useMemo(
    () => ({
      ...controlSurfaceSx,
      "& .MuiChip-label": {
        px: 1.2,
        fontSize: 13,
        fontWeight: 700,
      },
    }),
    [controlSurfaceSx]
  );

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={{ minHeight: "100vh", width: "100%", overflowX: "clip" }}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          px: { xs: 0.4, md: 1 },
          pt: 0.4,
          backdropFilter: "blur(24px) saturate(160%)",
          backgroundColor: (themeValue) =>
            themeValue.palette.mode === "dark"
              ? "rgba(8, 14, 24, 0.72)"
              : "rgba(245, 249, 255, 0.72)",
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 62, md: 70 },
            px: { xs: 0.8, md: 1.1 },
            gap: 1,
            borderRadius: 2,
            border: "1px solid",
            borderColor: (themeValue) => alpha(themeValue.palette.divider, 0.95),
            bgcolor: (themeValue) =>
              themeValue.palette.mode === "dark"
                ? "rgba(5, 11, 22, 0.82)"
                : "rgba(249, 252, 255, 0.86)",
          }}
        >
          <IconButton
            color="inherit"
            onClick={() => setDrawerOpen(true)}
            sx={iconControlSx}
          >
            <MenuRoundedIcon />
          </IconButton>

          <Stack sx={{ flexGrow: 1, minWidth: 0 }} spacing={0.2}>
            <Stack direction="row" spacing={0.8} alignItems="center">
              <Chip
                size="small"
                icon={<RocketLaunchRoundedIcon sx={{ fontSize: 14 }} />}
                label="FRP"
                sx={{
                  height: 24,
                  bgcolor: (themeValue) =>
                    themeValue.palette.mode === "dark"
                      ? alpha(themeValue.palette.primary.main, 0.18)
                      : alpha(themeValue.palette.primary.main, 0.12),
                  color: "primary.main",
                  border: "1px solid",
                  borderColor: (themeValue) => alpha(themeValue.palette.primary.main, 0.35),
                }}
              />
              <Typography
                sx={{
                  fontWeight: 800,
                  color: (themeValue) =>
                    themeValue.palette.mode === "dark"
                      ? "rgba(236, 242, 252, 0.98)"
                      : "rgba(18, 33, 55, 0.96)",
                  letterSpacing: "-0.02em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {route.title}
              </Typography>
            </Stack>
            <Typography
              variant="caption"
              color="inherit"
              sx={{
                display: { xs: "none", md: "block" },
                color: (themeValue) =>
                  themeValue.palette.mode === "dark"
                    ? "rgba(181, 198, 222, 0.92)"
                    : "rgba(60, 79, 108, 0.9)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {route.subtitle}
            </Typography>
          </Stack>

          {quickAction && !isMobile ? (
            <Button
              component={RouterLink}
              to={quickAction.to}
              variant="outlined"
              size="small"
              sx={{
                height: { xs: 36, md: 38 },
                minWidth: 132,
                px: 1.9,
                borderRadius: 1.5,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                textTransform: "none",
                borderWidth: 1,
                borderColor: (themeValue) => alpha(themeValue.palette.primary.main, 0.42),
                color: (themeValue) =>
                  themeValue.palette.mode === "dark"
                    ? alpha(themeValue.palette.primary.light, 0.96)
                    : alpha(themeValue.palette.primary.dark, 0.88),
                bgcolor: (themeValue) =>
                  themeValue.palette.mode === "dark"
                    ? alpha(themeValue.palette.primary.main, 0.16)
                    : alpha(themeValue.palette.primary.main, 0.08),
                boxShadow: "none",
                "&:hover": {
                  boxShadow: "none",
                  borderColor: (themeValue) => alpha(themeValue.palette.primary.main, 0.6),
                  bgcolor: (themeValue) =>
                    themeValue.palette.mode === "dark"
                      ? alpha(themeValue.palette.primary.main, 0.22)
                      : alpha(themeValue.palette.primary.main, 0.14),
                },
              }}
            >
              {quickAction.label}
            </Button>
          ) : null}

          <Stack direction="row" spacing={0.75} alignItems="center">
            <Chip
              size="small"
              label={roleLabel}
              sx={{
                ...chipControlSx,
                display: { xs: "none", sm: "inline-flex" },
              }}
            />
            {wholesaleBadge ? (
              <Chip
                size="small"
                label={wholesaleBadge.label}
                color={wholesaleBadge.color}
                variant={wholesaleBadge.variant}
                sx={{
                  ...chipControlSx,
                  display: { xs: "none", md: "inline-flex" },
                  ...(wholesaleBadge.color === "success"
                    ? {
                        bgcolor: (themeValue) =>
                          themeValue.palette.mode === "dark"
                            ? alpha(themeValue.palette.success.main, 0.2)
                            : alpha(themeValue.palette.success.main, 0.12),
                        color: (themeValue) =>
                          themeValue.palette.mode === "dark"
                            ? alpha(themeValue.palette.success.light, 0.96)
                            : alpha(themeValue.palette.success.dark, 0.95),
                        borderColor: (themeValue) => alpha(themeValue.palette.success.main, 0.45),
                      }
                    : {}),
                }}
              />
            ) : null}

            <IconButton color="inherit" onClick={toggleMode} sx={iconControlSx}>
              {mode === "dark" ? (
                <LightModeRoundedIcon fontSize="small" />
              ) : (
                <DarkModeRoundedIcon fontSize="small" />
              )}
            </IconButton>

            <NotificationBell buttonSx={iconControlSx} />

            <IconButton color="inherit" onClick={onLogout} sx={iconControlSx}>
              <LogoutRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 300,
            borderRight: "1px solid",
            borderColor: "divider",
            backgroundColor: (themeValue) =>
              themeValue.palette.mode === "dark"
                ? "rgba(9, 15, 27, 0.95)"
                : "rgba(255,255,255,0.92)",
            backdropFilter: "blur(20px) saturate(150%)",
          },
        }}
      >
        <Stack sx={{ p: 2 }} spacing={0.7}>
          <Typography variant="h3">РќР°РІРёРіР°С†РёСЏ</Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.username || "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ"} В· {roleLabel}
          </Typography>
          {wholesaleBadge ? (
            <Chip
              size="small"
              label={wholesaleBadge.label}
              color={wholesaleBadge.color}
              variant={wholesaleBadge.variant}
              sx={{ alignSelf: "flex-start" }}
            />
          ) : null}
        </Stack>
        <Divider />
        <List sx={{ p: 1 }}>
          {menuItems.map((item) => (
            <ListItemButton
              key={item.to}
              component={RouterLink}
              to={item.to}
              selected={location.pathname.startsWith(item.to)}
              onClick={() => setDrawerOpen(false)}
              sx={{
                borderRadius: 2,
                mb: 0.4,
                "&.Mui-selected": {
                  bgcolor: (themeValue) => alpha(themeValue.palette.primary.main, 0.14),
                  color: "primary.main",
                },
              }}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
          <ListItemButton onClick={onLogout} sx={{ borderRadius: 2 }}>
            <ListItemText primary="Р’С‹Р№С‚Рё" />
          </ListItemButton>
        </List>
      </Drawer>

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

      <AppFab role={user?.role} />
      <AppBottomNav role={user?.role} />
    </Box>
  );
}


