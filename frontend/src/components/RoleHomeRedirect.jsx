import { Navigate } from "react-router-dom";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";

import { useAuth } from "../auth/AuthContext";

export default function RoleHomeRedirect() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "client" && user.is_banned) {
    return <Navigate to="/banned" replace />;
  }

  if (user.role === "client") {
    return <Navigate to="/client/home" replace />;
  }
  if (user.role === "master") {
    return <Navigate to="/master/new" replace />;
  }
  if (user.role === "admin") {
    return <Navigate to="/admin/system" replace />;
  }

  return (
    <Box
      sx={{
        minHeight: "45vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
      }}
    >
      <Stack spacing={1.2} alignItems="center">
        <CircularProgress size={30} />
        <Typography variant="body2" color="text.secondary">
          Завершаем вход в систему...
        </Typography>
      </Stack>
    </Box>
  );
}
