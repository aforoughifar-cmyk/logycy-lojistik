import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { supabase } from './services/supabaseService';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/Dashboard';
import Shipments from './pages/Shipments';
import ShipmentDetail from './pages/ShipmentDetail';
import Containers from './pages/Containers';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Suppliers from './pages/Suppliers';
import SupplierDetail from './pages/SupplierDetail';
import Offers from './pages/Offers';
import Calculator from './pages/Calculator';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import Tasks from './pages/Tasks';
import Finance from './pages/Finance';
import Checks from './pages/Checks';
import CheckDetail from './pages/CheckDetail';
import Staff from './pages/Staff';
import Payroll from './pages/Payroll';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import Expenses from './pages/Expenses';
import Warehouse from './pages/Warehouse';
import Fleet from './pages/Fleet'; 
import Integration from './pages/Integration'; // New Import
import Login from './pages/Login';
import Home from './pages/Home';
import Tracking from './pages/Tracking';
import NotFound from './pages/NotFound';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      setLoading(false);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 text-brand-900 font-bold">Yükleniyor...</div>;

  return (
    <Router>
      <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#333', color: '#fff' } }} />
      <Routes>
        {/* Public Routes */}
        <Route path="/home" element={<Home />} />
        <Route path="/tracking" element={<Tracking />} />

        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
        } />
        
        <Route path="/" element={
          isAuthenticated ? <AdminLayout /> : <Navigate to="/login" replace />
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          
          {/* Operations */}
          <Route path="shipments" element={<Shipments />} />
          <Route path="shipments/:id" element={<ShipmentDetail />} />
          <Route path="containers" element={<Containers />} />
          <Route path="warehouse" element={<Warehouse />} />
          <Route path="fleet" element={<Fleet />} />
          <Route path="offers" element={<Offers />} />
          <Route path="integration" element={<Integration />} />
          <Route path="reports" element={<Reports />} />
          <Route path="calculator" element={<Calculator />} />
          <Route path="settings" element={<Settings />} />

          {/* CRM */}
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="suppliers/:id" element={<SupplierDetail />} />

          {/* Internal Accounting */}
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="checks" element={<Checks />} />
          <Route path="checks/:id" element={<CheckDetail />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="finance" element={<Finance />} />

          {/* HR */}
          <Route path="staff" element={<Staff />} />
          <Route path="payroll" element={<Payroll />} />
          {/* Deprecated HR route mapped to new one */}
          <Route path="hr" element={<Navigate to="/staff" replace />} />

        </Route>

        {/* 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
};

export default App;