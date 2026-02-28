import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Box,
  Button,
  Container,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

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
    ];
  }
  if (role === "admin") {
    return [
      { label: "Система", to: "/admin/system" },
      { label: "Заявки", to: "/admin/appointments" },
      { label: "Пользователи", to: "/admin/users" },
      { label: "Клиенты", to: "/admin/clients" },
      { label: "Мастера", to: "/admin/masters" },
    ];
  }
  return [];
}

export default function MainLayout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const menuItems = buildMenu(user?.role);

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8f6f2 0%, #eef5f4 100%)" }}>
      <AppBar position="sticky" color="primary">
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setOpen(true)} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
          <Typography sx={{ flexGrow: 1, fontWeight: 700 }}>FRP Клиент</Typography>
          <Typography sx={{ mr: 2, display: { xs: "none", sm: "block" } }}>{user?.username}</Typography>
          <Button color="inherit" onClick={onLogout}>
            Выйти
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 260 }} role="presentation" onClick={() => setOpen(false)}>
          <List>
            {menuItems.map((item) => (
              <ListItemButton component={RouterLink} to={item.to} key={item.to}>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {children}
      </Container>
    </Box>
  );
}
