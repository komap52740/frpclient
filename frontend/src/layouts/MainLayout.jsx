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
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setOpen(true)} sx={{ mr: 1, display: { xs: "none", md: "inline-flex" } }}>
            <MenuIcon />
          </IconButton>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1 }}>
            <Typography sx={{ fontWeight: 800, letterSpacing: "-0.01em" }}>FRP Клиент</Typography>
            <Chip size="small" label={roleLabel} sx={{ bgcolor: "rgba(0,122,255,0.12)", color: "primary.main" }} />
          </Stack>
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
            backgroundColor: "rgba(255,255,255,0.88)",
            borderRight: "1px solid rgba(15,23,42,0.08)",
          },
        }}
      >
        <Box sx={{ width: 280 }} role="presentation" onClick={() => setOpen(false)}>
          <Box sx={{ p: 2, borderBottom: "1px solid #eceff1" }}>
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

      <Container maxWidth="lg" sx={{ py: 3, pb: { xs: 12, md: 3 } }}>
        {children}
      </Container>

      <AppFab role={user?.role} />
      <AppBottomNav role={user?.role} />
    </Box>
  );
}
