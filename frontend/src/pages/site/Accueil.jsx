import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { useT } from "../../site/i18n.jsx";
import { categoryImage, productImage } from "../../site/utils.js";

const CATEGORY_COPY = {
  "Bois rouge": { d: "Pins des pays nordiques, clairs et résineux." },
  "Bois blanc": { d: "Épicéa et sapins pour charpente et ossature." },
  "Bois exotique": { d: "Sapelli, iroko, kossipo : durabilité tropicale." },
  "Bois noble": { d: "Chêne, noyer : essences nobles durables." },
  "Panneaux": { d: "MDF, OSB, contreplaqué, latté et stratifié." },
  "Coffrage": { d: "Panneaux bâchés et poutrelles pour le BTP." },
};

function SectionTitle({ children }) {
  return (
    <div className="mb-2 flex items-center gap-3">
      <span className="h-6 w-1 rounded-full bg-gradient-to-b from-amber to-copper" />
      <h2 className="font-display text-2xl font-bold tracking-tight text-frost sm:text-3xl">{children}</h2>
    </div>
  );
}

export default function Accueil() {
  useDocumentTitle("KOUDI WOOD — Bois massifs & panneaux sur mesure");
  const t = useT();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadErr, setLoadErr] = useState(null);

  useEffect(() => {
    api
      .get("/public/categories/")
      .then((r) => setCategories(r.data))
      .catch(() => setLoadErr("Impossible de charger les catégories."));
    api
      .get("/public/products/?in_stock=1")
      .then((r) => setProducts(r.data))
      .catch(() => {});
  }, []);

  const featured = products.slice(0, 8);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: `url(${categoryImage("Bois noble")})` }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-20 lg:px-6 lg:py-28">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-amber ring-1 ring-amber/20">
              <span aria-hidden>◆</span>
              <span dangerouslySetInnerHTML={{ __html: t.hero.eyebrow }} />
            </p>
            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-frost sm:text-5xl lg:text-6xl">
              <span dangerouslySetInnerHTML={{ __html: t.hero.title1 }} />
              <br />
              <span className="bg-gradient-to-r from-amber to-copper bg-clip-text text-transparent">
                <span dangerouslySetInnerHTML={{ __html: t.hero.title2 }} />
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ash"
              dangerouslySetInnerHTML={{ __html: t.hero.subtitle }} />
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/produits"
                className="rounded-xl bg-gradient-to-r from-amber to-copper px-6 py-3 text-sm font-semibold text-ink shadow-xl shadow-amber/20 transition hover:brightness-110"
              >
                {t.hero.ctaProducts} →
              </Link>
              <Link
                to="/devis"
                className="rounded-xl border border-line bg-panel px-6 py-3 text-sm font-semibold text-frost shadow-lg shadow-black/5 transition hover:bg-raise"
              >
                {t.hero.ctaDevis}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
        <SectionTitle>{t.common.categories}</SectionTitle>
        <p className="mb-8 text-sm text-ash">Explorez nos gammes de bois et panneaux.</p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {categories.map((c) => (
            <Link
              key={c.key}
              to={`/categorie/${encodeURIComponent(c.key)}`}
              className="group overflow-hidden rounded-lg bg-panel ring-1 ring-line transition hover:shadow-lg hover:shadow-black/5"
            >
              <div className="relative h-32 overflow-hidden">
                <img
                  src={categoryImage(c.key)}
                  alt={c.label}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-3">
                <h3 className="font-display truncate text-sm font-bold text-frost group-hover:text-amber">{c.label}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ash">{CATEGORY_COPY[c.key]?.d}</p>
                <p className="mt-2 text-xs font-semibold text-amber">Découvrir →</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="border-y border-line bg-panel/60">
        <div className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <SectionTitle>Produits en stock</SectionTitle>
              <p className="text-sm text-ash">Une sélection de nos produits disponibles immédiatement.</p>
            </div>
            <Link to="/produits" className="text-sm font-semibold text-amber hover:underline">
              Voir toute la boutique →
            </Link>
          </div>
          {loadErr && <p className="mb-4 text-sm text-rose">{loadErr}</p>}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {featured.map((p) => (
              <Link
                key={p.id}
                to={`/categorie/${encodeURIComponent(p.category || "Panneaux")}?produit=${p.id}`}
                className="group overflow-hidden rounded-lg bg-panel ring-1 ring-line transition hover:shadow-lg hover:shadow-black/5"
              >
                <div className="relative h-32 overflow-hidden sm:h-36">
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
                <div className="space-y-0.5 p-2.5 sm:p-3">
                  <h3 className="font-display truncate text-sm font-bold text-frost">{p.name}</h3>
                  <p className="truncate text-xs text-dim">{p.wood_type_name || p.category}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { icon: "₥³", title: "Prix au m³", d: "Tarification transparente au volume, découpe sur mesure selon vos dimensions." },
            { icon: "🚛", title: "Livraison au Maroc", d: "Depuis nos entrepôts de Casablanca, nous livrons sur tout le territoire." },
            { icon: "🌳", title: "Bois de qualité", d: "Essences sélectionnées, séchage maîtrisé et contrôle de l'humidité." },
          ].map((v) => (
            <div key={v.title} className="rounded-2xl bg-panel p-6 shadow-lg shadow-black/5 ring-1 ring-line">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber/10 text-xl font-bold text-amber ring-1 ring-amber/20">
                {v.icon}
              </span>
              <h3 className="font-display mt-4 text-lg font-bold text-frost">{v.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ash">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-16 lg:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber to-copper p-10 text-center shadow-2xl shadow-amber/30">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url(${categoryImage("Bois noble")})`, backgroundSize: "cover" }} />
          <div className="relative">
            <h2 className="font-display text-3xl font-extrabold text-ink">Besoin d'un devis personnalisé ?</h2>
            <p className="mx-auto mt-2 max-w-xl text-ink/80">
              Indiquez vos dimensions et quantités, notre équipe vous répond rapidement avec une proposition sur mesure.
            </p>
            <Link
              to="/devis"
              className="mt-6 inline-block rounded-xl bg-ink px-7 py-3 text-sm font-semibold text-amber shadow-xl transition hover:brightness-110"
            >
              Demander un devis gratuit →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
