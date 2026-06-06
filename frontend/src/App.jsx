import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { getUser } from './lib/auth.js';

import Shell from './components/Shell.jsx';
import LoginPage from './pages/LoginPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Items from './pages/Items.jsx';
import Parties from './pages/Parties.jsx';
import Sales from './pages/Sales.jsx';
import POS from './pages/POS.jsx';
import Purchases from './pages/Purchases.jsx';
import Accounting from './pages/Accounting.jsx';
import Reports from './pages/Reports.jsx';
import Staff from './pages/Staff.jsx';
import Loyalty from './pages/Loyalty.jsx';
import Settings from './pages/Settings.jsx';
import OnlineStore from './pages/OnlineStore.jsx';

function RequireAuth({ children }) {
  return getUser() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><Shell /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="items/*" element={<Items />} />
          <Route path="parties/*" element={<Parties />} />
          <Route path="sales/*" element={<Sales />} />
          <Route path="pos" element={<POS />} />
          <Route path="purchases/*" element={<Purchases />} />
          <Route path="accounting/*" element={<Accounting />} />
          <Route path="reports/*" element={<Reports />} />
          <Route path="staff" element={<Staff />} />
          <Route path="loyalty" element={<Loyalty />} />
          <Route path="settings/*" element={<Settings />} />
          <Route path="online-store" element={<OnlineStore />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
