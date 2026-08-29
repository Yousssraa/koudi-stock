import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { useT } from "../../site/i18n.jsx";
import { categoryImage, productImage } from "../../site/utils.js";

const CATEGORY_COPY = {
  "Bois rouge": {
    title: "Bois rouges & industriels",
    d: "Pins des pays nordiques, clairs et résineux. Nous vous proposons une large variété de bois pour la menuiserie, la charpente et l'industrie, en mesure de répondre à tous vos besoins.",
  },
  "Bois blanc": {
    title: "Bois blancs & épicéa",
    d: "L'épicéa et le sapin pour ossature, charpente légère et lambris. Des essences claires et saines, idéales pour vos projets de construction à ossature bois.",
  },
  "Bois exotique": {
    title: "Bois exotiques",
    d: "Sapelli, iroko, kossipo, dibétou : des essences tropicales durables pour la menuiserie extérieure et l'aménagement haut de gamme.",
  },
  "Bois noble": {
    title: "Bois nobles",
    d: "Chêne, noyer et autres essences nobles pour des réalisations d'exception. Une sélection rigoureuse pour l'ébénisterie et la menuiserie de précision.",
  },
  "Panneaux": {
    title: "Panneaux décoratifs & industriels",
    d: "Contreplaqués, MDF, OSB, latté et stratifié : un stock impressionnant de panneaux aux dimensions et finitions variées, au meilleur prix.",
  },
  "Coffrage": {
    title: "Produits de coffrage",
    d: "Panneaux de coffrage, bakélisés et poutrelles pour le BTP. Des produits adaptés à l'industrie de la construction, livrés rapidement sur chantier.",
  },
};

const STATS = [
  { value: "10 000+", label: "M³ EN STOCK PERMANENT" },
  { value: "+500", label: "RÉFÉRENCES PRODUITS" },
  { value: "+200", label: "CLIENTS SUR LE ROYAUME" },
  { value: "48h", label: "LIVRAISON SUR LE MAROC" },
];

const ABOUT =
  "KOUDI WOOD est un importateur et distributeur de bois massifs, panneaux et matériaux de construction basé à Casablanca. Nous approvisionnons artisans, menuisiers et professionnels du BTP sur tout le royaume : bois rouges et blancs, essences exotiques et nobles, panneaux décoratifs et produits de coffrage. Découpe sur mesure, conseil technique et livraison rapide font de KOUDI WOOD votre partenaire bois de confiance.";

export default function Accueil() {
  useDocumentTitle("KOUDI WOOD — IMPORTATEUR & DISTRIBUTEUR DE BOIS ET MATÉRIAUX DE CONSTRUCTION");
  const t = useT();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [company, setCompany] = useState(null);
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
    api
      .get("/public/company/")
      .then((r) => setCompany(r.data))
      .catch(() => {});
  }, []);

  const featured = products.slice(0, 8);

  return (
    <div>
      {/* HERO — full-bleed banner */}
      <section
        className="relative flex min-h-[70vh] items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: `url(${categoryImage("Bois noble")})` }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center lg:px-6">
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            IMPORTATEUR &amp; DISTRIBUTEUR DE BOIS ET MATÉRIAUX DE CONSTRUCTION
          </h1>
          <p className="mt-5 text-lg font-medium tracking-wide text-amber sm:text-xl">Au Maroc depuis Casablanca</p>
        </div>
      </section>

      {/* DÉCOUVREZ NOS PRODUITS */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
        <h2 className="mb-10 text-center font-display text-3xl font-bold text-frost sm:text-4xl">
          <span className="border-b-4 border-amber pb-1">DÉCOUVREZ NOS PRODUITS</span>
        </h2>

        {loadErr && <p className="mb-6 text-center text-sm text-rose">{loadErr}</p>}

        {/* 2 rows of 3 category cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.length > 0
            ? categories.map((c) => {
                const meta = CATEGORY_COPY[c.key] || {};
                return (
                  <Link
                    key={c.key}
                    to={`/categorie/${encodeURIComponent(c.key)}`}
                    className="group overflow-hidden rounded-xl bg-panel ring-1 ring-line transition hover:shadow-xl hover:shadow-black/10"
                  >
                    <div className="aspect-[16/9] overflow-hidden">
                      <img
                        src={categoryImage(c.key)}
                        alt={c.label}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-5">
                      <h3 className="text-lg font-semibold leading-snug text-frost group-hover:text-amber">
                        {meta.title || c.label}
                      </h3>
                      <p className="mt-3 text-justify text-sm leading-relaxed text-ash">
                        {meta.d || `Explorez notre gamme ${c.label.toLowerCase()}.`}
                      </p>
                      <span className="mt-5 inline-block rounded-md bg-amber px-5 py-2.5 text-sm font-semibold text-ink shadow transition hover:brightness-110">
                        DÉCOUVRIR
                      </span>
                    </div>
                  </Link>
                );
              })
            : Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[16/10] animate-pulse rounded-xl bg-raise/70 ring-1 ring-line" />
              ))}
        </div>
      </section>

      {/* STATS BAND */}
      <section
        className="relative bg-cover bg-center py-16"
        style={{ backgroundImage: `url(${categoryImage("Coffrage")})` }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 text-center lg:grid-cols-4 lg:px-6">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="font-display text-4xl font-extrabold text-amber lg:text-5xl">{s.value}</p>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.15em] text-white/90">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* La société */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
          <div className="lg:pr-8">
            <h2 className="font-display text-2xl font-bold tracking-tight text-frost sm:text-3xl">
              <span className="border-b-4 border-amber pb-1">{company?.name || "KOUDI WOOD"}</span>
            </h2>
            {company?.tagline && (
              <p className="mt-4 font-display text-lg font-semibold text-amber">{company.tagline}</p>
            )}
            <p className="mt-4 text-justify text-sm leading-relaxed text-ash">{ABOUT}</p>
            <Link
              to="/contact"
              className="mt-6 inline-block rounded-lg bg-amber px-6 py-2.5 text-sm font-semibold text-ink shadow transition hover:brightness-110"
            >
              Nous contacter →
            </Link>
          </div>

          <div className="rounded-2xl bg-panel p-6 ring-1 ring-line sm:p-8">
            <h3 className="font-display mb-5 text-sm font-bold uppercase tracking-[0.15em] text-frost">
              Informations de la société
            </h3>
            <dl className="space-y-4 text-sm">
              {company?.address && (
                <div className="flex gap-3">
                  <span aria-hidden className="mt-0.5">📍</span>
                  <div>
                    <dt className="text-dim">Adresse</dt>
                    <dd className="text-frost">{company.address}</dd>
                  </div>
                </div>
              )}
              {company?.phone && (
                <div className="flex gap-3">
                  <span aria-hidden className="mt-0.5">☎</span>
                  <div>
                    <dt className="text-dim">Téléphone</dt>
                    <dd className="text-frost">
                      <a href={`tel:${company.phone}`} className="transition hover:text-amber">{company.phone}</a>
                    </dd>
                  </div>
                </div>
              )}
              {company?.email && (
                <div className="flex gap-3">
                  <span aria-hidden className="mt-0.5">✉</span>
                  <div>
                    <dt className="text-dim">Email</dt>
                    <dd className="text-frost">
                      <a href={`mailto:${company.email}`} className="transition hover:text-amber">{company.email}</a>
                    </dd>
                  </div>
                </div>
              )}
              {company?.ice && (
                <div className="flex gap-3">
                  <span aria-hidden className="mt-0.5">🛡</span>
                  <div>
                    <dt className="text-dim">ICE</dt>
                    <dd className="text-frost">{company.ice}</dd>
                  </div>
                </div>
              )}
              {company?.registre_commerce && (
                <div className="flex gap-3">
                  <span aria-hidden className="mt-0.5">📋</span>
                  <div>
                    <dt className="text-dim">Registre de commerce</dt>
                    <dd className="text-frost">{company.registre_commerce}</dd>
                  </div>
                </div>
              )}
              {company?.identifiant_fiscal && (
                <div className="flex gap-3">
                  <span aria-hidden className="mt-0.5">🧾</span>
                  <div>
                    <dt className="text-dim">Identifiant fiscal</dt>
                    <dd className="text-frost">{company.identifiant_fiscal}</dd>
                  </div>
                </div>
              )}
              {company?.patente && (
                <div className="flex gap-3">
                  <span aria-hidden className="mt-0.5">🏢</span>
                  <div>
                    <dt className="text-dim">Patente</dt>
                    <dd className="text-frost">{company.patente}</dd>
                  </div>
                </div>
              )}
              {company?.cnss && (
                <div className="flex gap-3">
                  <span aria-hidden className="mt-0.5">👷</span>
                  <div>
                    <dt className="text-dim">CNSS</dt>
                    <dd className="text-frost">{company.cnss}</dd>
                  </div>
                </div>
              )}
            </dl>
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="border-b border-line bg-panel/60">
        <div className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-frost sm:text-3xl">Nouveautés &amp; produits en stock</h2>
              <p className="mt-1 text-sm text-ash">Une sélection de nos produits disponibles immédiatement.</p>
            </div>
            <Link to="/produits" className="text-sm font-semibold text-amber hover:underline">
              Voir toute la boutique →
            </Link>
          </div>
          {products.length === 0 ? (
            <div className="h-40 animate-pulse rounded-xl bg-raise/70 ring-1 ring-line" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {featured.map((p) => (
                <Link
                  key={p.id}
                  to={`/categorie/${encodeURIComponent(p.category || "Panneaux")}?produit=${p.id}`}
                  className="group overflow-hidden rounded-lg bg-panel ring-1 ring-line transition hover:shadow-lg hover:shadow-black/5"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img src={productImage(p)} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    {p.stock_status === "out_of_stock" && (
                      <span className="absolute left-2 top-2 rounded-full bg-rose px-2 py-0.5 text-[10px] font-semibold text-ink">{t.common.outOfStock}</span>
                    )}
                  </div>
                  <div className="space-y-0.5 p-2.5 sm:p-3">
                    <h3 className="font-display truncate text-sm font-bold text-frost">{p.name}</h3>
                    <p className="truncate text-xs text-dim">{p.wood_type_name || p.category}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
        <div className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-panel p-8 ring-1 ring-line sm:flex-row sm:p-10">
          <div>
            <h2 className="font-display text-2xl font-bold text-frost sm:text-3xl">Demandez votre devis sur mesure</h2>
            <p className="mt-2 max-w-xl text-sm text-ash">
              Indiquez vos dimensions et quantités, notre équipe vous répond rapidement avec une proposition détaillée.
            </p>
          </div>
          <Link
            to="/devis"
            className="shrink-0 rounded-lg bg-amber px-7 py-3 text-sm font-semibold text-ink shadow transition hover:brightness-110"
          >
            Demander un devis →
          </Link>
        </div>
      </section>
    </div>
  );
}
