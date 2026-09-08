import { Link } from "react-router-dom";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { useT } from "../../site/i18n.jsx";
import Reveal from "../../site/Reveal.jsx";

const ARTICLES = [
  {
    key: "fourmi",
    title: "LA FOURMI AVAIT RAISON",
    date: "Hiver 2026",
    image: "/wood/bois-charpente.jpg",
    alt: "Stock de bois prêt à l'emploi dans nos dépôts",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "Anticiper, stocker, avancer. L'hiver ne ralentit pas ceux qui ont fait les bons choix. Avec KOUDI WOOD, vos projets gardent le rythme grâce à des matériaux disponibles immédiatement et un accompagnement fiable, du premier besoin à la livraison.",
  },
  {
    key: "chantiers-automne",
    title: "LES CHANTIERS D'AUTOMNE",
    date: "Automne 2025",
    image: "/wood/sapelli.jpg",
    alt: "Large sélection de bois adaptés à chaque chantier",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "Chez KOUDI WOOD on a le choix ! Nous mettons à votre disposition une large sélection de bois adaptés à chaque besoin : bois de coffrage BTP pour vos grands projets, bois rouge pour une menuiserie solide, bois dur pour des finitions raffinées, pin d'Oregon pour sa couleur et sa fiabilité, et bois exotiques pour allier élégance et résistance. En cette nouvelle saison, zoom sur le bois !",
  },
  {
    key: "color-your-life",
    title: "COLOR YOUR LIFE",
    subtitle: "KOUDI WOOD, le bois en couleurs",
    image: "/wood/bois-blanc.jpg",
    alt: "Diversité des essences de bois",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "Nos fardeaux de bois ne sont pas seulement une ressource brute, ce sont des palettes d'opportunités. Chaque teinte vive représente la diversité des essences et des usages possibles. Derrière ces couleurs, il y a la promesse d'un bois robuste, fiable et prêt à répondre aux besoins les plus exigeants de vos projets.",
  },
  {
    key: "parquet-automne",
    title: "CHALEUR, ÉLÉGANCE, PARQUET : L'AUTOMNE SIGNÉ KOUDI WOOD",
    subtitle: "L'esprit d'automne sous vos pas",
    image: "/wood/noyer.jpg",
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
    image: "/wood/hetre-etuve.jpg",
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
    image: "/wood/epicea.jpg",
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
    image: "/wood/contreplaque.jpg",
    alt: "Contreplaqué filmé bakélisé",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "Robuste, durable et ultra-polyvalent, le bakélisé SVEZA est votre allié idéal pour la construction, la carrosserie et même l'événementiel. Avec sa résistance exceptionnelle et sa finition haut de gamme, il garantit des résultats impeccables.",
  },
  {
    key: "gladiator",
    title: "LE BOIS DE L'ARÈNE DE GLADIATOR 2, IMPORTÉ PAR KOUDI WOOD",
    subtitle: "Notre bois, star des plus grandes productions !",
    image: "/wood/pin-sylvestre.jpg",
    alt: "Bois utilisé pour des constructions de prestige",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "Nous sommes fiers d'annoncer que le bois utilisé pour construire l'arène emblématique du film Gladiator 2 provient de nos dépôts. Participer à un projet aussi prestigieux dans le monde du cinéma est une immense fierté pour nous et témoigne de la confiance que nos partenaires placent en nos matériaux et en notre engagement.",
  },
  {
    key: "dibetou",
    title: "NOUVEL ARRIVAGE DIBETOU",
    subtitle: "Le bois d'exception pour des créations uniques",
    image: "/wood/dibetou.jpg",
    alt: "Bois exotique Dibetou",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "Découvrez le nouvel arrivage de Dibetou chez KOUDI WOOD, l'essence exotique qui allie charme et durabilité. Originaire d'Afrique, ce bois exotique raffiné séduit par son veinage unique et sa robustesse. Il est prisé pour l'ébénisterie et la menuiserie haut de gamme, tant en intérieur qu'en extérieur.",
  },
  {
    key: "coffrage",
    title: "LE MEILLEUR DES SOLUTIONS DE COFFRAGE CHEZ KOUDI WOOD",
    subtitle: "Des solutions de coffrage à la hauteur de vos projets",
    image: "/wood/coffrage.jpg",
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
    image: "/wood/sapelli.jpg",
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
    key: "valchromat",
    title: "LA NOUVELLE COULEUR WHITE PEARL DE VALCHROMAT",
    subtitle: "Le blanc qui défie l'impossible",
    image: "/wood/mdf-photo.jpg",
    alt: "Panneau Valchromat coloré",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "Le valchromat est un panneau de fibres de bois colorées dans la masse permettant la réalisation de travaux tridimensionnels. Cette nouvelle teinte claire vous permettra de créer des espaces et des pièces qui allient esthétique et responsabilité environnementale. Chez KOUDI WOOD, la nouvelle couleur White Pearl sera disponible sur commande.",
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
    image: "/wood/panneaux.jpg",
    alt: "Salon professionnel du bois",
    href: "/produits",
    linkLabel: "+ D'infos",
    body:
      "L'équipe KOUDI WOOD a été présente au Carrefour International du Bois à Nantes. Des échanges constructifs ont eu lieu avec nos partenaires sur les futurs projets qui nous attendent au Maroc.",
  },
];

export default function Actualites() {
  useDocumentTitle("KOUDI WOOD — Actualités");
  const t = useT();

  return (
    <div>
      {/* BANNER / BREADCRUMB */}
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

      {/* EYEBROW */}
      <Reveal>
        <section className="mx-auto max-w-7xl px-4 pt-14 lg:px-6">
          <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-amber">
            What's up chez KOUDI WOOD ?
          </p>
          <h2 className="mt-2 text-center font-display text-2xl font-bold tracking-tight text-frost sm:text-3xl">
            Les dernières actualités de l'enseigne
          </h2>
        </section>
      </Reveal>

      {/* ARTICLES */}
      <section className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
        <div className="space-y-12">
          {ARTICLES.map((a, i) => (
            <Reveal key={a.key} delay={(i % 4) * 90}>
              <article className="group grid grid-cols-1 items-center gap-8 overflow-hidden rounded-3xl bg-panel p-6 ring-1 ring-line transition duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber/10 lg:grid-cols-2 lg:gap-12 lg:p-8">
                <div className="overflow-hidden rounded-2xl">
                  <img
                    src={a.image}
                    alt={a.alt}
                    loading="lazy"
                    className="aspect-[4/3] h-full w-full object-cover transition duration-700 group-hover:scale-110"
                  />
                </div>
                <div className={i % 2 === 0 ? "" : "lg:order-first"}>
                  {a.date && (
                    <p className="mb-2 inline-block rounded-full bg-amber/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber ring-1 ring-amber/20">
                      {a.date}
                    </p>
                  )}
                  <h3 className="font-display text-xl font-bold tracking-tight text-frost sm:text-2xl">
                    <span className="border-b-4 border-amber pb-1">{a.title}</span>
                  </h3>
                  {a.subtitle && (
                    <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-copper">
                      {a.subtitle}
                    </p>
                  )}
                  <p className="mt-4 text-justify text-sm leading-relaxed text-ash">{a.body}</p>
                  <Link
                    to={a.href}
                    className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber to-copper px-6 py-2.5 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110"
                  >
                    {a.linkLabel} →
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
