import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import NewReleasesRoundedIcon from "@mui/icons-material/NewReleasesRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from "@mui/material";
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
    ];
  }
  if (role === "admin") {
    return [
      { label: "Система", to: "/admin/system", icon: <SettingsRoundedIcon /> },
      { label: "Заявки", to: "/admin/appointments", icon: <ListAltRoundedIcon /> },
      { label: "Правила", to: "/admin/rules", icon: <GavelRoundedIcon /> },
      { label: "Польз.", to: "/admin/users", icon: <ManageAccountsRoundedIcon /> },
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
        left: 8,
        right: 8,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        zIndex: 1300,
        borderRadius: 3,
        border: "1px solid #dce6f0",
        overflow: "hidden",
      }}
    >
      <BottomNavigation
        value={selected}
        onChange={(_, value) => navigate(value)}
        showLabels
      >
        {actions.map((action) => (
          <BottomNavigationAction
            key={action.to}
            value={action.to}
            label={action.label}
            icon={action.icon}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
