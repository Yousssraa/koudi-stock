import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client.js";
import { downloadPdf } from "../../api/download.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { useT } from "../../site/i18n.jsx";
import { categoryImage, fmtPrice, productImage } from "../../site/utils.js";
import SavoirFaire from "../../components/SavoirFaire.jsx";
import BrandsMarquee from "../../components/BrandsMarquee.jsx";

const PRODUCT_FAMILIES = [
  {
    title: "BOIS DE MENUISERIE & INDUSTRIELS",
    d: "KOUDI WOOD propose une large variété de bois venant de diverses régions du monde. Bois rouge, blanc, madriers de construction, pin, bois exotiques ou bois durs, nous sommes en mesure de répondre à tous vos besoins.",
    img: "/wood/menuiserie.jpg",
    to: "/categorie/Bois rouge",
  },
  {
    title: "PANNEAUX DÉCORATIFS & INDUSTRIELS",
    d: "KOUDI WOOD dispose d'un stock de panneaux impressionnant. Contreplaqués, MDF, HDF, panneaux particules, high gloss sans oublier les panneaux portes, vous trouverez votre bonheur chez KOUDI WOOD, et ce toujours au meilleur prix.",
    img: "/wood/panneau-deco.jpg",
    to: "/categorie/Panneaux",
  },
  {
    title: "PRODUITS DE COFFRAGE",
    d: "KOUDI WOOD figure parmi les premiers importateurs à avoir proposé à l'industrie de la construction marocaine, le système de coffrage à l'aide de Poutres H20 et de Panneaux Triplis.",
    img: "/wood/coffrage-new.jpg",
    to: "/categorie/Coffrage",
  },
  {
    title: "ISOLATION & ÉTANCHÉITÉ",
    d: "KOUDI WOOD élargit sa gamme de produits en vous proposant une panoplie de produits pour couvrir vos besoins en isolation et étanchéité. Laines isolantes, plaques de plâtre, feuilles d'étanchéité bitumineuses, faux plafonds… KOUDI WOOD devient votre one-stop-shop.",
    img: "/wood/isolation.jpg",
    to: "/produits",
  },
  {
    title: "AMÉNAGEMENT EXTÉRIEUR",
    d: "Chez KOUDI WOOD, vous trouverez votre bonheur pour tous vos besoins en bois d'extérieur. Decking, lambris, bardage, nos équipes de spécialistes vous orienteront vers le produit le plus adapté à votre projet.",
    img: "/wood/amenagement-ext.jpg",
    to: "/produits",
  },
  {
    title: "TÔLE & FER À BÉTON",
    d: "Économique, résistante et se fixant facilement sur des chevrons en sapin, la tôle galvanisée ondulée est utilisée dans la construction de hangars, de palissades de chantiers en tant que couverture et bardage de bâtiments.",
    img: "/wood/fer-a-beton.jpg",
    to: "/produits",
  },
];

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
  const [products, setProducts] = useState([]);
  const [company, setCompany] = useState(null);

  useEffect(() => {
    api
      .get("/public/products/")
      .then((r) => setProducts(r.data))
      .catch(() => {});
    api
      .get("/public/company/")
      .then((r) => setCompany(r.data))
      .catch(() => {});
  }, []);

  // Produits emblématiques du marché marocain du bois, mis en avant par SKU.
  // On place d'abord ceux qui sont en stock, puis on complète avec les autres.
  const FEATURED_SKUS = [
    "PR-100-100-4000", // Madrier Pin (construction / coffrage béton)
    "EPC-063-225-4000", // Bastaing Épicéa (solivage)
    "PR-063-225-4000", // Bastaing Pin (solivage)
    "EPC-063-175-4000", // Chevron Épicéa (charpente / toiture)
    "PR-063-175-4000", // Chevron Pin (charpente / toiture)
    "EPC-027-040-3000", // Liteau Épicéa (support de tuiles)
    "CFR-18-2500-1250", // Panneau de coffrage bakélisé (gros œuvre)
    "CPO-15-2500-1220", // Contreplaqué Okoumé (menuiserie)
  ];
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const pinned = FEATURED_SKUS.map((s) => bySku.get(s)).filter(Boolean);
  const rest = products.filter((p) => !FEATURED_SKUS.includes(p.sku));
  const featured = [...pinned, ...rest]
    .sort((a, b) => Number(a.stock_status === "out_of_stock") - Number(b.stock_status === "out_of_stock"))
    .slice(0, 8);

  const downloadCatalog = async () => {
    try {
      await downloadPdf("/public/catalog.pdf/", "KOUDI-WOOD-Catalogue.pdf");
    } catch {
      alert("Impossible de télécharger le catalogue pour le moment.");
    }
  };

  return (
    <div>
      {/* BOUTON WHATSAPP FLOTTANT */}
      <a
        href="https://api.whatsapp.com/send?phone=212725151381&text=Bonjour%20KOUDI%20WOOD%2C%20je%20souhaite%20des%20informations%20sur%20vos%20produits."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Discuter sur WhatsApp"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl shadow-black/30 transition hover:scale-110 hover:bg-[#1ebe5d]"
      >
        <svg viewBox="0 0 32 32" className="h-8 w-8 fill-current" aria-hidden="true">
          <path d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.6c1.9 1 4 1.6 6.2 1.6 7.2 0 13-5.8 13-13S23.2 3 16 3zm0 23.6c-2 0-3.9-.5-5.6-1.5l-.4-.2-4.7 1.1 1.2-4.6-.3-.4C5.3 19.4 4.7 17.7 4.7 16 4.7 9.7 9.8 4.6 16 4.6s11.3 5 11.3 11.4S22.2 26.6 16 26.6zm6.2-8.5c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.7.2-.2.3-.8 1.1-1 1.3-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1.1 1.1-1.1 2.6s1.1 3 1.3 3.2c.2.2 2.2 3.4 5.3 4.7.7.3 1.3.5 1.8.6.7.2 1.4.2 1.9.1.6-.1 2-.8 2.2-1.6.3-.8.3-1.4.2-1.6-.1-.1-.3-.2-.6-.4z" />
        </svg>
      </a>

      {/* HERO — full-bleed banner */}
      <section
        className="relative flex min-h-[70vh] items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: `url(/wood/burgundy-texture.jpg)`, backgroundColor: "#5c1420" }}
      >
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center lg:px-6">
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            IMPORTATEUR &amp; DISTRIBUTEUR DE BOIS ET MATÉRIAUX DE CONSTRUCTION
          </h1>
          <span className="mt-6 inline-block rounded-full bg-white/90 px-5 py-2 text-lg font-semibold tracking-wide text-copper shadow-lg sm:text-xl">
            Au Maroc depuis 1976
          </span>
        </div>
      </section>

      {/* DÉCOUVREZ NOS PRODUITS */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
        <h2 className="mb-10 text-center font-display text-3xl font-bold text-frost sm:text-4xl">
          <span className="border-b-4 border-amber pb-1">DÉCOUVREZ NOS PRODUITS</span>
        </h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCT_FAMILIES.map((f) => (
            <Link
              key={f.title}
              to={f.to}
              title="TOUS NOS PRODUITS"
              className="group block"
            >
              <div className="aspect-[16/9] overflow-hidden">
                <img
                  src={f.img}
                  alt={f.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="pt-4">
                <h3 className="text-lg font-semibold leading-snug text-frost group-hover:text-amber">{f.title}</h3>
                <p className="mt-2 text-justify text-sm leading-relaxed text-ash">{f.d}</p>
                <span className="mt-4 inline-block text-sm font-semibold uppercase tracking-wide text-amber underline underline-offset-4 transition group-hover:text-copper">
                  DÉCOUVRIR
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* STATS BAND */}
      <section
        className="relative bg-cover bg-center py-16"
        style={{ backgroundImage: `url(${categoryImage("Bois Traité Autoclave")})` }}
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

      {/* NOTRE SAVOIR-FAIRE */}
      <SavoirFaire />

      {/* LES MARQUES LES PLUS RÉPUTÉES */}
      <BrandsMarquee />

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
                <div
                  key={p.id}
                  className="group overflow-hidden rounded-lg bg-panel ring-1 ring-line transition hover:shadow-lg hover:shadow-black/5"
                >
                  <Link to={`/produit/${p.id}`} className="block">
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img src={productImage(p)} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      {p.stock_status === "out_of_stock" && (
                        <span className="absolute left-2 top-2 rounded-full bg-rose px-2 py-0.5 text-[10px] font-semibold text-ink">{t.common.outOfStock}</span>
                      )}
                    </div>
                    <div className="space-y-0.5 p-2.5 sm:p-3">
                      <h3 className="font-display truncate text-sm font-bold text-frost group-hover:text-amber">{p.name}</h3>
                      <p className="truncate text-xs text-dim">{p.wood_type_name || p.category}</p>
                      <p className="mt-1.5 font-semibold text-amber">
                        {fmtPrice(p.sale_price)} {t.common.mad} <span className="font-normal text-dim">/ {t.common.perM3}</span>
                      </p>
                    </div>
                  </Link>
                  <div className="px-2.5 pb-3 sm:px-3">
                    <Link
                      to={`/produit/${p.id}`}
                      className="flex items-center justify-center rounded-lg bg-gradient-to-r from-amber to-copper px-3 py-2 text-xs font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110"
                    >
                      Découvrir →
                    </Link>
                  </div>
                </div>
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
            <p className="mt-3 inline-block rounded-full bg-amber/10 px-3 py-1 text-xs font-semibold text-amber ring-1 ring-amber/20">
              📥 Téléchargez notre catalogue complet en PDF
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <button
              onClick={downloadCatalog}
              className="rounded-lg border border-amber/40 bg-panel px-7 py-3 text-sm font-semibold text-amber shadow transition hover:bg-amber/10"
            >
              📥 Télécharger le catalogue
            </button>
            <Link
              to="/devis"
              className="rounded-lg bg-amber px-7 py-3 text-sm font-semibold text-ink shadow transition hover:brightness-110"
            >
              Demander un devis →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
