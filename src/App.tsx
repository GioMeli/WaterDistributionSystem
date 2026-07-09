import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';

// Public
import LoginPage from '@/pages/LoginPage';

// Vendor pages
import VendorDashboard from '@/pages/vendor/VendorDashboard';
import NewDeliveryPage from '@/pages/vendor/NewDeliveryPage';
import DeliveryDashboardPage from '@/pages/vendor/DeliveryDashboardPage';
import LocationFormPage from '@/pages/vendor/LocationFormPage';
import ConfirmSubmitPage from '@/pages/vendor/ConfirmSubmitPage';

// Admin pages
import AdminDashboard from '@/pages/admin/AdminDashboard';
import DeliveriesListPage from '@/pages/admin/DeliveriesListPage';
import DeliveryReviewPage from '@/pages/admin/DeliveryReviewPage';
import LocationsPage from '@/pages/admin/LocationsPage';
import VendorsPage from '@/pages/admin/VendorsPage';
import ReportsPage from '@/pages/admin/ReportsPage';
import OrderHistoryPage from '@/pages/admin/OrderHistoryPage';
import SettingsPage from '@/pages/admin/SettingsPage';
import AuditLogsPage from '@/pages/admin/AuditLogsPage';
import DispensersPage from '@/pages/admin/DispensersPage';
import DispenserCyclesPage from '@/pages/admin/DispenserCyclesPage';
import DispenserReportsPage from '@/pages/admin/DispenserReportsPage';
import SanitisationPage from '@/pages/vendor/SanitisationPage';
import DescalingPage from '@/pages/vendor/DescalingPage';
import VendorDispenserWorkflowPage from '@/pages/vendor/VendorDispenserWorkflowPage';
import DispenserHistoryPage from '@/pages/shared/DispenserHistoryPage';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Vendor routes */}
          <Route path="/vendor" element={<ProtectedRoute requiredRole="vendor"><VendorDashboard /></ProtectedRoute>} />
          <Route path="/vendor/new-delivery" element={<ProtectedRoute requiredRole="vendor"><NewDeliveryPage /></ProtectedRoute>} />
          <Route path="/vendor/delivery/:id" element={<ProtectedRoute requiredRole="vendor"><DeliveryDashboardPage /></ProtectedRoute>} />
          <Route path="/vendor/delivery/:id/location/:itemId" element={<ProtectedRoute requiredRole="vendor"><LocationFormPage /></ProtectedRoute>} />
          <Route path="/vendor/delivery/:id/confirm" element={<ProtectedRoute requiredRole="vendor"><ConfirmSubmitPage /></ProtectedRoute>} />
          <Route path="/vendor/history" element={<ProtectedRoute requiredRole="vendor"><VendorDashboard /></ProtectedRoute>} />
          <Route path="/vendor/sanitisation" element={<ProtectedRoute requiredRole="vendor"><SanitisationPage /></ProtectedRoute>} />
          <Route path="/vendor/descaling" element={<ProtectedRoute requiredRole="vendor"><DescalingPage /></ProtectedRoute>} />
          <Route path="/vendor/sanitisation/workflow/:cycleId" element={<ProtectedRoute requiredRole="vendor"><VendorDispenserWorkflowPage processType="sanitisation" /></ProtectedRoute>} />
          <Route path="/vendor/descaling/workflow/:cycleId" element={<ProtectedRoute requiredRole="vendor"><VendorDispenserWorkflowPage processType="descaling" /></ProtectedRoute>} />
          <Route path="/vendor/dispenser-history" element={<ProtectedRoute requiredRole="vendor"><DispenserHistoryPage role="vendor" /></ProtectedRoute>} />
          
          {/* Admin routes */}
          <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/deliveries" element={<ProtectedRoute requiredRole="admin"><DeliveriesListPage /></ProtectedRoute>} />
          <Route path="/admin/delivery/:id" element={<ProtectedRoute requiredRole="admin"><DeliveryReviewPage /></ProtectedRoute>} />
          <Route path="/admin/locations" element={<ProtectedRoute requiredRole="admin"><LocationsPage /></ProtectedRoute>} />
          <Route path="/admin/vendors" element={<ProtectedRoute requiredRole="admin"><VendorsPage /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute requiredRole="admin"><ReportsPage /></ProtectedRoute>} />
          <Route path="/admin/order-history" element={<ProtectedRoute requiredRole="admin"><OrderHistoryPage /></ProtectedRoute>} />
          <Route path="/admin/audit-logs" element={<ProtectedRoute requiredRole="admin"><AuditLogsPage /></ProtectedRoute>} />
          <Route path="/admin/dispensers" element={<ProtectedRoute requiredRole="admin"><DispensersPage /></ProtectedRoute>} />
          <Route path="/admin/dispenser-cycles" element={<ProtectedRoute requiredRole="admin"><DispenserCyclesPage /></ProtectedRoute>} />
          <Route path="/admin/dispenser-reports" element={<ProtectedRoute requiredRole="admin"><DispenserReportsPage /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute requiredRole="admin"><SettingsPage /></ProtectedRoute>} />

          {/* Default redirects */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </Router>
    </AuthProvider>
  );
};

export default App;
