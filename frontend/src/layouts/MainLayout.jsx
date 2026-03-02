import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
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
} from "@mui/material";
import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import AppBottomNav from "../components/ui/AppBottomNav";
import AppFab from "../components/ui/AppFab";
import NotificationBell from "../components/ui/NotificationBell";
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

export default function MainLayout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { mode, toggleMode } = useThemeMode();
  const menuItems = buildMenu(user?.role);

  const roleLabel = useMemo(() => getRoleLabel(user?.role), [user?.role]);

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
          px: { xs: 0.5, sm: 0 },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 62, sm: 68 } }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setOpen(true)}
            sx={{ mr: 1, display: { xs: "none", md: "inline-flex" } }}
          >
            <MenuIcon />
          </IconButton>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1 }}>
            <Typography sx={{ fontWeight: 800, letterSpacing: "-0.01em" }}>FRP Клиент</Typography>
            <Chip size="small" label={roleLabel} sx={{ bgcolor: "rgba(0,122,255,0.12)", color: "primary.main" }} />
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
          <Typography sx={{ mr: 2, display: { xs: "none", sm: "block" }, color: "text.secondary" }}>{user?.username}</Typography>
          <Button color="inherit" onClick={onLogout} sx={{ color: "text.primary" }}>
            Выйти
          </Button>
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
          </Box>
          <List>
            {menuItems.map((item) => (
              <ListItemButton component={RouterLink} to={item.to} key={item.to}>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      <Container maxWidth="lg" sx={{ py: { xs: 1.5, md: 3 }, pb: { xs: 12, md: 3 } }}>
        {children}
      </Container>

      <AppFab role={user?.role} />
      <AppBottomNav role={user?.role} />
    </Box>
  );
}
