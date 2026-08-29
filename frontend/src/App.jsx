import { Navigate, Route, Routes } from "react-router-dom";
import SiteLayout from "./components/SiteLayout.jsx";
import Accueil from "./pages/site/Accueil.jsx";
import Produits from "./pages/site/Produits.jsx";
import Produit from "./pages/site/Produit.jsx";
import Categorie from "./pages/site/Categorie.jsx";
import Devis from "./pages/site/Devis.jsx";
import Contact from "./pages/site/Contact.jsx";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Stock from "./pages/Stock.jsx";
import Transport from "./pages/Transport.jsx";
import Archive from "./pages/Archive.jsx";
import Settings from "./pages/Settings.jsx";
import NotFound from "./pages/NotFound.jsx";
import Login from "./pages/Login.jsx";
import { isAuthenticated } from "./auth.js";

function RequireAuth({ children }) {
  if (!isAuthenticated()) return <Navigate to="/app/login" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  if (isAuthenticated()) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public vitrine (Comarbois-style, no login) */}
      <Route element={<SiteLayout />}>
        <Route index element={<Accueil />} />
        <Route path="produits" element={<Produits />} />
        <Route path="produit/:id" element={<Produit />} />
        <Route path="categorie/:key" element={<Categorie />} />
        <Route path="devis" element={<Devis />} />
        <Route path="contact" element={<Contact />} />
      </Route>

      {/* Authenticated app (moved under /app) */}
      <Route
        path="/app/login"
        element={
          <RedirectIfAuthed>
            <Login />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="stock" element={<Stock />} />
        <Route path="transport" element={<Transport />} />
        <Route path="archive" element={<Archive />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Legacy redirects from the previous root-based app URLs */}
      <Route path="/login" element={<Navigate to="/app/login" replace />} />
      <Route path="/stock" element={<Navigate to="/app/stock" replace />} />
      <Route path="/transport" element={<Navigate to="/app/transport" replace />} />
      <Route path="/archive" element={<Navigate to="/app/archive" replace />} />
      <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
      <Route path="/app/*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
