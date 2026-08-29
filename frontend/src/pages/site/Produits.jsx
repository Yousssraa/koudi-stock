import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { useT } from "../../site/i18n.jsx";
import { fmtPrice, productImage } from "../../site/utils.js";

export default function Produits() {
  useDocumentTitle("Boutique — KOUDI WOOD");
  const t = useT();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [inStock, setInStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/public/categories/").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search.trim()) params.set("search", search.trim());
    if (inStock) params.set("in_stock", "1");
    api
      .get(`/public/products/?${params.toString()}`)
      .then((r) => setProducts(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Erreur de chargement."))
      .finally(() => setLoading(false));
  }, [category, search, inStock]);

  const shown = useMemo(() => products, [products]);

  const inputCls =
    "rounded-xl border border-line bg-panel px-4 py-2.5 text-sm text-frost outline-none transition placeholder:text-dim focus:border-amber/60 focus:ring-2 focus:ring-amber/20";

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-frost">Boutique</h1>
        <p className="mx-auto mt-2 max-w-2xl text-ash">
          Nos bois massifs, panneaux et dérivés. Filtrez par gamme ou par disponibilité.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
          <option value="">{t.common.allCategories}</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label} ({c.product_count})
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un produit…"
          className={`${inputCls} min-w-52 flex-1`}
        />
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-panel px-4 py-2.5 text-sm text-ash">
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="accent-amber" />
          En stock uniquement
        </label>
        <span className="ml-auto text-sm text-dim">{shown.length} produit(s)</span>
      </div>

      {error && <p className="mb-6 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-raise/70 ring-1 ring-line" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl bg-panel py-20 text-center ring-1 ring-line">
          <p className="text-4xl">🪵</p>
          <p className="mt-3 font-display font-bold text-frost">Aucun produit ne correspond à votre recherche.</p>
          <p className="mt-1 text-sm text-ash">Essayez de modifier vos filtres ou contactez-nous.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((p) => (
            <Link
              key={p.id}
              to={`/categorie/${encodeURIComponent(p.category || "Panneaux")}?produit=${p.id}`}
              className="group overflow-hidden rounded-2xl bg-panel shadow-lg shadow-black/5 ring-1 ring-line transition hover:-translate-y-1 hover:shadow-2xl"
            >
              <div className="relative h-44 overflow-hidden">
                <img src={productImage(p)} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                {p.stock_status === "out_of_stock" && (
                  <span className="absolute left-3 top-3 rounded-full bg-rose px-3 py-1 text-xs font-semibold text-ink">
                    {t.common.outOfStock}
                  </span>
                )}
                {p.stock_status === "low" && (
                  <span className="absolute left-3 top-3 rounded-full bg-amber px-3 py-1 text-xs font-semibold text-ink">
                    {t.common.lowStock}
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-display truncate text-base font-bold text-frost">{p.name}</h3>
                <p className="mt-0.5 truncate text-xs text-dim">{p.dimensions_display}</p>
                <p className="mt-1 text-xs text-dim">{p.wood_type_name || p.category}</p>
                <p className="mt-3 text-sm">
                  <span className="font-display text-lg font-bold text-amber">
                    {fmtPrice(p.sale_price)} {t.common.mad}
                  </span>
                  <span className="text-xs text-dim"> / {t.common.perM3}</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
