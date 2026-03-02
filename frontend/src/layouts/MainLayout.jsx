import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
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
      { label: "Создать заявку", to: "/client/create" },
      { label: "Мои заявки", to: "/client/my" },
      { label: "Профиль", to: "/client/profile" },
    ];
  }
  if (role === "master") {
    return [
      { label: "Новые заявки", to: "/master/new" },
      { label: "Активные", to: "/master/active" },
      { label: "Мои отзывы", to: "/master/reviews" },
    ];
  }
  if (role === "admin") {
    return [
      { label: "Система", to: "/admin/system" },
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
  if (role === "admin") return "Администратор";
  return "Пользователь";
}

function resolveRouteContext(role, pathname) {
  if (pathname.startsWith("/appointments/")) {
    return { title: "Заявка", subtitle: "Контроль статуса, оплаты и чата" };
  }

  if (role === "client") {
    if (pathname.startsWith("/client/home")) return { title: "Главная", subtitle: "Ваш центр действий" };
    if (pathname.startsWith("/client/my")) return { title: "Мои заявки", subtitle: "Все заказы в одном списке" };
    if (pathname.startsWith("/client/create")) return { title: "Новая заявка", subtitle: "Создание займет 1-2 минуты" };
    if (pathname.startsWith("/client/profile")) return { title: "Профиль", subtitle: "Настройки и безопасность" };
  }

  if (role === "master") {
    if (pathname.startsWith("/master/new")) return { title: "Новые заявки", subtitle: "Выберите следующую задачу" };
    if (pathname.startsWith("/master/active")) return { title: "Активные", subtitle: "Текущие заявки в работе" };
    if (pathname.startsWith("/master/reviews")) return { title: "Отзывы", subtitle: "Обратная связь клиентов" };
  }

  if (role === "admin") {
    if (pathname.startsWith("/admin/system")) return { title: "Система", subtitle: "Контроль платформы" };
    if (pathname.startsWith("/admin/appointments")) return { title: "Заявки", subtitle: "Операционная лента" };
    if (pathname.startsWith("/admin/users")) return { title: "Пользователи", subtitle: "Управление аккаунтами" };
    if (pathname.startsWith("/admin/rules")) return { title: "Правила", subtitle: "Автоматизация событий" };
    if (pathname.startsWith("/admin/reviews")) return { title: "Отзывы", subtitle: "Мониторинг качества" };
  }

  return { title: "FRP Клиент", subtitle: "Рабочее пространство" };
}

export default function MainLayout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { mode, toggleMode } = useThemeMode();
  const menuItems = buildMenu(user?.role);

  const roleLabel = useMemo(() => getRoleLabel(user?.role), [user?.role]);
  const routeContext = useMemo(
    () => resolveRouteContext(user?.role, location.pathname),
    [user?.role, location.pathname]
  );

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          backdropFilter: "blur(18px) saturate(140%)",
          px: { xs: 0.4, sm: 0.8 },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 60, sm: 68 }, px: { xs: 0.6, sm: 1 } }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setOpen(true)}
            sx={{ mr: 0.7 }}
          >
            <MenuIcon />
          </IconButton>
          <Stack direction="row" spacing={0.8} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                {isMobile ? routeContext.title : "FRP Клиент"}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: { xs: "none", md: "block" }, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
              >
                {routeContext.subtitle}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={roleLabel}
              sx={{
                display: { xs: "none", sm: "inline-flex" },
                bgcolor: "rgba(0,122,255,0.12)",
                color: "primary.main",
              }}
            />
          </Stack>
          <IconButton
            color="inherit"
            onClick={toggleMode}
            sx={{
              mr: 0.5,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            {mode === "dark" ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
          </IconButton>
          <NotificationBell />
          <Typography sx={{ mr: 1.4, display: { xs: "none", md: "block" }, color: "text.secondary" }}>
            {user?.username}
          </Typography>
          <Button color="inherit" onClick={onLogout} sx={{ color: "text.primary", display: { xs: "none", sm: "inline-flex" } }}>
            Выйти
          </Button>
          {isMobile ? (
            <IconButton
              color="inherit"
              onClick={onLogout}
              sx={{ border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}
            >
              <LogoutRoundedIcon fontSize="small" />
            </IconButton>
          ) : null}
        </Toolbar>
      </AppBar>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            backdropFilter: "blur(18px) saturate(130%)",
            backgroundColor: (theme) => (theme.palette.mode === "dark" ? "rgba(15,23,42,0.94)" : "rgba(255,255,255,0.88)"),
            borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <Box sx={{ width: 280 }} role="presentation" onClick={() => setOpen(false)}>
          <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle2" color="text.secondary">Навигация</Typography>
            <Typography variant="h6" sx={{ mt: 0.5 }}>Рабочее место</Typography>
            <Typography variant="caption" color="text.secondary">{user?.username}</Typography>
          </Box>
          <List>
            {menuItems.map((item) => (
              <ListItemButton component={RouterLink} to={item.to} key={item.to}>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
            <ListItemButton onClick={onLogout}>
              <ListItemText primary="Выйти" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

      <Container maxWidth="lg" sx={{ py: { xs: 1.5, md: 3 }, pb: { xs: 12, md: 3 } }}>
        <PageMotion>{children}</PageMotion>
      </Container>

      <AppFab role={user?.role} />
      <AppBottomNav role={user?.role} />
    </Box>
  );
}
