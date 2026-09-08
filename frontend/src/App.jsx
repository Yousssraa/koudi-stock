import { Navigate, Route, Routes } from "react-router-dom";
import SiteLayout from "./components/SiteLayout.jsx";
import Accueil from "./pages/site/Accueil.jsx";
import Produits from "./pages/site/Produits.jsx";
import Produit from "./pages/site/Produit.jsx";
import Categorie from "./pages/site/Categorie.jsx";
import About from "./pages/site/About.jsx";
import Equipe from "./pages/site/Equipe.jsx";
import Actualites from "./pages/site/Actualites.jsx";
import Devis from "./pages/site/Devis.jsx";
import Contact from "./pages/site/Contact.jsx";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Stock from "./pages/Stock.jsx";
import Tarifs from "./pages/Tarifs.jsx";
import Transport from "./pages/Transport.jsx";
import Facturation from "./pages/Facturation.jsx";
import Archive from "./pages/Archive.jsx";
import Settings from "./pages/Settings.jsx";
import NotFound from "./pages/NotFound.jsx";
import Login from "./pages/Login.jsx";
import ProLayout from "./components/ProLayout.jsx";
import ProLogin from "./pages/pro/Login.jsx";
import ProRegister from "./pages/pro/Register.jsx";
import ProDashboard from "./pages/pro/Dashboard.jsx";
import ProDevis from "./pages/pro/Devis.jsx";
import ProDevisDetail from "./pages/pro/DevisDetail.jsx";
import ProCommandes, { ProOrderDetail } from "./pages/pro/Commandes.jsx";
import ProFactures from "./pages/pro/Factures.jsx";
import ProCredit from "./pages/pro/Credit.jsx";
import ProFidelite from "./pages/pro/Fidelite.jsx";
import ProCatalogue from "./pages/pro/Catalogue.jsx";
import ProProfile from "./pages/pro/Profile.jsx";
import { isAuthenticated } from "./auth.js";
import { isProAuthenticated } from "./authPro.js";

function RequireAuth({ children }) {
  if (!isAuthenticated()) return <Navigate to="/app/login" replace />;
  return children;
}

function ProNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="font-display bg-gradient-to-r from-amber to-copper bg-clip-text text-7xl font-bold text-transparent">
        404
      </p>
      <h1 className="font-display mt-3 text-xl font-bold text-frost">Page introuvable</h1>
      <p className="mt-1 text-sm text-ash">
        La page que vous cherchez n'existe pas dans votre espace professionnel.
      </p>
    </div>
  );
}

function RedirectIfAuthed({ children }) {
  if (isAuthenticated()) return <Navigate to="/app" replace />;
  return children;
}

function RequireProAuth({ children }) {
  if (!isProAuthenticated()) return <Navigate to="/pro/login" replace />;
  return children;
}

function RedirectIfProAuthed({ children }) {
  if (isProAuthenticated()) return <Navigate to="/pro" replace />;
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
        <Route path="equipe" element={<Equipe />} />
        <Route path="categorie/:key" element={<Categorie />} />
        <Route path="apropos" element={<About />} />
        <Route path="actualites" element={<Actualites />} />
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
        <Route path="tarifs" element={<Tarifs />} />
        <Route path="transport" element={<Transport />} />
        <Route path="facturation" element={<Facturation />} />
        <Route path="archive" element={<Archive />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Espace Pro — client portal */}
      <Route
        path="/pro/login"
        element={
          <RedirectIfProAuthed>
            <ProLogin />
          </RedirectIfProAuthed>
        }
      />
      <Route
        path="/pro/register"
        element={
          <RedirectIfProAuthed>
            <ProRegister />
          </RedirectIfProAuthed>
        }
      />
      <Route
        path="/pro"
        element={
          <RequireProAuth>
            <ProLayout />
          </RequireProAuth>
        }
      >
        <Route index element={<ProDashboard />} />
        <Route path="devis" element={<ProDevis />} />
        <Route path="devis/:id" element={<ProDevisDetail />} />
        <Route path="commandes" element={<ProCommandes />} />
        <Route path="commandes/:id" element={<ProOrderDetail />} />
        <Route path="factures" element={<ProFactures />} />
        <Route path="credit" element={<ProCredit />} />
        <Route path="fidelite" element={<ProFidelite />} />
        <Route path="catalogue" element={<ProCatalogue />} />
        <Route path="profile" element={<ProProfile />} />
        <Route path="*" element={<ProNotFound />} />
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
