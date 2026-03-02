import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";

import { useAuth } from "../auth/AuthContext";

export function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
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
            Загружаем данные профиля...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role === "client" && user.is_banned) {
    return <Navigate to="/banned" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
