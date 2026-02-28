import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import RoleHomeRedirect from "./components/RoleHomeRedirect";
import MainLayout from "./layouts/MainLayout";
import AdminAppointmentsPage from "./pages/admin/AdminAppointmentsPage";
import AdminClientsPage from "./pages/admin/AdminClientsPage";
import AdminMastersPage from "./pages/admin/AdminMastersPage";
import AdminSystemPage from "./pages/admin/AdminSystemPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AppointmentDetailPage from "./pages/AppointmentDetailPage";
import LoginPage from "./pages/auth/LoginPage";
import ClientHomePage from "./pages/client/ClientHomePage";
import ClientProfilePage from "./pages/client/ClientProfilePage";
import CreateAppointmentPage from "./pages/client/CreateAppointmentPage";
import MyAppointmentsPage from "./pages/client/MyAppointmentsPage";
import MasterActivePage from "./pages/master/MasterActivePage";
import MasterNewPage from "./pages/master/MasterNewPage";

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
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={<AuthenticatedLayout />} />
    </Routes>
  );
}
