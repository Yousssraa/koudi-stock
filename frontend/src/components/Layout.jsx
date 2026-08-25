import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "./ToastContext.jsx";
import api from "../api/client.js";
import { clearToken } from "../auth.js";
import WoodCalculatorModal from "./WoodCalculatorModal.jsx";

const NAV = [
  { to: "/", label: "Tableau de bord", icon: "◧" },
  { to: "/inventory", label: "Inventaire", icon: "▦" },
  { to: "/transactions", label: "Ventes & Achats", icon: "⇄" },
  { to: "/clients", label: "Clients & Crédit", icon: "✉" },
  { to: "/drying", label: "Séchage & Séchoir", icon: "♨" },
  { to: "/archive", label: "Archives", icon: "🗄" },
  { to: "/audit", label: "Journal d'Audit", icon: "✍" },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/koudi-mark.svg"
        alt="KOUDI STOCK"
        className="h-10 w-10 rounded-xl shadow-lg shadow-black/40 ring-1 ring-amber/40"
      />
      <div>
        <p className="font-display text-lg font-bold tracking-tight text-frost">KOUDI STOCK</p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-dim">
          Vente &amp; Gestion de Stock du Bois
        </p>
      </div>
    </div>
  );
}

export default function Layout() {
  const { warehouses, warehouseId, setWarehouseId, refresh } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");

  const openModal = (mode) => setModal(mode);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout/");
    } catch (_) {}
    clearToken();
    navigate("/login");
  };

  const onConfirm = (result) => {
    refresh();
    const no = result.transfer?.movement_no || result.order?.po_number || result.order?.so_number;
    const kind = result.transfer
      ? "Transfert"
      : result.order?.po_number
        ? "Achat"
        : "Vente";
    toast.success(`${kind} enregistré (${no}).`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/inventory?search=${encodeURIComponent(search)}`);
  };

  return (
    <div className="min-h-screen bg-ink text-frost">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-line bg-panel">
        <div className="border-b border-line px-5 py-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-gradient-to-r from-amber to-copper text-ink shadow-lg shadow-amber/20"
                    : "text-ash hover:bg-raise hover:text-frost"
                }`
              }
            >
              <span aria-hidden className="text-base leading-none">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line px-5 py-4">
          <p className="text-[11px] leading-relaxed text-dim">
            Société de Vente & Gestion de Stock du Bois — Casablanca · Tanger
          </p>
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-lg px-4 py-2 text-sm font-medium text-dim transition hover:bg-raise hover:text-rose"
          >
            ← Se déconnecter
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="ml-60 flex min-h-screen flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-10 border-b border-line bg-ink/80 backdrop-blur">
          <div className="flex items-center gap-4 px-6 py-3.5">
            <form
              onSubmit={handleSearch}
              className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 transition focus-within:border-amber/50"
            >
              <span className="text-sm text-dim">⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher produit, SKU, essence…"
                className="w-full bg-transparent text-sm text-frost outline-none placeholder:text-dim"
              />
            </form>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ash">Dépôt</span>
              <select
                value={warehouseId ?? ""}
                onChange={(e) => setWarehouseId(Number(e.target.value))}
                className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium text-frost outline-none transition focus:border-amber/60"
              >
                {warehouses.length === 0 && <option value="">—</option>}
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => openModal("purchase")}
                className="rounded-lg border border-amber/40 bg-panel px-3.5 py-2 text-sm font-semibold text-amber transition hover:bg-amber/10"
              >
                + Achat
              </button>
              <button
                onClick={() => openModal("sale")}
                className="rounded-lg border border-jade/40 bg-panel px-3.5 py-2 text-sm font-semibold text-jade transition hover:bg-jade/10"
              >
                + Vente
              </button>
              <button
                onClick={() => openModal("transfer")}
                className="rounded-lg bg-gradient-to-r from-amber to-copper px-4 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110"
              >
                + Transfert
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <WoodCalculatorModal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        mode={modal || "purchase"}
        warehouses={warehouses}
        defaultWarehouseId={warehouseId}
        onConfirm={onConfirm}
      />
    </div>
  );
}
