import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import proApi from "../api/proClient.js";
import { clearProToken, getProToken } from "../authPro.js";

const NAV = [
  { to: "/pro", label: "Tableau de bord", icon: "◧", end: true },
  { to: "/pro/devis", label: "Devis", icon: "📄" },
  { to: "/pro/commandes", label: "Commandes", icon: "📦" },
  { to: "/pro/factures", label: "Facturation", icon: "🧾" },
  { to: "/pro/credit", label: "Crédit", icon: "💳" },
  { to: "/pro/fidelite", label: "Fidélité", icon: "★" },
  { to: "/pro/catalogue", label: "Catalogue & Tarifs", icon: "🪵" },
  { to: "/pro/profile", label: "Mon profil", icon: "👤" },
];

export default function ProLayout() {
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!getProToken()) return;
    proApi
      .get("/pro/auth/me/")
      .then(({ data }) => {
        setProfile(data);
        setCompany(data.client);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await proApi.post("/pro/auth/logout/");
    } catch (_) {}
    clearProToken();
    navigate("/pro/login");
  };

  return (
    <div className="min-h-screen bg-ink text-frost">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-line bg-panel">
        <div className="border-b border-line px-5 py-5">
          <div className="flex items-center gap-3">
            <img
              src="/koudi-mark.svg"
              alt="KOUDI"
              className="h-10 w-10 rounded-xl shadow-lg shadow-black/40 ring-1 ring-amber/40"
            />
            <div>
              <p className="font-display text-lg font-bold tracking-tight text-frost">
                Espace&nbsp;Pro
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-dim">
                {company ? company.company_name : "KOUDI WOOD"}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
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
          <div className="mb-3 text-[11px] leading-relaxed text-dim">
            {company && (
              <p>
                {company.contact_name || "Client"} · {company.company_name}
              </p>
            )}
            <p>Espace réservé aux clients professionnels.</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg px-4 py-2 text-sm font-medium text-dim transition hover:bg-raise hover:text-rose"
          >
            ← Se déconnecter
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="ml-64 flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 border-b border-line bg-ink/80 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-6 py-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-frost">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber" />
              Vivier de bois — Espace Professionnel
            </div>
            <button
              onClick={() => navigate("/")}
              className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ash transition hover:bg-raise hover:text-frost"
            >
              ← Retour au site
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
