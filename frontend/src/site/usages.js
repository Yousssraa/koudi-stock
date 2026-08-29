// Exemples d'utilisation par essence / catégorie de bois.
// Chaque usage = titre + description + image existante de la palette (/public/wood).
const byKey = {
  "pin sylvestre": {
    title: "Pin Sylvestre (Bois Rouge)",
    uses: [
      {
        title: "Charpente & ossature",
        desc: "Madriers, bastaings et chevrons en pin sylvestre pour la charpente, l'ossature et la structure des bâtiments.",
        img: "/wood/pin-sylvestre.jpg",
        tags: ["Charpente", "Ossature", "Structure"],
      },
      {
        title: "Terrasse extérieure",
        desc: "Lames de terrasse en pin traité autoclave : sols de terrasses, balcons et abords de piscine résistants.",
        img: "/wood/pin-sylvestre.jpg",
        tags: ["Terrasse", "Extérieur"],
      },
      {
        title: "Menuiserie & coffrage",
        desc: "Voliges et planches de coffrage pour vos chantiers et vos travaux de menuiserie courante.",
        img: "/wood/coffrage.jpg",
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
        img: "/wood/panneaux.jpg",
        tags: ["Sièges", "Cintrage"],
      },
      {
        title: "Menuiserie intérieure",
        desc: "Portes, cadres et aménagements intérieurs en hêtre clair et stable.",
        img: "/wood/panneaux.jpg",
        tags: ["Portes", "Intérieur"],
      },
      {
        title: "Jouets & objets",
        desc: "Bois sain et sans échardes pour jouets, ustensiles et objets de précision.",
        img: "/wood/panneaux.jpg",
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
  "eucalyptus": {
    title: "Eucalyptus",
    uses: [
      {
        title: "Poteaux & supports",
        desc: "Poteaux carrés d'eucalyptus pour tasseaux, supports et structures de soutien.",
        img: "/wood/epicea.jpg",
        tags: ["Poteaux", "Support"],
      },
      {
        title: "Clôtures & brise-vue",
        desc: "Lattes et poteaux pour clôtures, brise-vue et palissades extérieures.",
        img: "/wood/epicea.jpg",
        tags: ["Clôture", "Brise-vue"],
      },
      {
        title: "Extérieur traité",
        desc: "Bois résistant en usage extérieur quand il est traité autoclave.",
        img: "/wood/epicea.jpg",
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

function norm(s = "") {
  return s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Returns { title, uses[] } for a product (matched by essence, then category).
export function usagesFor(product) {
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
