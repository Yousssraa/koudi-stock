import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { useT } from "../../site/i18n.jsx";
import { fmtPrice, productImage } from "../../site/utils.js";

const PAGE_SIZE = 12;

export default function Produits() {
  useDocumentTitle("Boutique — KOUDI WOOD");
  const t = useT();
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState("name");
  const [perRow, setPerRow] = useState(3);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/public/categories/").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search.trim()) params.set("search", search.trim());
    if (inStock) params.set("in_stock", "1");
    api
      .get(`/public/products/?${params.toString()}`)
      .then((r) => setAllProducts(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Erreur de chargement."))
      .finally(() => setLoading(false));
    setVisible(PAGE_SIZE);
  }, [category, search, inStock]);

  const shown = useMemo(() => {
    const list = [...allProducts];
    switch (sort) {
      case "price_asc":
        list.sort((a, b) => Number(a.sale_price) - Number(b.sale_price));
        break;
      case "price_desc":
        list.sort((a, b) => Number(b.sale_price) - Number(a.sale_price));
        break;
      case "new":
        list.sort((a, b) => (b.id || 0) - (a.id || 0));
        break;
      default:
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return list;
  }, [allProducts, sort]);

  const page = shown.slice(0, visible);

  const gridCls =
    perRow === 4
      ? "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      : perRow === 2
      ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2"
      : "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3";

  const inputCls =
    "rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-frost outline-none transition placeholder:text-dim focus:border-amber/60 focus:ring-2 focus:ring-amber/20";

  const sortLabels = {
    name: "Nom (A–Z)",
    price_asc: "Prix croissant",
    price_desc: "Prix décroissant",
    new: "Nouveautés",
  };

  return (
    <div className="border-t border-line">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-frost">Boutique</h1>
            <p className="mt-1 text-sm text-ash">Trouvez le bois, panneau ou produit de coffrage adapté à votre projet.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
          {/* Sidebar */}
          <aside className="space-y-6">
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-dim">Catégories</h2>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => setCategory("")}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                      category === "" ? "bg-amber/10 font-semibold text-amber ring-1 ring-amber/20" : "text-frost hover:bg-raise"
                    }`}
                  >
                    <span>Tout afficher</span>
                    <span className="text-xs text-dim">{allProductsTotal(categories)}</span>
                  </button>
                </li>
                {categories.map((c) => (
                  <li key={c.key}>
                    <button
                      onClick={() => setCategory(category === c.key ? "" : c.key)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                        category === c.key ? "bg-amber/10 font-semibold text-amber ring-1 ring-amber/20" : "text-frost hover:bg-raise"
                      }`}
                    >
                      <span>{c.label}</span>
                      <span className="text-xs text-dim">{c.product_count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-dim">Filtres</h2>
              <div className="space-y-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className={`${inputCls} w-full`}
                />
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ash">
                  <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="accent-amber" />
                  En stock uniquement
                </label>
              </div>
            </div>
          </aside>

          {/* Main */}
          <div>
            {error && <p className="mb-6 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{error}</p>}

            {/* Toolbar */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-ash">{shown.length} produit(s)</span>
              <div className="flex items-center gap-2">
                <select value={sort} onChange={(e) => setSort(e.target.value)} className={inputCls}>
                  <option value="name">{sortLabels.name}</option>
                  <option value="price_asc">{sortLabels.price_asc}</option>
                  <option value="price_desc">{sortLabels.price_desc}</option>
                  <option value="new">{sortLabels.new}</option>
                </select>
                <div className="flex items-center gap-1 rounded-lg border border-line bg-panel p-1">
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setPerRow(n)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                        perRow === n ? "bg-amber text-ink" : "text-dim hover:bg-raise"
                      }`}
                      title={`${n} par rangée`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-lg bg-raise/70 ring-1 ring-line" />
                ))}
              </div>
            ) : page.length === 0 ? (
              <div className="rounded-xl bg-panel py-16 text-center ring-1 ring-line">
                <p className="text-3xl">🪵</p>
                <p className="mt-3 font-display font-bold text-frost">Aucun produit ne correspond à votre recherche.</p>
                <p className="mt-1 text-sm text-ash">Essayez de modifier vos filtres.</p>
              </div>
            ) : (
              <>
                <div className={gridCls}>
                  {page.map((p) => (
                    <div
                      key={p.id}
                      className="group overflow-hidden rounded-lg bg-panel ring-1 ring-line transition hover:shadow-lg hover:shadow-black/5"
                    >
                      <Link
                        to={`/produit/${p.id}`}
                        className="block"
                      >
                        <div className="relative h-24 overflow-hidden sm:h-28">
                          <img src={productImage(p)} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                          {p.stock_status === "out_of_stock" && (
                            <span className="absolute left-2 top-2 rounded-full bg-rose px-2 py-0.5 text-[10px] font-semibold text-ink">
                              {t.common.outOfStock}
                            </span>
                          )}
                          {p.stock_status === "low" && (
                            <span className="absolute left-2 top-2 rounded-full bg-amber px-2 py-0.5 text-[10px] font-semibold text-ink">
                              {t.common.lowStock}
                            </span>
                          )}
                        </div>
                      </Link>
                      <div className="p-2 sm:p-2.5">
                        <Link to={`/produit/${p.id}`} className="block">
                          <h3 className="font-display truncate text-xs font-bold text-frost transition group-hover:text-amber">{p.name}</h3>
                          <p className="truncate text-[11px] text-dim">{p.wood_type_name || p.category}</p>
                          {p.piece_type && <p className="mt-0.5 truncate text-[10px] text-ash">{p.piece_type}{p.treatment ? ` · ${p.treatment}` : ""}</p>}
                          <p className="mt-1 text-xs font-semibold text-amber">
                            {fmtPrice(p.sale_price)} {t.common.mad} <span className="font-normal text-dim">/ {t.common.perM3}</span>
                          </p>
                        </Link>
                        <Link
                          to={`/produit/${p.id}`}
                          className="mt-2.5 flex items-center justify-center rounded-lg bg-gradient-to-r from-amber to-copper px-2.5 py-1.5 text-[11px] font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110"
                        >
                          Découvrir →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {visible < shown.length && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={() => setVisible((v) => v + PAGE_SIZE)}
                      className="rounded-full border border-line bg-panel px-6 py-2.5 text-sm font-semibold text-frost transition hover:bg-raise"
                    >
                      Charger plus de produits
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function allProductsTotal(cats) {
  return cats.reduce((s, c) => s + (c.product_count || 0), 0);
}
