import { useNavigate } from "react-router-dom";
import { NavLink, Outlet } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import api from "../api/client.js";
import { clearToken } from "../auth.js";

const NAV = [
  { to: "/app", label: "Tableau de bord", icon: "◧" },
  { to: "/app/stock", label: "Stock", icon: "▦" },
  { to: "/app/transport", label: "Transport & Logistique", icon: "🚚" },
  { to: "/app/archive", label: "Archive", icon: "🗄" },
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
  const { warehouses, warehouseId, setWarehouseId } = useApp();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout/");
    } catch (_) {}
    clearToken();
    navigate("/app/login");
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
          <div className="flex items-center justify-between gap-4 px-6 py-3.5">
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

            <button
              onClick={() => navigate("/app/settings")}
              title="Paramètres société"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel text-lg text-ash shadow-lg shadow-black/20 ring-1 ring-line transition hover:bg-raise hover:text-amber"
            >
              ⚙
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
