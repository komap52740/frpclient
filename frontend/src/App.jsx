import { Component, lazy, Suspense } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import RoleHomeRedirect from "./components/RoleHomeRedirect";
import MainLayout from "./layouts/MainLayout";

function isChunkLoadError(error) {
  const message = String(error?.message || error || "");
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk")
  );
}

function lazyWithRetry(importer) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      if (isChunkLoadError(error) && typeof window !== "undefined") {
        const key = "frp_chunk_retry_once";
        const alreadyRetried = window.sessionStorage.getItem(key) === "1";
        if (!alreadyRetried) {
          window.sessionStorage.setItem(key, "1");
          window.location.reload();
          // Keep suspense fallback while browser reloads.
          return new Promise(() => undefined);
        }
      }
      throw error;
    }
  });
}

const AdminAppointmentsPage = lazyWithRetry(() => import("./pages/admin/AdminAppointmentsPage"));
const AdminClientsPage = lazyWithRetry(() => import("./pages/admin/AdminClientsPage"));
const AdminMastersPage = lazyWithRetry(() => import("./pages/admin/AdminMastersPage"));
const AdminSystemPage = lazyWithRetry(() => import("./pages/admin/AdminSystemPage"));
const AdminUsersPage = lazyWithRetry(() => import("./pages/admin/AdminUsersPage"));
const AdminRulesPage = lazyWithRetry(() => import("./pages/admin/AdminRulesPage"));
const AppointmentDetailPage = lazyWithRetry(() => import("./pages/AppointmentDetailPage"));
const LoginPage = lazyWithRetry(() => import("./pages/auth/LoginPage"));
const ClientHomePage = lazyWithRetry(() => import("./pages/client/ClientHomePage"));
const ClientProfilePage = lazyWithRetry(() => import("./pages/client/ClientProfilePage"));
const CreateAppointmentPage = lazyWithRetry(() => import("./pages/client/CreateAppointmentPage"));
const MyAppointmentsPage = lazyWithRetry(() => import("./pages/client/MyAppointmentsPage"));
const MasterActivePage = lazyWithRetry(() => import("./pages/master/MasterActivePage"));
const MasterNewPage = lazyWithRetry(() => import("./pages/master/MasterNewPage"));

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
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: String(error?.message || "") };
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

    const chunkError = isChunkLoadError(this.state.errorMessage);

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
        <Stack spacing={1.5} sx={{ width: "100%", maxWidth: 580 }}>
          <Alert severity="error">
            {chunkError
              ? "Интерфейс обновился на сервере. Нажмите «Обновить страницу», чтобы загрузить актуальную версию."
              : "Не удалось загрузить экран. Обычно это решается обновлением страницы."}
          </Alert>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Обновить страницу
          </Button>
          {this.state.errorMessage ? (
            <Typography variant="caption" color="text.secondary">
              Техническая деталь: {this.state.errorMessage}
            </Typography>
          ) : null}
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
