import { Link } from "react-router-dom";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { useT } from "../../site/i18n.jsx";
import Reveal from "../../site/Reveal.jsx";

const ARTICLES = [
  {
    key: "chantiers-automne",
    title: "LES CHANTIERS D'AUTOMNE",
    date: "Automne 2025",
    image: "/wood/actu-chantiers-automne.jpg",
    alt: "Large sélection de bois adaptés à chaque chantier",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "Chez KOUDI WOOD on a le choix ! Nous mettons à votre disposition une large sélection de bois adaptés à chaque besoin : bois de coffrage BTP pour vos grands projets, bois rouge pour une menuiserie solide, bois dur pour des finitions raffinées, pin d'Oregon pour sa couleur et sa fiabilité, et bois exotiques pour allier élégance et résistance. En cette nouvelle saison, zoom sur le bois !",
  },
  {
    key: "parquet-automne",
    title: "CHALEUR, ÉLÉGANCE, PARQUET : L'AUTOMNE SIGNÉ KOUDI WOOD",
    subtitle: "L'esprit d'automne sous vos pas",
    image: "/wood/actu-parquet-automne.jpg",
    alt: "Parquet et essences nobles",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "Chez KOUDI WOOD, nous vous proposons une sélection de parquets en provenance de Turquie, disponibles en plusieurs décors et reconnus pour leur qualité et leur résistance. Alliant élégance et confort, ils créent une atmosphère chaleureuse, idéale pour vos projets résidentiels ou professionnels. Large choix, disponibilité immédiate et service professionnel à votre écoute.",
  },
  {
    key: "hetre-calvi",
    title: "NOUVEL ARRIVAGE HÊTRE CALVI",
    subtitle: "L'essence de l'excellence",
    image: "/wood/actu-hetre-calvi.jpg",
    alt: "Hêtre de la marque Calvi",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "Un nouveau stock de Hêtre de la marque Calvi est désormais disponible chez KOUDI WOOD. Grâce à sa facilité de travail, sa teinte claire et son grain fin, ce bois est idéal pour la menuiserie et l'agencement intérieur.",
  },
  {
    key: "printemps",
    title: "LE PRINTEMPS FAIT GERMER VOS PROJETS",
    date: "Printemps 2025",
    image: "/wood/actu-printemps.jpg",
    alt: "Gamme de matériaux pour professionnels du bâtiment",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "C'est la saison idéale pour optimiser vos chantiers et vos aménagements. KOUDI WOOD accompagne les professionnels du bâtiment dans tous leurs projets, du gros œuvre à la finition. Découvrez notre large gamme de matériaux adaptés aux exigences du terrain : bois, panneaux, essences dures et exotiques, solutions d'isolation et d'étanchéité. Performance, fiabilité, disponibilité : faites confiance à KOUDI WOOD pour vos chantiers.",
  },
  {
    key: "sveza",
    title: "BAKÉLISÉ SVEZA CHEZ KOUDI WOOD",
    subtitle: "La fiabilité dont vos projets ont besoin !",
    image: "/wood/actu-sveza.jpg",
    alt: "Contreplaqué filmé bakélisé",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "Robuste, durable et ultra-polyvalent, le bakélisé SVEZA est votre allié idéal pour la construction, la carrosserie et même l'événementiel. Avec sa résistance exceptionnelle et sa finition haut de gamme, il garantit des résultats impeccables.",
  },
  {
    key: "coffrage",
    title: "LE MEILLEUR DES SOLUTIONS DE COFFRAGE CHEZ KOUDI WOOD",
    subtitle: "Des solutions de coffrage à la hauteur de vos projets",
    image: "/wood/actu-coffrage.jpg",
    alt: "Produits de coffrage",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "KOUDI WOOD a tout ce qu'il vous faut pour mener à bien les coffrages de vos chantiers : panneaux triplis, poutres H20 et contreplaqué filmé bakélisé. Pour plus d'infos ou pour passer commande, contactez votre commercial pour une assistance immédiate.",
  },
  {
    key: "boules-garat",
    title: "NOUVEL ARRIVAGE DE BOIS ROUGE STENVALLS",
    subtitle: "La qualité suédoise au service de vos créations !",
    image: "/wood/actu-stenvalls.jpg",
    alt: "Bois rouge de la marque Stenvalls",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "KOUDI WOOD vous annonce l'arrivée d'un lot exceptionnel de bois rouge de la célèbre marque STENVALLS, reconnue pour sa qualité incomparable et son respect des normes environnementales, idéal pour vos projets de construction, d'aménagement intérieur ou extérieur.",
  },
  {
    key: "osb",
    title: "LA TENDANCE OSB PAR KRONOSPAN",
    image: "/wood/osb-photo.jpg",
    alt: "Panneaux OSB",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "Les panneaux OSB sont développés et fabriqués entièrement en conformité avec la demande actuelle d'un mode de vie écologique axé sur les matériaux organiques. Un produit que l'on peut utiliser pour les murs, sols, toits, cages d'escaliers, palissades, éléments de décoration dans les espaces intérieurs, en guise de revêtements et aussi de cloisons. Arrivages réguliers dans nos dépôts.",
  },
  {
    key: "chene",
    title: "L'ÉLÉGANCE DU BOIS, LA FORCE DU CHÊNE",
    subtitle: "L'excellence prend forme",
    image: "/wood/chene.jpg",
    alt: "Chêne européen",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "Optez pour la qualité et la performance avec notre chêne européen, un bois noble et résistant, idéal pour vos projets d'aménagement et de menuiserie haut de gamme. Disponible chez KOUDI WOOD en différentes épaisseurs : 27 – 40 – 50 – 80 mm.",
  },
  {
    key: "amateure-exterieur",
    title: "L'ÉTÉ SERA BEAU, L'ÉTÉ SERA BOIS",
    date: "Été 2025",
    image: "/wood/iroko.jpg",
    alt: "Lames de terrasse en bois naturel",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "Pour cette saison estivale, nous vous invitons à découvrir notre sélection de produits : lames de terrasse en bois naturel ou composite, revêtements haut de gamme, panneaux décoratifs et plus encore. Alliez design contemporain et performance durable pour répondre aux attentes de vos projets et de vos clients les plus exigeants.",
  },
  {
    key: "bouleau",
    title: "CONTREPLAQUÉ BOULEAU CHEZ KOUDI WOOD",
    subtitle: "L'âme du bouleau, signée KOUDI WOOD",
    image: "/wood/plywood.jpg",
    alt: "Contreplaqué bouleau",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "Le contreplaqué bouleau SVEZA, brut ou mélaminé : l'excellence russe chez KOUDI WOOD. Nous mettons à votre disposition le contreplaqué bouleau de qualité supérieure : contreplaqué bouleau mélaminé blanc et contreplaqué bouleau brut. Dimensions : 2500 x 1250 mm. Robustesse, stabilité et finition impeccable au service de vos réalisations.",
  },
  {
    key: "carrefour",
    title: "CARREFOUR INTERNATIONAL DU BOIS",
    subtitle: "KOUDI WOOD au Carrefour International du Bois : innovation & partage de savoir-faire",
    image: "/wood/actu-carrefour.jpg",
    alt: "Salon professionnel du bois",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "L'équipe KOUDI WOOD a été présente au Carrefour International du Bois à Nantes. Des échanges constructifs ont eu lieu avec nos partenaires sur les futurs projets qui nous attendent au Maroc.",
  },
];

/* Comarbois utilise le style Woodmart « wd-underline-colored » :
   un liseré de couleur accent sous le titre. */
function UnderlinedTitle({ children, className = "", bar = "after:bg-amber" }) {
  return (
    <span
      className={`relative inline-block pb-2.5 after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:content-[''] after:transition-colors ${bar} ${className}`}
    >
      {children}
    </span>
  );
}

export default function Actualites() {
  useDocumentTitle("KOUDI WOOD — Actualités");
  const t = useT();

  return (
    <div>
      {/* BANNER / BREADCRUMB — hero centré type Comarbois (title-design-centered) */}
      <section
        className="relative flex min-h-[38vh] items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: "url(/wood/chene.jpg)", backgroundColor: "#5c1420" }}
      >
        <div className="absolute inset-0 bg-black/45" />
        <Reveal className="relative mx-auto max-w-4xl px-4 py-20 text-center lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            KOUDI WOOD · Casablanca
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Actualités
          </h1>
          <nav className="mt-5 flex items-center justify-center gap-2 text-sm text-white/90">
            <Link to="/" className="transition hover:text-amber">Accueil</Link>
            <span aria-hidden className="text-white/50">›</span>
            <span>Actualités</span>
          </nav>
        </Reveal>
      </section>

      {/* TITRE DE SECTION — centré, soulignement accentué type Comarbois */}
      <Reveal>
        <section className="mx-auto max-w-7xl px-4 pt-16 lg:px-6">
          <h2 className="text-center font-display text-2xl font-bold uppercase tracking-tight text-frost sm:text-3xl">
            <UnderlinedTitle bar="after:bg-copper after:h-1">Quoi de neuf chez KOUDI WOOD ?</UnderlinedTitle>
          </h2>
        </section>
      </Reveal>

      {/* ARTICLES — structure fidèle à la page News de Comarbois :
          colonne unique centrée, chaque rubrique = titre centré souligné
          (wd-underline-colored) + mention de saison + tagline small +
          image centrée arrondie à bordure grise (vc_box_rounded /
          vc_box_border_grey) + texte + bouton carré pleine teinte */}
      <section className="mx-auto max-w-5xl px-4 py-16 lg:px-6">
        <div className="space-y-20">
          {ARTICLES.map((a) => (
            <Reveal key={a.key}>
              <article className="text-center">
                {a.date && (
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amberl">
                    {a.date}
                  </p>
                )}
                <h3 className="mt-4 font-display text-xl font-bold uppercase tracking-tight text-frost sm:text-2xl">
                  <UnderlinedTitle>{a.title}</UnderlinedTitle>
                </h3>
                {a.subtitle && (
                  <p className="mt-3 text-sm text-dim">{a.subtitle}</p>
                )}
                <Link
                  to={a.href}
                  className="group mx-auto mt-8 block max-w-3xl overflow-hidden rounded-lg border border-line bg-panel shadow-sm transition hover:border-amberl"
                >
                  <img
                    src={a.image}
                    alt={a.alt}
                    loading="lazy"
                    className="aspect-[16/9] h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                </Link>
                <p className="mx-auto mt-6 max-w-3xl text-justify text-sm leading-relaxed text-ash sm:text-base">
                  {a.body}
                </p>
                <div className="mt-7">
                  <Link
                    to={a.href}
                    className="inline-block rounded-none bg-copper px-9 py-3 text-sm font-semibold uppercase tracking-widest text-white transition hover:bg-amber"
                  >
                    {a.linkLabel}
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}