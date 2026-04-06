import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './stores/authStore';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import VillagesPage from './pages/VillagesPage';
import HouseholdsPage from './pages/HouseholdsPage';
import HouseholdDetailPage from './pages/HouseholdDetailPage';
import MemberDetailPage from './pages/MemberDetailPage';
import PregnancyDetailPage from './pages/PregnancyDetailPage';
import AlertsPage from './pages/AlertsPage';
import AdminPage from './pages/AdminPage';

function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function RoleGuard({ children, roles }) {
  const role = useAuthStore((s) => s.role);
  if (!roles.includes(role)) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-center">
        <div>
          <h2 className="text-2xl font-bold text-neutral-700 mb-2">Access Denied</h2>
          <p className="text-neutral-500">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Authenticated routes wrapped in the layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="villages" element={<VillagesPage />} />
          <Route path="households" element={<HouseholdsPage />} />
          <Route path="households/:id" element={<HouseholdDetailPage />} />
          <Route path="members/:id" element={<MemberDetailPage />} />
          <Route path="pregnancies/:id" element={<PregnancyDetailPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route
            path="admin"
            element={
              <RoleGuard roles={['admin']}>
                <AdminPage />
              </RoleGuard>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
