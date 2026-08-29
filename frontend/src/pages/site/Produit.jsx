import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/client.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { useT } from "../../site/i18n.jsx";
import { categoryImage, fmtPrice, productImage } from "../../site/utils.js";
import { usagesFor } from "../../site/usages.js";

const CATEGORY_COPY = {
  "Bois de Construction": "Bois de construction",
  "Bois Traité Autoclave": "Bois traité autoclave",
  "Bois Feuillus & Nobles": "Feuillus & bois nobles",
  "Panneaux & Dérivés": "Panneaux & dérivés",
};

export default function Produit() {
  const { id } = useParams();
  const t = useT();
  const [p, setP] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useDocumentTitle(p ? `${p.name} — KOUDI WOOD` : "Produit — KOUDI WOOD");

  useEffect(() => {
    setLoading(true);
    setError(null);
    setP(null);
    api
      .get(`/public/products/${id}/`)
      .then((r) => {
        setP(r.data);
        document.title = `${r.data.name} — KOUDI WOOD`;
        return r.data;
      })
      .then((product) => {
        if (!product?.wood_type_name) return;
        return api
          .get(`/public/products/?species=${encodeURIComponent(product.wood_type_name)}`)
          .then((rr) =>
            setRelated(
              (rr.data || []).filter((x) => Number(x.id) !== Number(product.id)).slice(0, 4)
            )
          );
      })
      .catch((e) => setError(e.response?.data?.detail || "Produit introuvable."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <div className="h-72 animate-pulse rounded-2xl bg-raise/70 ring-1 ring-line" />
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-raise/70 ring-1 ring-line" />
      </div>
    );
  }

  if (error || !p) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center lg:px-6">
        <p className="text-4xl">🪵</p>
        <h1 className="font-display mt-3 text-2xl font-bold text-frost">Produit introuvable</h1>
        <p className="mt-1 text-sm text-ash">{error}</p>
        <Link to="/produits" className="mt-6 inline-block rounded-lg bg-amber px-6 py-2.5 text-sm font-semibold text-ink shadow transition hover:brightness-110">
          ← Retour à la boutique
        </Link>
      </div>
    );
  }

  const unites = p.is_panel && p.surface_m2 ? `${Number(p.surface_m2).toFixed(2)} m²` : `${p.volume_cubic_m} m³`;

  const usage = usagesFor(p);

  const specRows = [
    { label: "Catégorie", value: CATEGORY_COPY[p.category] || p.category },
    { label: "Essence", value: p.wood_type_name || "—" },
    { label: "Type de pièce", value: p.piece_type || "—" },
    { label: "Traitement", value: p.treatment || "—" },
    { label: "Dimensions", value: p.dimensions_display || "—" },
    { label: "Longueur", value: p.length_m != null ? `${p.length_m} m` : "—" },
    { label: p.is_panel ? "Surface / plaque" : "Volume / unité", value: unites },
    { label: "Colis", value: p.colis_number || "—" },
    { label: "Grade", value: p.grade || "—" },
    { label: "Finition", value: p.finish || "—" },
    { label: "Taux d'humidité", value: p.moisture_content != null ? `${p.moisture_content}%` : "—" },
  ];

  return (
    <div>
      {/* Banner */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: `url(${categoryImage(p.category || "Panneaux & Dérivés")})` }} />
        <div className="relative mx-auto max-w-6xl px-4 py-12 lg:px-6">
          <Link to="/produits" className="text-sm font-medium text-amber hover:underline">← Boutique</Link>
          <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-frost sm:text-4xl">{p.name}</h1>
          {p.wood_type_name && (
            <p className="mt-2 inline-block rounded-full bg-amber/10 px-3 py-1 text-xs font-semibold text-amber ring-1 ring-amber/20">
              {t.common.categories} · {p.wood_type_name}
            </p>
          )}
        </div>
      </section>

      {/* Product sheet */}
      <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
        <div className="overflow-hidden rounded-2xl bg-panel shadow-xl shadow-black/10 ring-1 ring-line">
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
            <div className="relative h-72 lg:h-full lg:min-h-[420px]">
              <img src={productImage(p)} alt={p.name} className="h-full w-full object-cover" />
              {p.stock_status === "out_of_stock" && (
                <span className="absolute left-3 top-3 rounded-full bg-rose px-3 py-1 text-xs font-semibold text-ink">{t.common.outOfStock}</span>
              )}
              {p.stock_status === "low" && (
                <span className="absolute left-3 top-3 rounded-full bg-amber px-3 py-1 text-xs font-semibold text-ink">{t.common.lowStock}</span>
              )}
            </div>

            <div className="flex flex-col p-8 lg:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber">{CATEGORY_COPY[p.category] || p.category}</p>
              <h2 className="font-display mt-2 text-3xl font-extrabold text-frost">{p.name}</h2>
              <p className="mt-1 text-sm text-dim">Réf. {p.sku}</p>

              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                {specRows.map((r) => (
                  <div key={r.label} className="rounded-xl bg-raise/60 p-3">
                    <dt className="text-dim">{r.label}</dt>
                    <dd className="font-semibold text-frost">{r.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6 flex items-center gap-3">
                <p className="font-display text-3xl font-extrabold text-amber">
                  {fmtPrice(p.sale_price)} {t.common.mad}
                </p>
                <span className="text-sm text-dim">/ {t.common.perM3}</span>
              </div>

              <div className="mt-auto flex flex-wrap gap-3 pt-6">
                <Link
                  to={`/devis?produit=${p.id}&sku=${p.sku}&nom=${encodeURIComponent(p.name)}`}
                  className="rounded-xl bg-gradient-to-r from-amber to-copper px-6 py-3 text-sm font-semibold text-ink shadow-xl shadow-amber/20 transition hover:brightness-110"
                >
                  Demander un devis →
                </Link>
                <Link to="/contact" className="rounded-xl border border-line bg-panel px-6 py-3 text-sm font-semibold text-frost transition hover:bg-raise">
                  Nous contacter
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Exemples d'utilisation */}
        <section className="mt-14">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-frost">
                Exemples d'utilisation — {usage.title}
              </h2>
              <p className="mt-1 text-sm text-ash">
                Voici quelques exemples de réalisations possibles avec {p.wood_type_name || p.category}.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {usage.uses.map((u, i) => (
              <div key={i} className="group overflow-hidden rounded-xl bg-panel ring-1 ring-line transition hover:shadow-lg hover:shadow-black/5">
                <div className="relative h-44 overflow-hidden">
                  <img src={u.img} alt={u.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
                    Exemple d'usage
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-display text-base font-bold text-frost">{u.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ash">{u.desc}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {u.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-amber/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber ring-1 ring-amber/20">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Related products — same essence */}
        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display mb-6 text-2xl font-bold tracking-tight text-frost">
              Plus de produits en {p.wood_type_name}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/produit/${r.id}`}
                  className="group overflow-hidden rounded-lg bg-panel ring-1 ring-line transition hover:shadow-lg hover:shadow-black/5"
                >
                  <div className="relative h-28 overflow-hidden sm:h-32">
                    <img src={productImage(r)} alt={r.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  </div>
                  <div className="space-y-0.5 p-2.5 sm:p-3">
                    <h3 className="font-display truncate text-sm font-bold text-frost">{r.name}</h3>
                    <p className="truncate text-xs text-dim">{r.dimensions_display || r.wood_type_name}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
