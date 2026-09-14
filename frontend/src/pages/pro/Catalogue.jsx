import { useEffect, useState } from "react";
import proApi from "../../api/proClient.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import StockBadge from "../../components/StockBadge.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import { fmtMAD, fmtNum } from "./helpers.jsx";
import { FAMILLES } from "../../site/familles.js";

// Association entre les familles de la boutique et les catégories produits.
const FAMILLE_TO_CATEGORIES = {
  "bois-menuiserie": ["Bois Massif"],
  "panneaux-decoratifs": ["Panneaux", "Panneaux Portes"],
  "produits-coffrage": ["Bois de Coffrage"],
  "isolation-etancheite": [],
  "amenagement-interieur": ["Cuisine & Aménagement", "Parquet"],
  "amenagement-exterieur": ["Aménagement Extérieur"],
};

const familleProducts = (familleKey, products) =>
  (products || []).filter((p) =>
    (FAMILLE_TO_CATEGORIES[familleKey] || []).includes(p.category)
  );

export default function ProCatalogue() {
  useDocumentTitle("Espace Pro — Catalogue & Tarifs");
  const [products, setProducts] = useState(null);
  const [tiers, setTiers] = useState(null);
  const [error, setError] = useState(null);
  const [famille, setFamille] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([proApi.get("/pro/catalog/"), proApi.get("/pro/tiers/")])
      .then(([cat, t]) => {
        setProducts(cat.data);
        setTiers(t.data);
      })
      .catch((err) =>
        setError(err.response?.data?.detail || "Impossible de charger le catalogue.")
      );
  }, []);

  const q = search.trim().toLowerCase();
  const matches = (p) =>
    !q ||
    p.name.toLowerCase().includes(q) ||
    String(p.sku || "").toLowerCase().includes(q);

  const currentFamille = famille
    ? FAMILLES.find((f) => f.key === famille)
    : null;

  if (error) {
    return (
      <div className="rounded-2xl bg-rose/10 px-5 py-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-frost">
          Catalogue &amp; Tarifs
        </h1>
        <p className="mt-1 text-sm text-ash">
          Retrouvez nos essences, leurs dimensions et nos tarifs professionnels, organisés par gamme.
        </p>
      </div>

      {tiers && (
        <div className="rounded-2xl bg-panel p-5 shadow-lg shadow-black/20 ring-1 ring-line">
          <p className="mb-3 text-sm font-semibold text-frost">Remises selon le volume commandé</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tiers.map((t) => (
              <div
                key={t.name}
                className="rounded-xl border border-amber/30 bg-amber/5 p-4 text-center"
              >
                <p className="font-display text-2xl font-bold text-amber">−{fmtNum(t.discount_percent, 0)}%</p>
                <p className="mt-1 text-sm font-semibold text-frost">{t.name}</p>
                <p className="mt-0.5 text-xs text-dim">
                  dès {fmtNum(t.min_volume_m3)} m³
                  {t.max_volume_m3 ? ` · jusqu'à ${fmtNum(t.max_volume_m3)} m³` : " et plus"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recherche */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un produit…"
          className="w-full max-w-xs rounded-lg border border-line bg-panel px-3 py-2 text-sm text-frost outline-none placeholder:text-dim focus:border-amber/60"
        />
      </div>

      {/* Gammes — mêmes cartes que la boutique */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FAMILLES.map((fam) => {
          const active = famille === fam.key;
          const count = familleProducts(fam.key, products).filter(matches).length;
          return (
            <button
              key={fam.key}
              onClick={() => setFamille(active ? "" : fam.key)}
              className={`group overflow-hidden rounded-xl bg-panel text-left ring-1 transition hover:shadow-lg hover:shadow-black/5 ${
                active ? "ring-2 ring-amber" : "ring-line hover:ring-amber/30"
              }`}
            >
              <div className="relative h-28 overflow-hidden">
                <img src={fam.image} alt={fam.label} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <span className="absolute right-2 top-2 rounded-full bg-ink/80 px-2.5 py-0.5 text-[11px] font-semibold text-amber ring-1 ring-amber/40">
                  {count} produit{count > 1 ? "s" : ""}
                </span>
              </div>
              <div className="p-3 sm:p-4">
                <h3 className="font-display text-sm font-extrabold leading-snug tracking-tight text-frost group-hover:text-amber">
                  {fam.label}
                </h3>
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-ash">{fam.description}</p>
                <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber">
                  {active ? "Masquer les tarifs ▲" : "Voir les tarifs ▼"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sections produits par gamme */}
      {!products && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-panel p-5 ring-1 ring-line">
              <Skeleton className="h-6 w-1/3" />
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((j) => (
                  <Skeleton key={j} className="h-40" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {products &&
        FAMILLES.filter((f) => !currentFamille || f.key === currentFamille.key).map((fam) => {
          const famProds = familleProducts(fam.key, products).filter(matches);
          if (famProds.length === 0 && !currentFamille) return null;
          if (famProds.length === 0 && currentFamille) {
            return (
              <div key={fam.key} className="rounded-2xl bg-panel px-6 py-14 text-center ring-1 ring-line">
                <p className="text-sm text-dim">Aucun produit ne correspond à votre recherche dans cette gamme.</p>
              </div>
            );
          }
          return (
            <section key={fam.key} className="overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
              {/* Bandeau gamme (style boutique) */}
              <div className="relative h-40 overflow-hidden">
                <img src={fam.image} alt={fam.label} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber">{fam.examples.length} exemples</p>
                  <h2 className="font-display text-xl font-extrabold tracking-tight text-white sm:text-2xl">{fam.label}</h2>
                  <p className="mt-1 max-w-2xl text-xs text-white/80">{fam.description}</p>
                </div>
              </div>

              {/* Exemples de la gamme (mêmes cartes que la boutique) */}
              <div className="grid grid-cols-1 gap-4 border-b border-line p-5 sm:grid-cols-3 sm:p-6">
                {fam.examples.map((ex) => (
                  <div key={ex.name} className="flex flex-col overflow-hidden rounded-xl bg-raise ring-1 ring-line">
                    <div className="relative h-28 overflow-hidden">
                      <img src={ex.image} alt={ex.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber">{ex.essence}</p>
                      <p className="mt-1 font-display text-sm font-bold text-frost">{ex.name}</p>
                      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-ash">{ex.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tarifs réels de la gamme */}
              <div className="p-5 sm:p-6">
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold text-frost">Tarifs de la gamme</h3>
                    <p className="text-xs text-ash">{famProds.length} produit{famProds.length > 1 ? "s" : ""} · par m³ (ou m² pour les panneaux)</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {famProds.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col rounded-2xl bg-raise p-5 ring-1 ring-line transition hover:ring-amber/30"
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-frost">{p.name}</p>
                          <p className="text-xs text-dim">{p.sku}</p>
                        </div>
                        <StockBadge status={p.stock_status} />
                      </div>

                      <div className="mb-3 space-y-1 text-xs text-ash">
                        <p>
                          <span className="text-dim">Essence :</span> {p.wood_type_name || "—"}
                        </p>
                        <p>
                          <span className="text-dim">Dimensions :</span> {p.dimensions_display}
                        </p>
                        <p>
                          <span className="text-dim">Traitement :</span> {p.treatment || "—"}
                        </p>
                        <p>
                          <span className="text-dim">Volume unitaire :</span> {fmtNum(p.volume_cubic_m)} m³
                        </p>
                      </div>

                      <div className="mt-auto flex items-end justify-between border-t border-line pt-3">
                        <div>
                          <p className="text-[11px] text-dim">Prix pro</p>
                          <p className="font-display text-xl font-bold text-amber">{fmtMAD(p.sale_price)}</p>
                          <p className="text-[11px] text-dim">par m³ · HT</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-dim">Stock</p>
                          <p className="text-sm font-semibold text-frost">{fmtNum(p.total_stock_qty)} unité{p.total_stock_qty > 1 ? "s" : ""}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
    </div>
  );
}