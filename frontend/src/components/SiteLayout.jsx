import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import api from "../api/client.js";
import { SiteLangProvider, useSiteLang, useT } from "../site/i18n.jsx";

const SOCIALS = [
  { name: "Facebook", href: "https://facebook.com" },
  { name: "Instagram", href: "https://instagram.com" },
  { name: "LinkedIn", href: "https://linkedin.com" },
];

function Topbar() {
  const { lang, setLanguage } = useSiteLang();
  const [company, setCompany] = useState(null);

  useEffect(() => {
    api
      .get("/public/company/")
      .then((res) => setCompany(res.data))
      .catch(() => setCompany(null));
  }, []);

  return (
    <div className="border-b border-line bg-panel/80 text-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 lg:px-6">
        <div className="flex items-center gap-4 text-ash">
          {company?.phone && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden>☎</span> {company.phone}
            </span>
          )}
          {company?.email && (
            <span className="hidden items-center gap-1.5 sm:flex">
              <span aria-hidden>✉</span> {company.email}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {SOCIALS.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                title={s.name}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ash transition hover:bg-amber hover:text-ink"
              >
                <span aria-hidden>{s.name === "Facebook" ? "f" : s.name === "Instagram" ? "◎" : "in"}</span>
              </a>
            ))}
          </div>
          <span className="h-4 w-px bg-line" />
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLanguage("fr")}
              className={`rounded px-2 py-0.5 font-semibold transition ${
                lang === "fr" ? "bg-amber text-ink" : "text-ash hover:text-frost"
              }`}
            >
              FR
            </button>
            <span className="text-dim">/</span>
            <button
              onClick={() => setLanguage("en")}
              className={`rounded px-2 py-0.5 font-semibold transition ${
                lang === "en" ? "bg-amber text-ink" : "text-ash hover:text-frost"
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Navbar() {
  const t = useT();
  const [categories, setCategories] = useState([]);
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api
      .get("/public/categories/")
      .then((res) => setCategories(res.data))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setMegaOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  const linkBase =
    "relative rounded-lg px-3 py-2 text-sm font-medium text-frost transition hover:text-amber";

  return (
    <div className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/koudi-mark.svg"
            alt="KOUDI WOOD"
            className="h-11 w-11 rounded-xl shadow-lg shadow-black/20 ring-1 ring-amber/40"
          />
          <div className="leading-tight">
            <p className="font-display text-xl font-bold tracking-tight text-frost">KOUDI WOOD</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-dim">Casablanca · Bois &amp; Panneaux</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? "text-amber" : ""}`}>
            {t.nav.accueil}
          </NavLink>

          <div className="relative" onMouseEnter={() => setMegaOpen(true)} onMouseLeave={() => setMegaOpen(false)}>
            <button className={`${linkBase} inline-flex items-center gap-1`}>
              {t.nav.produits}
              <span aria-hidden className="text-[10px]">▾</span>
            </button>
            {megaOpen && (
              <div className="absolute left-0 top-full mt-2 w-[560px] rounded-2xl bg-panel p-4 shadow-2xl shadow-black/20 ring-1 ring-line">
                <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-dim">
                  {t.common.categories}
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {categories.map((c) => (
                    <Link
                      key={c.key}
                      to={`/categorie/${encodeURIComponent(c.key)}`}
                      className="group flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-raise"
                    >
                      <span className="text-sm font-medium text-frost group-hover:text-amber">{c.label}</span>
                      <span className="rounded-full bg-amber/10 px-2 py-0.5 text-xs text-amber ring-1 ring-amber/20">
                        {c.product_count}
                      </span>
                    </Link>
                  ))}
                </div>
                <Link
                  to="/produits"
                  className="mt-3 block rounded-xl bg-gradient-to-r from-amber to-copper px-4 py-3 text-center text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110"
                >
                  {t.nav.boutiques} →
                </Link>
              </div>
            )}
          </div>

          <NavLink to="/produits" end className={({ isActive }) => `${linkBase} ${isActive ? "text-amber" : ""}`}>
            {t.nav.boutiques}
          </NavLink>
          <NavLink to="/devis" className={({ isActive }) => `${linkBase} ${isActive ? "text-amber" : ""}`}>
            {t.nav.devis}
          </NavLink>
          <NavLink to="/contact" className={({ isActive }) => `${linkBase} ${isActive ? "text-amber" : ""}`}>
            {t.nav.contact}
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/app/login"
            className="hidden rounded-lg bg-gradient-to-r from-amber to-copper px-4 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110 sm:inline-block"
          >
            {t.nav.espacePro}
          </Link>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setMobileOpen((v) => !v);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel text-frost lg:hidden"
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            ☰
          </a>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-panel px-4 py-4 lg:hidden">
          <nav className="grid grid-cols-1 gap-1">
            <Link to="/" className="rounded-lg px-3 py-2.5 text-sm font-medium text-frost hover:bg-raise">🗂 {t.nav.accueil}</Link>
            <Link to="/produits" className="rounded-lg px-3 py-2.5 text-sm font-medium text-frost hover:bg-raise">🛒 {t.nav.boutiques}</Link>
            <Link to="/devis" className="rounded-lg px-3 py-2.5 text-sm font-medium text-frost hover:bg-raise">📄 {t.nav.devis}</Link>
            <Link to="/contact" className="rounded-lg px-3 py-2.5 text-sm font-medium text-frost hover:bg-raise">✉ {t.nav.contact}</Link>
            <Link to="/app/login" className="rounded-lg bg-gradient-to-r from-amber to-copper px-3 py-2.5 text-center text-sm font-semibold text-ink">
              {t.nav.espacePro}
            </Link>
            <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-dim">
              {t.common.categories}
            </p>
            {categories.map((c) => (
              <Link
                key={c.key}
                to={`/categorie/${encodeURIComponent(c.key)}`}
                className="rounded-lg px-3 py-2 text-sm text-ash hover:bg-raise hover:text-frost"
              >
                {c.label} <span className="text-dim">({c.product_count})</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

function Footer() {
  const t = useT();
  const [categories, setCategories] = useState([]);
  const [company, setCompany] = useState(null);

  useEffect(() => {
    api.get("/public/categories/").then((r) => setCategories(r.data)).catch(() => {});
    api.get("/public/company/").then((r) => setCompany(r.data)).catch(() => {});
  }, []);

  return (
    <footer className="border-t border-line bg-panel">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <div>
          <div className="flex items-center gap-3">
            <img
              src="/koudi-mark.svg"
              alt="KOUDI WOOD"
              className="h-10 w-10 rounded-xl ring-1 ring-amber/40"
            />
            <p className="font-display text-lg font-bold text-frost">KOUDI WOOD</p>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ash" dangerouslySetInnerHTML={{ __html: t.common.footerTagline }} />
          {company?.ice && <p className="mt-3 text-xs text-dim">ICE : {company.ice}</p>}
          {company?.registre_commerce && (
            <p className="text-xs text-dim">Registre de commerce : {company.registre_commerce}</p>
          )}
        </div>

        <div>
          <p className="font-display mb-3 text-sm font-bold uppercase tracking-[0.15em] text-frost">
            {t.common.categories}
          </p>
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.key}>
                <Link to={`/categorie/${encodeURIComponent(c.key)}`} className="text-sm text-ash transition hover:text-amber">
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-display mb-3 text-sm font-bold uppercase tracking-[0.15em] text-frost">Navigation</p>
          <ul className="space-y-2 text-sm text-ash">
            <li><Link to="/" className="transition hover:text-amber">{t.nav.accueil}</Link></li>
            <li><Link to="/produits" className="transition hover:text-amber">{t.nav.boutiques}</Link></li>
            <li><Link to="/devis" className="transition hover:text-amber">{t.nav.devis}</Link></li>
            <li><Link to="/contact" className="transition hover:text-amber">{t.nav.contact}</Link></li>
          </ul>
        </div>

        <div>
          <p className="font-display mb-3 text-sm font-bold uppercase tracking-[0.15em] text-frost">Contact</p>
          <ul className="space-y-2 text-sm text-ash">
            {company?.address && <li>{company.address}</li>}
            {company?.phone && (
              <li>
                <a href={`tel:${company.phone}`} className="transition hover:text-amber">{company.phone}</a>
              </li>
            )}
            {company?.email && (
              <li>
                <a href={`mailto:${company.email}`} className="transition hover:text-amber">{company.email}</a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-dim">
        © {new Date().getFullYear()} KOUDI WOOD — Tous droits réservés.
      </div>
    </footer>
  );
}

export default function SiteLayout() {
  return (
    <SiteLangProvider>
      <div className="flex min-h-screen flex-col bg-ink text-frost">
        <Topbar />
        <Navbar />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </SiteLangProvider>
  );
}
