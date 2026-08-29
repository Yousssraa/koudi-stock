import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import api from "../../api/client.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { useT } from "../../site/i18n.jsx";
import { categoryImage, fmtPrice, productImage } from "../../site/utils.js";

const PAGE_SIZE = 12;

const CATEGORY_COPY = {
  "Bois de Construction": { title: "Bois de construction", d: "Madriers, bastaings, chevrons, voliges, poteaux et rondins en pin sylvestre et sapin du Nord pour charpente et ossature." },
  "Bois Traité Autoclave": { title: "Bois traité autoclave", d: "Bois traité Cl.3 vert ou Cl.4 marron, adapté aux usages extérieurs et au contact avec le sol." },
  "Bois Feuillus & Nobles": { title: "Feuillus & bois nobles", d: "Chêne, hêtre étuvé et iroko : des essences nobles pour l'ébénisterie et la menuiserie de précision." },
  "Panneaux & Dérivés": { title: "Panneaux & dérivés", d: "Plywood filmé et contreplaqués aux dimensions standard 1,22 × 2,44 m." },
};

export default function Categorie() {
  const { key } = useParams();
  const [params] = useSearchParams();
  const t = useT();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState("name");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const meta = CATEGORY_COPY[key] || {
    title: key,
    d: "Nos produits de cette gamme.",
  };
  useDocumentTitle(`${meta.title} — KOUDI WOOD`);

  const focusId = params.get("produit");
  const focusProduct = products.find((p) => String(p.id) === focusId) || null;

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/public/products/?category=${encodeURIComponent(key)}`)
      .then((r) => setProducts(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Erreur de chargement."))
      .finally(() => setLoading(false));
    setVisible(PAGE_SIZE);
  }, [key]);

  const shown = useMemo(() => {
    const list = [...products];
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
  }, [products, sort]);

  const gridProducts = useMemo(() => {
    const list = [...products];
    if (sort === "price_asc") list.sort((a, b) => Number(a.sale_price) - Number(b.sale_price));
    else if (sort === "price_desc") list.sort((a, b) => Number(b.sale_price) - Number(a.sale_price));
    else if (sort === "new") list.sort((a, b) => (b.id || 0) - (a.id || 0));
    else list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return list.slice(0, visible);
  }, [products, sort, visible]);

  return (
    <div>
      {/* Banner */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: `url(${categoryImage(key)})` }} />
        <div className="relative mx-auto max-w-7xl px-4 py-14 lg:px-6">
          <Link to="/produits" className="text-sm font-medium text-amber hover:underline">← Boutique</Link>
          <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight text-frost">{meta.title}</h1>
          <p className="mt-2 max-w-2xl text-ash">{meta.d}</p>
          <span className="mt-4 inline-block rounded-full bg-amber/10 px-3 py-1 text-xs font-semibold text-amber ring-1 ring-amber/20">
            {products.length} produit(s)
          </span>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
        {error && <p className="mb-6 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{error}</p>}

        {/* Focus product detail */}
        {focusProduct && (
          <div className="mb-10 overflow-hidden rounded-2xl bg-panel shadow-xl shadow-black/10 ring-1 ring-line">
            <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
              <div className="relative h-72 lg:h-full lg:min-h-[380px]">
                <img src={productImage(focusProduct)} alt={focusProduct.name} className="h-full w-full object-cover" />
              </div>
              <div className="p-8 lg:p-10">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber">{t.common.categories}</p>
                <h2 className="font-display mt-2 text-3xl font-extrabold text-frost">{focusProduct.name}</h2>
                <p className="mt-2 text-sm text-dim">{focusProduct.sku}</p>
                <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-xl bg-raise/60 p-3">
                    <dt className="text-dim">Dimensions</dt>
                    <dd className="font-semibold text-frost">{focusProduct.dimensions_display}</dd>
                  </div>
                  <div className="rounded-xl bg-raise/60 p-3">
                    <dt className="text-dim">Essence</dt>
                    <dd className="font-semibold text-frost">{focusProduct.wood_type_name || "—"}</dd>
                  </div>
                  <div className="rounded-xl bg-raise/60 p-3">
                    <dt className="text-dim">Grade</dt>
                    <dd className="font-semibold text-frost">{focusProduct.grade || "—"}</dd>
                  </div>
                  <div className="rounded-xl bg-raise/60 p-3">
                    <dt className="text-dim">{focusProduct.is_panel ? "Surface / unité" : "Volume / unité"}</dt>
                    <dd className="font-semibold text-frost">
                      {focusProduct.is_panel && focusProduct.surface_m2
                        ? `${Number(focusProduct.surface_m2).toFixed(2)} m²`
                        : `${focusProduct.volume_cubic_m} m³`}
                    </dd>
                  </div>
                </dl>
                <div className="mt-6 flex items-center gap-3">
                  <p className="font-display text-3xl font-extrabold text-amber">
                    {fmtPrice(focusProduct.sale_price)} {t.common.mad}
                  </p>
                  <span className="text-sm text-dim">/ {t.common.perM3}</span>
                </div>
                <Link
                  to={`/devis?produit=${focusProduct.id}&sku=${focusProduct.sku}&nom=${encodeURIComponent(focusProduct.name)}`}
                  className="mt-6 inline-block rounded-xl bg-gradient-to-r from-amber to-copper px-6 py-3 text-sm font-semibold text-ink shadow-xl shadow-amber/20 transition hover:brightness-110"
                >
                  Demander un devis →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        {!loading && products.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-ash">{products.length} produit(s)</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-frost outline-none transition focus:border-amber/60 focus:ring-2 focus:ring-amber/20"
            >
              <option value="name">Nom (A–Z)</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
              <option value="new">Nouveautés</option>
            </select>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-lg bg-raise/70 ring-1 ring-line" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl bg-panel py-16 text-center ring-1 ring-line">
            <p className="text-sm text-ash">Aucun produit disponible dans cette gamme pour le moment.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {gridProducts.map((p) => (
                <Link
                  key={p.id}
                  to={`/categorie/${encodeURIComponent(key)}?produit=${p.id}`}
                  className="group overflow-hidden rounded-lg bg-panel ring-1 ring-line transition hover:shadow-lg hover:shadow-black/5"
                >
                  <div className="relative h-32 overflow-hidden sm:h-36">
                    <img src={productImage(p)} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    {p.stock_status === "out_of_stock" && (
                      <span className="absolute left-2 top-2 rounded-full bg-rose px-2 py-0.5 text-[10px] font-semibold text-ink">{t.common.outOfStock}</span>
                    )}
                  </div>
                  <div className="space-y-0.5 p-2.5 sm:p-3">
                    <h3 className="font-display truncate text-sm font-bold text-frost">
                      {p.name}
                      {String(p.id) === focusId && <span className="ml-1.5 text-xs text-amber">●</span>}
                    </h3>
                    <p className="truncate text-xs text-dim">{p.wood_type_name || p.category}</p>
                  </div>
                </Link>
              ))}
            </div>

            {visible < products.length && (
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
  );
}
