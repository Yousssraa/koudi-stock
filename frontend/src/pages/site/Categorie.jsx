import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import api from "../../api/client.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { useT } from "../../site/i18n.jsx";
import { categoryImage, fmtPrice, productImage } from "../../site/utils.js";

const CATEGORY_COPY = {
  "Bois rouge": { title: "Bois rouges (pins nordiques)", d: "Des pins clairs et résineux, très appréciés pour la menuiserie et la charpente." },
  "Bois blanc": { title: "Bois blancs (épicéa)", d: "L'épicéa et le sapin pour ossature, charpente légère et lambris." },
  "Bois exotique": { title: "Bois exotiques", d: "Sapelli, iroko, kossipo, dibétou : des essence tropicales durables." },
  "Bois noble": { title: "Bois nobles", d: "Chêne, noyer et autres essences nobles pour des réalisations d'exception." },
  "Panneaux": { title: "Panneaux & dérivés", d: "MDF, OSB, contreplaqué, latté et stratifié pour tous vos projets." },
  "Coffrage": { title: "Coffrage & construction", d: "Panneaux de coffrage, bakélisés et poutrelles pour le BTP." },
};

export default function Categorie() {
  const { key } = useParams();
  const [params] = useSearchParams();
  const t = useT();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const meta = CATEGORY_COPY[key] || {
    title: key,
    d: "Nos produits de cette gamme.",
  };
  useDocumentTitle(`${meta.title} — KOUDI WOOD`);

  const focusId = params.get("produit");
  const focusProduct = products.find((p) => String(p.id) === focusId) || null;

  useEffect(() => {
    setLoading(true);
    api
      .get(`/public/products/?category=${encodeURIComponent(key)}`)
      .then((r) => setProducts(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Erreur de chargement."))
      .finally(() => setLoading(false));
  }, [key]);

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
                    <dt className="text-dim">Volume / unité</dt>
                    <dd className="font-semibold text-frost">{focusProduct.volume_cubic_m} m³</dd>
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

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-raise/70 ring-1 ring-line" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl bg-panel py-20 text-center ring-1 ring-line">
            <p className="text-sm text-ash">Aucun produit disponible dans cette gamme pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link
                key={p.id}
                to={`/categorie/${encodeURIComponent(key)}?produit=${p.id}`}
                className="group overflow-hidden rounded-2xl bg-panel shadow-lg shadow-black/5 ring-1 ring-line transition hover:-translate-y-1 hover:shadow-2xl"
              >
                <div className="relative h-44 overflow-hidden">
                  <img src={productImage(p)} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  {p.stock_status === "out_of_stock" && (
                    <span className="absolute left-3 top-3 rounded-full bg-rose px-3 py-1 text-xs font-semibold text-ink">{t.common.outOfStock}</span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-display truncate text-base font-bold text-frost">
                    {p.name}
                    {String(p.id) === focusId && <span className="ml-2 text-xs text-amber">●</span>}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-dim">{p.dimensions_display}</p>
                  <p className="mt-3 text-sm">
                    <span className="font-display text-lg font-bold text-amber">{fmtPrice(p.sale_price)} {t.common.mad}</span>
                    <span className="text-xs text-dim"> / {t.common.perM3}</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
