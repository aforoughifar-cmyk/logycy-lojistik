import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './services/supabaseService';
import { useStore } from './store/useStore';
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
import StaffDetail from './pages/StaffDetail'; 
import Payroll from './pages/Payroll';
import Advances from './pages/Advances'; 
import Insurance from './pages/Insurance'; 
import Expenses from './pages/Expenses';
import Warehouse from './pages/Warehouse';
import Fleet from './pages/Fleet'; 
import Integration from './pages/Integration'; 
import Ordino from './pages/Ordino';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import AuditLogs from './pages/AuditLogs';
import Login from './pages/Login';
import Home from './pages/Home';
import Tracking from './pages/Tracking';
import NotFound from './pages/NotFound';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, 
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App: React.FC = () => {
  const store = useStore();
  const { isAuthenticated, setUser, setUserRole, setUserPermissions } = store;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout: If Supabase hangs, force load after 3 seconds
    const safetyTimer = setTimeout(() => {
        if (loading) {
            console.warn("Safety timer triggered. Forcing app load.");
            // Force Admin access on timeout to ensure you can get in
            if (typeof setUserRole === 'function') setUserRole('admin');
            if (typeof setUserPermissions === 'function') setUserPermissions(['all']);
            setLoading(false);
        }
    }, 3000);

    const initApp = async () => {
      try {
        // 1. Check Session
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user || null;
        if (typeof setUser === 'function') setUser(user);

        if (user && user.email) {
            // 2. Fetch permissions SAFELY
            // Use select('*') instead of select('permissions') to avoid 400 error if column is missing
            const { data: emp, error } = await supabase
              .from('employees')
              .select('*') 
              .eq('email', user.email)
              .maybeSingle();
            
            if (!error && emp && (emp as any).permissions && Array.isArray((emp as any).permissions)) {
                if (typeof setUserPermissions === 'function') setUserPermissions((emp as any).permissions);
            } else {
                // Fallback to ALL access to prevent lockout if DB read fails or no record
                // This covers the case where 'permissions' column doesn't exist yet
                if (typeof setUserPermissions === 'function') setUserPermissions(['all']); 
            }
            if (typeof setUserRole === 'function') setUserRole('admin'); // Default role for logic compatibility
        } else {
            if (typeof setUserRole === 'function') setUserRole('staff'); 
        }
      } catch (err) {
        console.error("Init Error:", err);
        // Fallback
        if (typeof setUserPermissions === 'function') setUserPermissions(['all']);
        if (typeof setUserRole === 'function') setUserRole('admin');
      } finally {
        setLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    initApp();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (typeof setUser === 'function') setUser(session?.user || null);
    });

    return () => {
        if(subscription && subscription.subscription) subscription.subscription.unsubscribe();
        clearTimeout(safetyTimer);
    };
  }, [setUser, setUserRole, setUserPermissions]);

  if (loading) return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-brand-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-900 mb-4"></div>
          <p className="font-bold animate-pulse">Sistem Yükleniyor...</p>
      </div>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#333', color: '#fff' } }} />
        <Routes>
          {/* Public Routes */}
          <Route path="/home" element={<Home />} />
          <Route path="/tracking" element={<Tracking />} />

          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <Login />
          } />
          
          {/* Protected Routes using Layout */}
          <Route path="/*" element={
            isAuthenticated ? (
              <AdminLayout>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/tasks" element={<Tasks />} />
                  
                  {/* Operations */}
                  <Route path="/shipments" element={<Shipments />} />
                  <Route path="/shipments/:id" element={<ShipmentDetail />} />
                  <Route path="/containers" element={<Containers />} />
                  <Route path="/warehouse" element={<Warehouse />} />
                  <Route path="/fleet" element={<Fleet />} />
                  <Route path="/offers" element={<Offers />} />
                  <Route path="/integration" element={<Integration />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/calculator" element={<Calculator />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/audit-logs" element={<AuditLogs />} />

                  {/* CRM */}
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/customers/:id" element={<CustomerDetail />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/suppliers/:id" element={<SupplierDetail />} />

                  {/* Internal Accounting */}
                  <Route path="/ordinos" element={<Ordino />} /> 
                  <Route path="/checks" element={<Checks />} />
                  <Route path="/checks/:id" element={<CheckDetail />} />
                  <Route path="/expenses" element={<Expenses />} />
                  <Route path="/finance" element={<Finance />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/invoices/:id" element={<InvoiceDetail />} />

                  {/* HR */}
                  <Route path="/staff" element={<Staff />} />
                  <Route path="/staff/:id" element={<StaffDetail />} />
                  <Route path="/payroll" element={<Payroll />} />
                  <Route path="/advances" element={<Advances />} />
                  <Route path="/insurance" element={<Insurance />} />
                  <Route path="/hr" element={<Navigate to="/staff" />} />

                  {/* 404 inside layout */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AdminLayout>
            ) : (
              <Navigate to="/login" />
            )
          } />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
};

export default App;