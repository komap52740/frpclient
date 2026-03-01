import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import NewReleasesRoundedIcon from "@mui/icons-material/NewReleasesRounded";
import { Fab } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

function resolveFab(role, pathname) {
  if (role === "client" && !pathname.startsWith("/client/create")) {
    return {
      label: "Новая заявка",
      icon: <AddTaskRoundedIcon />,
      to: "/client/create",
    };
  }
  if (role === "master" && !pathname.startsWith("/master/new")) {
    return {
      label: "Новые заявки",
      icon: <NewReleasesRoundedIcon />,
      to: "/master/new",
    };
  }
  return null;
}

export default function AppFab({ role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const action = resolveFab(role, location.pathname);

  if (!action) {
    return null;
  }

  return (
    <Fab
      variant="extended"
      color="primary"
      onClick={() => navigate(action.to)}
      sx={{
        display: { xs: "inline-flex", md: "none" },
        position: "fixed",
        right: 16,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)",
        zIndex: 1300,
      }}
    >
      {action.icon}
      {action.label}
    </Fab>
  );
}
