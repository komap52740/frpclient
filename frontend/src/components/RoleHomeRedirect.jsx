import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

export default function RoleHomeRedirect() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "client") {
    return <Navigate to="/client/home" replace />;
  }
  if (user.role === "master") {
    return <Navigate to="/master/new" replace />;
  }
  if (user.role === "admin") {
    return <Navigate to="/admin/appointments" replace />;
  }

  return <Navigate to="/login" replace />;
}
