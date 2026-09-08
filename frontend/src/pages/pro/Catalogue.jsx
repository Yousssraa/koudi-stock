import { useEffect, useState } from "react";
import proApi from "../../api/proClient.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import StockBadge from "../../components/StockBadge.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import { fmtMAD, fmtNum } from "./helpers.jsx";

const CATEGORIES = [
  "Bois de Construction",
  "Bois Traité Autoclave",
  "Bois Feuillus & Nobles",
  "Panneaux & Dérivés",
];

export default function ProCatalogue() {
  useDocumentTitle("Espace Pro — Catalogue & Tarifs");
  const [products, setProducts] = useState(null);
  const [tiers, setTiers] = useState(null);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState("");
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

  const filtered = (products || []).filter(
    (p) =>
      (!category || p.category === category) &&
      (!search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  if (error) {
    return (
      <div className="rounded-2xl bg-rose/10 px-5 py-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-frost">
          Catalogue &amp; Tarifs
        </h1>
        <p className="mt-1 text-sm text-ash">
          Retrouvez nos essences, leurs dimensions et nos tarifs professionnels.
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un produit…"
          className="w-full max-w-xs rounded-lg border border-line bg-panel px-3 py-2 text-sm text-frost outline-none placeholder:text-dim focus:border-amber/60"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory("")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ${
              !category
                ? "bg-gradient-to-r from-amber to-copper text-ink ring-transparent"
                : "bg-panel text-ash ring-line hover:text-frost"
            }`}
          >
            Toutes
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ${
                category === c
                  ? "bg-gradient-to-r from-amber to-copper text-ink ring-transparent"
                  : "bg-panel text-ash ring-line hover:text-frost"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      {!products && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}

      {products && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex flex-col rounded-2xl bg-panel p-5 shadow-lg shadow-black/20 ring-1 ring-line transition hover:ring-amber/30"
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

          {filtered.length === 0 && (
            <div className="col-span-full rounded-2xl bg-panel px-6 py-14 text-center ring-1 ring-line">
              <p className="text-sm text-dim">Aucun produit ne correspond à votre recherche.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}