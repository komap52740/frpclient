import { Component, lazy, Suspense } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import RoleHomeRedirect from "./components/RoleHomeRedirect";
import MainLayout from "./layouts/MainLayout";

const AdminAppointmentsPage = lazy(() => import("./pages/admin/AdminAppointmentsPage"));
const AdminClientsPage = lazy(() => import("./pages/admin/AdminClientsPage"));
const AdminMastersPage = lazy(() => import("./pages/admin/AdminMastersPage"));
const AdminSystemPage = lazy(() => import("./pages/admin/AdminSystemPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminRulesPage = lazy(() => import("./pages/admin/AdminRulesPage"));
const AppointmentDetailPage = lazy(() => import("./pages/AppointmentDetailPage"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const ClientHomePage = lazy(() => import("./pages/client/ClientHomePage"));
const ClientProfilePage = lazy(() => import("./pages/client/ClientProfilePage"));
const CreateAppointmentPage = lazy(() => import("./pages/client/CreateAppointmentPage"));
const MyAppointmentsPage = lazy(() => import("./pages/client/MyAppointmentsPage"));
const MasterActivePage = lazy(() => import("./pages/master/MasterActivePage"));
const MasterNewPage = lazy(() => import("./pages/master/MasterNewPage"));

function RouteFallback() {
  return (
    <Box
      sx={{
        minHeight: "40vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
      }}
    >
      <CircularProgress size={28} />
      <Typography variant="body2" color="text.secondary">
        Загружаем экран...
      </Typography>
    </Box>
  );
}

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Keep console logging for diagnostics in production.
    // eslint-disable-next-line no-console
    console.error("Route render/load failed:", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <Box
        sx={{
          minHeight: "55vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Stack spacing={1.5} sx={{ width: "100%", maxWidth: 540 }}>
          <Alert severity="error">
            Не удалось загрузить экран. Обычно это решается обновлением страницы.
          </Alert>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Обновить страницу
          </Button>
        </Stack>
      </Box>
    );
  }
}

function AuthenticatedLayout() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <Routes>
          <Route path="/" element={<RoleHomeRedirect />} />

          <Route
            path="/client/home"
            element={
              <ProtectedRoute roles={["client"]}>
                <ClientHomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/create"
            element={
              <ProtectedRoute roles={["client"]}>
                <CreateAppointmentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/my"
            element={
              <ProtectedRoute roles={["client"]}>
                <MyAppointmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/profile"
            element={
              <ProtectedRoute roles={["client"]}>
                <ClientProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/master/new"
            element={
              <ProtectedRoute roles={["master"]}>
                <MasterNewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master/active"
            element={
              <ProtectedRoute roles={["master"]}>
                <MasterActivePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/appointments"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminAppointmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/clients"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminClientsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/masters"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminMastersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/system"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminSystemPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/rules"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminRulesPage />
              </ProtectedRoute>
            }
          />

          <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <RouteErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/*" element={<AuthenticatedLayout />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}
