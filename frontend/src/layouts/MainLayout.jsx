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
      { label: "Главная", to: "/client/home" },
      { label: "Новая заявка", to: "/client/create" },
      { label: "Мои заявки", to: "/client/my" },
      { label: "Профиль", to: "/client/profile" },
    ];
  }

  if (role === "master") {
    return [
      { label: "Новые заявки", to: "/master/new" },
      { label: "Активные", to: "/master/active" },
      { label: "Быстрые ответы", to: "/master/quick-replies" },
      { label: "Отзывы", to: "/master/reviews" },
      { label: "Профиль", to: "/master/profile" },
    ];
  }

  if (role === "admin") {
    return [
      { label: "Система", to: "/admin/system" },
      { label: "Профиль", to: "/admin/profile" },
      { label: "Заявки", to: "/admin/appointments" },
      { label: "Правила", to: "/admin/rules" },
      { label: "Отзывы", to: "/admin/reviews" },
      { label: "Пользователи", to: "/admin/users" },
      { label: "Клиенты", to: "/admin/clients" },
      { label: "Мастера", to: "/admin/masters" },
    ];
  }

  return [];
}

function getRoleLabel(role) {
  if (role === "client") return "Клиент";
  if (role === "master") return "Мастер";
  if (role === "admin") return "Админ";
  return "Пользователь";
}

function buildWholesaleBadge(user) {
  if (!user || user.role !== "client") {
    return null;
  }

  const status = user.wholesale_status || "none";
  if (status === "approved") {
    return {
      label: "Оптовый сервис",
      color: "success",
      variant: "filled",
    };
  }
  if (status === "pending") {
    return {
      label: "Опт: на проверке",
      color: "warning",
      variant: "outlined",
    };
  }
  if (status === "rejected") {
    return {
      label: "Опт: отклонено",
      color: "error",
      variant: "outlined",
    };
  }
  return null;
}

function resolveRouteContext(role, pathname) {
  if (pathname.startsWith("/appointments/")) {
    return {
      title: "Карточка заявки",
      subtitle: "Статус, чат, оплата и события в одном окне",
    };
  }

  if (role === "client") {
    if (pathname.startsWith("/client/home")) return { title: "Главная", subtitle: "Быстрые действия и актуальные статусы" };
    if (pathname.startsWith("/client/create")) return { title: "Новая заявка", subtitle: "Минимум полей, максимум скорости" };
    if (pathname.startsWith("/client/my")) return { title: "Мои заявки", subtitle: "Контроль заказов без лишнего шума" };
    if (pathname.startsWith("/client/profile")) return { title: "Профиль", subtitle: "Настройки аккаунта и безопасность" };
  }

  if (role === "master") {
    if (pathname.startsWith("/master/new")) return { title: "Новые заявки", subtitle: "Выберите следующую задачу" };
    if (pathname.startsWith("/master/active")) return { title: "Активные заявки", subtitle: "Фокус на текущих работах" };
    if (pathname.startsWith("/master/quick-replies")) return { title: "Быстрые ответы", subtitle: "Личные шаблоны с фото и видео" };
    if (pathname.startsWith("/master/reviews")) return { title: "Отзывы", subtitle: "Оценка качества вашей работы" };
    if (pathname.startsWith("/master/profile")) return { title: "Профиль", subtitle: "Публичные данные мастера" };
  }

  if (role === "admin") {
    if (pathname.startsWith("/admin/system")) return { title: "Система", subtitle: "Состояние платформы и ключевые метрики" };
    if (pathname.startsWith("/admin/profile")) return { title: "Профиль", subtitle: "Публичные данные администратора" };
    if (pathname.startsWith("/admin/appointments")) return { title: "Заявки", subtitle: "Операционный контроль заказов" };
    if (pathname.startsWith("/admin/users")) return { title: "Пользователи", subtitle: "Управление доступами и ролями" };
    if (pathname.startsWith("/admin/rules")) return { title: "Правила", subtitle: "Автоматизация триггеров и уведомлений" };
    if (pathname.startsWith("/admin/reviews")) return { title: "Отзывы", subtitle: "Контроль качества сервиса" };
    if (pathname.startsWith("/admin/masters")) return { title: "Мастера", subtitle: "Квалификация и доступ к заявкам" };
  }

  return { title: "FRP Client", subtitle: "Рабочее пространство" };
}

function resolveQuickAction(role, pathname) {
  if (role === "client" && !pathname.startsWith("/client/create")) {
    return { label: "Новая заявка", to: "/client/create" };
  }
  if (role === "master" && !pathname.startsWith("/master/new")) {
    return { label: "Новые заявки", to: "/master/new" };
  }
  if (role === "admin" && !pathname.startsWith("/admin/system")) {
    return { label: "Система", to: "/admin/system" };
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
          <Typography variant="h3">Навигация</Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.username || "Пользователь"} · {roleLabel}
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
            <ListItemText primary="Выйти" />
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
