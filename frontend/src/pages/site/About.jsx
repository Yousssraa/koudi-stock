import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { useT } from "../../site/i18n.jsx";
import { categoryImage } from "../../site/utils.js";

const SECTIONS = [
  {
    key: "incoutournable",
    title: "INCONTOURNABLE DEPUIS 1967",
    image: "/wood/about-incoutournable.jpg",
    alt: "Bois rouge dans le dépôt de KOUDI WOOD",
    body:
      "Leader sur le marché du bois au Maroc, KOUDI WOOD représente l'intermédiaire le plus reconnu entre les scieries du monde entier et le consommateur Marocain. Nous approvisionnons artisans, menuisiers et professionnels du BTP : bois rouges et blancs, essences exotiques et nobles, panneaux décoratifs et produits de coffrage. Découpe sur mesure, conseil technique et livraison rapide font de KOUDI WOOD votre partenaire bois de confiance.",
  },
  {
    key: "marques",
    title: "LES MEILLEURES MARQUES",
    image: "/wood/about-marques.jpg",
    alt: "Essences nobles sélectionnées et importées",
    body:
      "Nous avons la capacité d'acheminer, dans des conditions optimales, la marchandise provenant de n'importe quel site de production du monde. Nous sélectionnons et importons une large variété d'essences de bois, et autres dérivés, que nous distribuons ensuite sur l'ensemble du royaume.",
  },
  {
    key: "rigueur",
    title: "RIGUEUR & QUALITÉ",
    image: "/wood/about-rigueur.jpg",
    alt: "Contrôles qualité rigoureux de nos produits",
    body:
      "Pour assurer à nos clients un produit de qualité répondant aux standards internationaux, nos ingénieurs et techniciens effectuent des contrôles réguliers et rigoureux de la qualité des produits. Ils veillent aussi au respect des procédures de stockage et de manutention tout au long de la chaîne logistique depuis les sites de production, jusqu'à la livraison chez nos clients.",
  },
  {
    key: "ecoute",
    title: "TOUJOURS À VOTRE ÉCOUTE",
    image: "/wood/about-ecoute.jpg",
    alt: "Une équipe commerciale à votre écoute",
    body:
      "Une force de vente, avec un savoir-faire de plus de 50 ans sur le marché national, est en permanence à l'écoute de nos clients. Les compétences techniques et commerciales de notre équipe sont régulièrement actualisées. Cela leur permet d'écouter, d'informer mais surtout de conseiller nos clients dans leur choix afin de satisfaire au mieux leurs exigences et intérêts.",
  },
  {
    key: "optimisation",
    title: "OPTIMISATION",
    image: "/wood/about-optimisation.jpg",
    alt: "Entrepôts et espaces de stockage aux standards du métier",
    body:
      "Afin de toujours répondre aux exigences de notre clientèle, nous tenons en permanence d'importants stocks. Tous nos hangars et espaces de stockage répondent aux standards du métier. Ces équipements nous permettent de stocker nos produits dans les meilleures conditions possibles préservant ainsi leur qualité et aspect esthétique.",
  },
  {
    key: "livraison",
    title: "LIVRAISON EN 24H",
    image: "/wood/about-livraison.jpg",
    alt: "Notre flotte de camions et matériel de manutention",
    body:
      "Nous mettons à la disposition de nos clients une flotte de camions et un matériel de manutention dernier cri. Nos camions sont équipés d'un système de géolocalisation qui permet d'optimiser la gestion de notre flotte et d'assurer à nos clients des livraisons sous 24 heures sur l'ensemble du territoire Marocain.",
  },
];

export default function About() {
  useDocumentTitle("KOUDI WOOD — À propos de notre entreprise");
  const t = useT();
  const [company, setCompany] = useState(null);

  useEffect(() => {
    api
      .get("/public/company/")
      .then((r) => setCompany(r.data))
      .catch(() => setCompany(null));
  }, []);

  return (
    <div>
      {/* BANNER / BREADCRUMB */}
      <section
        className="relative flex min-h-[38vh] items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: `url(/wood/about-incoutournable.jpg)`, backgroundColor: "#5c1420" }}
      >
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            KOUDI WOOD · Casablanca
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            À propos
          </h1>
          <nav className="mt-5 flex items-center justify-center gap-2 text-sm text-white/90">
            <Link to="/" className="transition hover:text-amber">Accueil</Link>
            <span aria-hidden className="text-white/50">›</span>
            <span>À propos</span>
          </nav>
        </div>
      </section>

      {/* SECTIONS */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
        <div className="space-y-16">
          {SECTIONS.map((s, i) => (
            <div
              key={s.key}
              className={`grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12 ${
                i % 2 === 0 ? "" : "lg:[&>*:first-child]:order-2"
              }`}
            >
              <div className="overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
                <img src={s.image} alt={s.alt} className="aspect-[4/3] h-full w-full object-cover" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight text-frost sm:text-2xl">
                  <span className="border-b-4 border-amber pb-1">{s.title}</span>
                </h2>
                <p className="mt-5 text-justify text-sm leading-relaxed text-ash">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* INFORMATIONS DE LA SOCIÉTÉ */}
      <section className="border-y border-line bg-panel/60">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
          <div className="mx-auto max-w-3xl rounded-2xl bg-panel p-6 ring-1 ring-line sm:p-8">
            <h3 className="font-display mb-2 text-center text-2xl font-bold tracking-tight text-frost">
              Informations de la société
            </h3>
            <p className="mb-6 text-center text-sm text-ash">
              Retrouvez les coordonnées de {company?.name || "KOUDI WOOD"} pour nous contacter.
            </p>
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
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

      {/* CTA */}
      <section
        className="relative bg-cover bg-center py-16"
        style={{ backgroundImage: `url(${categoryImage("Bois Traité Autoclave")})` }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 text-center lg:px-6">
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
            Un commercial va vous appeler !
          </h2>
          <p className="max-w-xl text-sm text-white/85">
            Quelques lignes à remplir et notre équipe vous recontactera très rapidement pour étudier votre demande.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/contact"
              className="rounded-lg border border-white/40 bg-white/10 px-7 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              📞 Nous contacter
            </Link>
            <Link
              to="/devis"
              className="rounded-lg bg-amber px-7 py-3 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110"
            >
              Demander un devis →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
