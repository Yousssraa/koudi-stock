// Exemples d'utilisation par essence / catégorie de bois.
// Chaque usage = titre + description + image existante de la palette (/public/wood).
const byKey = {
  "pin sylvestre": {
    title: "Pin Sylvestre (Bois Rouge)",
    uses: [
      {
        title: "Charpente & ossature",
        desc: "Madriers, bastaings et chevrons en pin sylvestre pour la charpente, l'ossature et la structure des bâtiments.",
        img: "/wood/madrier-charpente.jpg",
        tags: ["Charpente", "Ossature", "Structure"],
      },
      {
        title: "Terrasse extérieure",
        desc: "Lames de terrasse en pin traité autoclave : sols de terrasses, balcons et abords de piscine résistants.",
        img: "/wood/madrier-terrasse.webp",
        tags: ["Terrasse", "Extérieur"],
      },
      {
        title: "Menuiserie & coffrage",
        desc: "Voliges et planches de coffrage pour vos chantiers et vos travaux de menuiserie courante.",
        img: "/wood/madrier-menuiserie.webp",
        tags: ["Coffrage", "Menuiserie"],
      },
    ],
  },
  "sapin du nord": {
    title: "Sapin du Nord (Bois Blanc)",
    uses: [
      {
        title: "Charpente légère",
        desc: "Chevrons et voliges en sapin du Nord pour toitures, contreventements et zones de pression.",
        img: "/wood/epicea.jpg",
        tags: ["Charpente", "Toiture"],
      },
      {
        title: "Ossature & doublage",
        desc: "Poteaux et bastaings en bois blanc pour l'ossature des cloisons et le doublage.",
        img: "/wood/epicea.jpg",
        tags: ["Ossature", "Doublage"],
      },
      {
        title: "Rondins & clôtures",
        desc: "Rondins de sapin pour abris de jardin, clôtures et structures rustiques.",
        img: "/wood/epicea.jpg",
        tags: ["Rondins", "Clôture"],
      },
    ],
  },
  "chêne": {
    title: "Chêne",
    uses: [
      {
        title: "Ébénisterie & menuiserie fine",
        desc: "Plateaux de chêne pour meubles, plans de travail et menuiserie de précision.",
        img: "/wood/chene.jpg",
        tags: ["Ébénisterie", "Meubles"],
      },
      {
        title: "Cuisine & plan de travail",
        desc: "Plans de travail et façades de cuisine en chêne massif, chaleureux et durable.",
        img: "/wood/chene.jpg",
        tags: ["Cuisine", "Plan de travail"],
      },
      {
        title: "Escaliers & parquet",
        desc: "Contremarches, limons et parquet en chêne pour des intérieurs nobles.",
        img: "/wood/chene.jpg",
        tags: ["Escalier", "Parquet"],
      },
    ],
  },
  "hêtre étuvé": {
    title: "Hêtre Étuvé",
    uses: [
      {
        title: "Chaises & sièges",
        desc: "Le hêtre étuvé est idéal pour les chaises, fauteuils et sièges cintrés.",
        img: "/wood/hetre-etuve.jpg",
        tags: ["Sièges", "Cintrage"],
      },
      {
        title: "Menuiserie intérieure",
        desc: "Portes, cadres et aménagements intérieurs en hêtre clair et stable.",
        img: "/wood/hetre-etuve.jpg",
        tags: ["Portes", "Intérieur"],
      },
      {
        title: "Jouets & objets",
        desc: "Bois sain et sans échardes pour jouets, ustensiles et objets de précision.",
        img: "/wood/hetre-etuve.jpg",
        tags: ["Jouets", "Ustensiles"],
      },
    ],
  },
  "iroko": {
    title: "Iroko (Teck d'Afrique)",
    uses: [
      {
        title: "Terrasse extérieure",
        desc: "L'iroko résiste à l'humidité : lames et platelages de terrasses et pilotis.",
        img: "/wood/iroko.jpg",
        tags: ["Terrasse", "Extérieur"],
      },
      {
        title: "Menuiserie de bateaux",
        desc: "Bois noble imputrescible pour ponts de bateaux et aménagements marins.",
        img: "/wood/iroko.jpg",
        tags: ["Marine", "Bateau"],
      },
      {
        title: "Mobilier durable",
        desc: "Meubles de jardin et d'extérieur d'une grande longévité.",
        img: "/wood/iroko.jpg",
        tags: ["Mobilier", "Jardin"],
      },
    ],
  },
  "epicea": {
    title: "Bastaings & Bois Blanc",
    uses: [
      {
        title: "Charpente & ossature",
        desc: "Bastaings, madriers et chevrons en épicéa pour la charpente, l'ossature et la structure des bâtiments.",
        img: "/wood/epicea-charpente.jpg",
        tags: ["Charpente", "Ossature", "Structure"],
      },
      {
        title: "Menuiserie",
        desc: "Ouvrages de menuiserie : meubles, agencements intérieurs, portes, fenêtres et mobilier sur mesure en épicéa.",
        img: "/wood/exemple-menuiserie.jpg",
        tags: ["Menuiserie", "Meubles", "Agencement"],
      },
      {
        title: "Bricolage",
        desc: "Idéal pour vos projets de bricolage : étagères, caisses, supports et petites réalisations en bois blanc.",
        img: "/wood/bricolage.jpg",
        tags: ["Bricolage", "Petits projets"],
      },
    ],
  },
  "eucalyptus": {
    title: "Eucalyptus",
    uses: [
      {
        title: "Poteaux & supports",
        desc: "Poteaux carrés d'eucalyptus pour tasseaux, supports et structures de soutien.",
        img: "/wood/eucalyptus.jpg",
        tags: ["Poteaux", "Support"],
      },
      {
        title: "Clôtures & brise-vue",
        desc: "Lattes et poteaux pour clôtures, brise-vue et palissades extérieures.",
        img: "/wood/eucalyptus.jpg",
        tags: ["Clôture", "Brise-vue"],
      },
      {
        title: "Extérieur traité",
        desc: "Bois résistant en usage extérieur quand il est traité autoclave.",
        img: "/wood/eucalyptus.jpg",
        tags: ["Extérieur", "Autoclave"],
      },
    ],
  },
};

const pu = {
  "bois de construction": {
    title: "Construction & Structure",
    uses: [
      { title: "Charpente", desc: "Madriers et chevrons pour la charpente.", img: "/wood/pin-sylvestre.jpg", tags: ["Charpente"] },
      { title: "Ossature", desc: "Bastaings et voliges pour l'ossature.", img: "/wood/epicea.jpg", tags: ["Ossature"] },
    ],
  },
  "bois traité autoclave": {
    title: "Extérieur",
    uses: [
      { title: "Terrasse", desc: "Lames de terrasse traitées pour l'extérieur.", img: "/wood/pin-sylvestre.jpg", tags: ["Terrasse"] },
      { title: "Poteaux", desc: "Poteaux traités au contact sol.", img: "/wood/epicea.jpg", tags: ["Poteaux"] },
    ],
  },
  "bois feuillus & nobles": {
    title: "Feuillus & Nobles",
    uses: [
      { title: "Ébénisterie", desc: "Plateaux nobles pour meubles.", img: "/wood/chene.jpg", tags: ["Ébénisterie"] },
      { title: "Cuisine", desc: "Plans de travail en bois massif.", img: "/wood/chene.jpg", tags: ["Cuisine"] },
    ],
  },
  "panneaux & dérivés": {
    title: "Panneaux & Coffrage",
    uses: [
      { title: "Coffrage", desc: "Plywood filmé pour coffrage de chantier.", img: "/wood/coffrage.jpg", tags: ["Coffrage"] },
      { title: "Agencement", desc: "Panneaux pour l'agencement intérieur.", img: "/wood/panneaux.jpg", tags: ["Agencement"] },
    ],
  },
};

// Exemples d'utilisation spécifiques par produit (SKU) — chaque produit de la
// page d'accueil "Nouveautés & produits en stock" a ses propres usages, pour
// éviter les doublons entre produits de même essence.
const bySku = {
  "PR-100-100-4000": {
    title: "Madrier Pin — Structures",
    uses: [
      {
        title: "Charpente & ossature",
        desc: "Madrier résineux pour la charpente, l'ossature et la structure porteuse des bâtiments.",
        img: "/wood/madrier-charpente.jpg",
        tags: ["Charpente", "Ossature", "Structure"],
      },
      {
        title: "Terrasse extérieure",
        desc: "Assemblé en solivage et lambourdes, il porte les platelages de terrasses et de balcons.",
        img: "/wood/madrier-terrasse.webp",
        tags: ["Terrasse", "Extérieur"],
      },
      {
        title: "Menuiserie & coffrage",
        desc: "Section robuste pour coffrage béton, étaiements et gros ouvrages de menuiserie.",
        img: "/wood/madrier-menuiserie.webp",
        tags: ["Coffrage", "Menuiserie"],
      },
    ],
  },
  "EPC-063-225-4000": {
    title: "Bastaing Épicéa",
    uses: [
      {
        title: "Charpente & ossature",
        desc: "Bastaing d'épicéa pour la charpente, l'ossature et la structure des bâtiments.",
        img: "/wood/epicea-charpente.jpg",
        tags: ["Charpente", "Ossature"],
      },
      {
        title: "Solivage & planchers",
        desc: "Porte les solives et planchers d'étage, mezzanines et zones de stockage.",
        img: "/wood/bastaing-epicea.jpg",
        tags: ["Solivage", "Plancher"],
      },
      {
        title: "Menuiserie",
        desc: "Ouvrages de menuiserie, mobilier sur mesure et aménagements intérieurs.",
        img: "/wood/exemple-menuiserie.jpg",
        tags: ["Menuiserie", "Meubles"],
      },
    ],
  },
  "PR-063-225-4000": {
    title: "Bastaing Pin",
    uses: [
      {
        title: "Solivage & planchers",
        desc: "Bastaing en pin pour porter les planchers, mezzanines et ossatures robustes.",
        img: "/wood/bastaing-solivage.jpg",
        tags: ["Solivage", "Plancher"],
      },
      {
        title: "Charpente",
        desc: "Pannes, arbalétriers et pièces de charpente en pin résineux.",
        img: "/wood/bastaing-charpente.webp",
        tags: ["Charpente", "Structure"],
      },
      {
        title: "Ossature & supports",
        desc: "Supports, encadrements et ossatures pour aménagements extérieurs et intérieurs.",
        img: "/wood/bastaing-ossature.webp",
        tags: ["Ossature", "Support"],
      },
    ],
  },
  "EPC-063-175-4000": {
    title: "Chevron Épicéa",
    uses: [
      {
        title: "Toiture & pente",
        desc: "Chevron léger pour la pose des versants et la couverture des toitures.",
        img: "/wood/chevronepicea-toiture.webp",
        tags: ["Toiture", "Pente"],
      },
      {
        title: "Pannes & arbalétriers",
        desc: "Panne intermédiaire et arbalétrier pour la charpente traditionnelle.",
        img: "/wood/chevronepicea-pannes.webp",
        tags: ["Pannes", "Arbalétriers"],
      },
      {
        title: "Ossature légère",
        desc: "Montants et ossatures légères pour cloisons et structures de faible portée.",
        img: "/wood/chevronepicea-ossature.webp",
        tags: ["Ossature", "Montants"],
      },
    ],
  },
  "PR-063-175-4000": {
    title: "Chevron Pin",
    uses: [
      {
        title: "Charpente de toiture",
        desc: "Chevron en pin pour supporter la couverture et les versants de toiture.",
        img: "/wood/chevronpin-charpente.webp",
        tags: ["Toiture", "Charpente"],
      },
      {
        title: "Pannes & supports",
        desc: "Pièces de charpente intermédiaires, pannes et support de liteaux.",
        img: "/wood/chevronpin-pannes.webp",
        tags: ["Pannes", "Supports"],
      },
      {
        title: "Ossature",
        desc: "Ossature bois pour cloisons, extensions et structures légères en pin.",
        img: "/wood/chevronpin-ossature.webp",
        tags: ["Ossature", "Structure"],
      },
    ],
  },
  "EPC-027-040-3000": {
    title: "Liteau Épicéa",
    uses: [
      {
        title: "Support de tuiles",
        desc: "Liteau fixé sur les chevrons pour recevoir tuiles, ardoises et couvertures.",
        img: "/wood/liteauepicea-tuiles.webp",
        tags: ["Toiture", "Tuiles"],
      },
      {
        title: "Contre-lattage",
        desc: "Contre-liteau et ventilation des toitures, isolation et habillage.",
        img: "/wood/liteauepicea-lattage.webp",
        tags: ["Contre-lattage", "Isolation"],
      },
      {
        title: "Tasseaux & montants",
        desc: "Tasseaux, montants et menuiseries légères pour aménagements intérieurs.",
        img: "/wood/liteauepicea-tasseaux.webp",
        tags: ["Tasseaux", "Montants"],
      },
    ],
  },
  "CFR-18-2500-1250": {
    title: "Panneau de Coffrage",
    uses: [
      {
        title: "Coffrage de béton",
        desc: "Panneau filmé bakélisé pour le coffrage des voiles, dalles et fondations en béton.",
        img: "/wood/coffrage-beton.webp",
        tags: ["Coffrage", "Béton"],
      },
      {
        title: "Coffrage de poteaux",
        desc: "Coffrage des poteaux, poutres et escaliers avec un parement lisse et net.",
        img: "/wood/coffrage-poteaux.webp",
        tags: ["Poteaux", "Poutres"],
      },
      {
        title: "Protection de chantier",
        desc: "Cloisons provisoires, protections de sol et surfaces de travail réutilisables.",
        img: "/wood/coffrage-protection.webp",
        tags: ["Chantier", "Protection"],
      },
    ],
  },
  "CPO-15-2500-1220": {
    title: "Contreplaqué Okoumé",
    uses: [
      {
        title: "Menuiserie intérieure",
        desc: "Contreplaqué d'okoumé pour meubles, caissons et ouvrages de menuiserie fine.",
        img: "/wood/okoume-menuiserie.webp",
        tags: ["Menuiserie", "Meubles"],
      },
      {
        title: "Agencement",
        desc: "Belles faces d'okoumé pour l'agencement de magasins et d'espaces intérieurs.",
        img: "/wood/okoume-agencement.webp",
        tags: ["Agencement", "Intérieur"],
      },
      {
        title: "Caisses & emballages",
        desc: "Panneau léger et stable pour caisses, emballages et aménagements légers.",
        img: "/wood/okoume-caisses.jpg",
        tags: ["Caisses", "Emballage"],
      },
    ],
  },
};

function norm(s = "") {
  return s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Return value = { title, uses[] } for a product.
// Priority: per-product SKU -> essence -> category.
export function usagesFor(product) {
  const sku = norm(product?.sku || "");
  if (sku) {
    for (const [key, value] of Object.entries(bySku)) {
      if (norm(key) === sku) return value;
    }
  }
  const essence = norm(product?.wood_type_name || "");
  for (const [key, value] of Object.entries(byKey)) {
    if (essence.includes(norm(key))) return value;
  }
  const cat = norm(product?.category || "");
  for (const [key, value] of Object.entries(pu)) {
    if (cat.includes(norm(key))) return value;
  }
  return {
    title: "Utilisations",
    uses: [
      { title: "Menuiserie", desc: "Ouvrages de menuiserie courante.", img: "/wood/panneaux.jpg", tags: ["Menuiserie"] },
      { title: "Bricolage", desc: "Panneaux et bois pour vos projets.", img: "/wood/panneaux.jpg", tags: ["Bricolage"] },
    ],
  };
}
