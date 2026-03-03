import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import NewReleasesRoundedIcon from "@mui/icons-material/NewReleasesRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import QuickreplyRoundedIcon from "@mui/icons-material/QuickreplyRounded";
import ReviewsRoundedIcon from "@mui/icons-material/ReviewsRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function getActions(role) {
  if (role === "client") {
    return [
      { label: "Главная", to: "/client/home", icon: <HomeRoundedIcon /> },
      { label: "Заявки", to: "/client/my", icon: <ListAltRoundedIcon /> },
      { label: "Профиль", to: "/client/profile", icon: <PersonRoundedIcon /> },
    ];
  }

  if (role === "master") {
    return [
      { label: "Новые", to: "/master/new", icon: <NewReleasesRoundedIcon /> },
      { label: "Активные", to: "/master/active", icon: <DashboardRoundedIcon /> },
      { label: "Клиенты", to: "/master/clients", icon: <PeopleRoundedIcon /> },
      { label: "Шаблоны", to: "/master/quick-replies", icon: <QuickreplyRoundedIcon /> },
      { label: "Профиль", to: "/master/profile", icon: <PersonRoundedIcon /> },
    ];
  }

  if (role === "admin") {
    return [
      { label: "Система", to: "/admin/system", icon: <SettingsRoundedIcon /> },
      { label: "Заявки", to: "/admin/appointments", icon: <ListAltRoundedIcon /> },
      { label: "Отзывы", to: "/admin/reviews", icon: <ReviewsRoundedIcon /> },
      { label: "Правила", to: "/admin/rules", icon: <GavelRoundedIcon /> },
      { label: "Профиль", to: "/admin/profile", icon: <PersonRoundedIcon /> },
    ];
  }

  return [];
}

export default function AppBottomNav({ role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const actions = useMemo(() => getActions(role), [role]);

  if (!actions.length) {
    return null;
  }

  const selected = actions.find((action) => location.pathname.startsWith(action.to))?.to || actions[0].to;

  return (
    <Paper
      elevation={0}
      sx={{
        display: { xs: "block", md: "none" },
        position: "fixed",
        left: 10,
        right: 10,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
        zIndex: 1300,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: (theme) =>
          theme.palette.mode === "dark"
            ? "rgba(10, 16, 28, 0.9)"
            : "rgba(255,255,255,0.86)",
        backdropFilter: "blur(10px) saturate(120%)",
        overflow: "hidden",
        boxShadow: (theme) =>
          theme.palette.mode === "dark"
            ? "0 14px 36px rgba(2,6,23,0.58)"
            : "0 12px 30px rgba(15,23,42,0.14)",
      }}
    >
      <BottomNavigation
        value={selected}
        onChange={(_, value) => navigate(value)}
        showLabels
        sx={{
          minHeight: 64,
          bgcolor: "transparent",
          "& .MuiBottomNavigationAction-root": {
            minWidth: 56,
            color: "text.secondary",
            py: 0.5,
            borderRadius: 1.1,
            mx: 0.3,
            "& .MuiBottomNavigationAction-label": {
              fontSize: 11.5,
              fontWeight: 700,
            },
          },
          "& .Mui-selected": {
            color: "primary.main",
            bgcolor: (theme) =>
              theme.palette.mode === "dark"
                ? alpha(theme.palette.primary.main, 0.2)
                : alpha(theme.palette.primary.main, 0.12),
          },
        }}
      >
        {actions.map((action) => (
          <BottomNavigationAction key={action.to} value={action.to} label={action.label} icon={action.icon} />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
