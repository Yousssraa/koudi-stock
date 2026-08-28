import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Inventory from "./pages/Inventory.jsx";
import Transactions from "./pages/Transactions.jsx";
import Clients from "./pages/Clients.jsx";
import Contacts from "./pages/Contacts.jsx";
import Settings from "./pages/Settings.jsx";
import Drying from "./pages/Drying.jsx";
import Archive from "./pages/Archive.jsx";
import Audit from "./pages/Audit.jsx";
import NotFound from "./pages/NotFound.jsx";
import Login from "./pages/Login.jsx";
import { isAuthenticated } from "./auth.js";

function RequireAuth({ children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="clients" element={<Clients />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="settings" element={<Settings />} />
        <Route path="drying" element={<Drying />} />
        <Route path="archive" element={<Archive />} />
        <Route path="audit" element={<Audit />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
