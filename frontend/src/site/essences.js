// Données « fiche essence » de secours (fallback) côté vitrine.
// Le serveur (/api/public/essences/) est la source de vérité ; ce fichier sert
// de repli hors-ligne et fournit aussi les images/icônes par essence.
const ESSENCE_IMAGES = {
  "Pin sylvestre": "/wood/pin-sylvestre.jpg",
  "Pin Sylvestre (Bois Rouge)": "/wood/pin-sylvestre.jpg",
  "Épicéa": "/wood/epicea.jpg",
  "Sapin du Nord (Bois Blanc)": "/wood/epicea.jpg",
  "Sapelli": "/wood/sapelli.jpg",
  "Kossipo": "/wood/kossipo.jpg",
  "Dabema": "/wood/dabema.jpg",
  "Dibétou": "/wood/dibetou.jpg",
  "Iroko": "/wood/iroko.jpg",
  "Chêne": "/wood/chene.jpg",
  "Noyer": "/wood/noyer.jpg",
  "Okoumé": "/wood/okoume.jpg",
  "Hêtre étuvé": "/wood/hetre-etuve.jpg",
  "Eucalyptus": "/wood/eucalyptus.jpg",
};

export function essenceImage(name) {
  const key = (name || "").toLowerCase();
  for (const [n, img] of Object.entries(ESSENCE_IMAGES)) {
    if (key.includes(n.toLowerCase())) return img;
  }
  return "/wood/panneaux.jpg";
}

export const FALLBACK_ESSENCES = [
  {
    name: "Pin sylvestre",
    comarbois_family: "Menuiserie & Agencement",
    category: "Softwood",
    common_names: "Pin rouge du Nord, Bois rouge",
    density_kg_m3: 510,
    provenances: "Scandinavie (Suède, Finlande), Russie, Baltique",
    durability_class: "Classe 3-4 (peu durable — à traiter en extérieur)",
    moisture_note: "Séchage rapide et facile ; faible retrait ; humidité d'équilibre 12-16 %",
    description:
      "Le pin sylvestre, dit « bois rouge » du Nord, est le grand classique de la construction et de la charpente. Tendre et résineux, il se travaille facilement, se cloue et se visse aisément. Traité autoclave, il prolonge sa durée de vie en usage extérieur.",
  },
  {
    name: "Épicéa",
    comarbois_family: "Menuiserie & Agencement",
    category: "Softwood",
    common_names: "Sapin du Nord, Bois blanc",
    density_kg_m3: 450,
    provenances: "Scandinavie (Suède, Finlande), Europe du Nord",
    durability_class: "Classe 4 (peu durable — à traiter en extérieur)",
    moisture_note: "Séchage rapide ; léger et stable ; humidité d'équilibre 12-16 %",
    description:
      "L'épicéa, ou « bois blanc » du Nord, est léger, résineux et très régulier. Idéal pour la charpente légère, l'ossature, les voliges et le doublage. Excellent rapport qualité-prix.",
  },
  {
    name: "Sapelli",
    comarbois_family: "Menuiserie & Agencement",
    category: "Exotic",
    common_names: "Sapelli africain",
    density_kg_m3: 650,
    provenances: "Afrique centrale (Cameroun, Gabon, Congo)",
    durability_class: "Classe 2-3 (durable)",
    moisture_note: "Séchage lent — nécessite un séchoir ; bonne stabilité une fois sec",
    description:
      "Le sapelli est un bois exotique rouge-brun aux reflets dorés, très apprécié en agencement, ébénisterie et menuiserie intérieure. Stable et de belle apparence.",
  },
  {
    name: "Kossipo",
    comarbois_family: "Menuiserie & Agencement",
    category: "Exotic",
    common_names: "Kossipo, Sipo ligné",
    density_kg_m3: 640,
    provenances: "Afrique centrale (Cameroun, Gabon, Congo)",
    durability_class: "Classe 2-3 (durable)",
    moisture_note: "Séchage lent ; retrait faible ; stable en service",
    description:
      "Le kossipo est un bois exotique dense et durable, proche du sapelli. Il convient à l'ébénisterie, la menuiserie intérieure et les aménagements à forte sollicitation mécanique.",
  },
  {
    name: "Dabema",
    comarbois_family: "Aménagement Int./Ext.",
    category: "Exotic",
    common_names: "Dabema africain",
    density_kg_m3: 690,
    provenances: "Afrique de l'Ouest et centrale (Cameroun, Côte d'Ivoire)",
    durability_class: "Classe 2 (très durable)",
    moisture_note: "Séchage lent ; moyennement nerveux ; faible humidité d'équilibre",
    description:
      "Le dabema est un bois exotique dur et dense à veinage soutenu. Sa durabilité naturelle le destine à l'aménagement extérieur, à la menuiserie lourde et aux structures.",
  },
  {
    name: "Dibétou",
    comarbois_family: "Menuiserie & Agencement",
    category: "Exotic",
    common_names: "Noyer d'Afrique",
    density_kg_m3: 560,
    provenances: "Afrique centrale et de l'Ouest (Gabon, Cameroun)",
    durability_class: "Classe 3-4 (peu durable en extérieur)",
    moisture_note: "Séchage assez rapide ; retrait faible ; très stable",
    description:
      "Le dibétou, surnommé « noyer d'Afrique », présente un beau bois jaune doré à brun, très stable et facile à travailler. Idéal pour le mobilier, la menuiserie fine et le placage.",
  },
  {
    name: "Iroko",
    comarbois_family: "Aménagement Int./Ext.",
    category: "Exotic",
    common_names: "Teck d'Afrique",
    density_kg_m3: 650,
    provenances: "Afrique de l'Ouest et centrale (Côte d'Ivoire, Ghana, Congo)",
    durability_class: "Classe 1-2 (très durable — imputrescible)",
    moisture_note: "Séchage lent, peu de fentes ; excellente stabilité en service",
    description:
      "L'iroko, « teck d'Afrique », est un bois imputrescible d'une durabilité exceptionnelle. Indispensable pour les terrasses, le mobilier de jardin et l'agencement exposé à l'humidité.",
  },
  {
    name: "Chêne",
    comarbois_family: "Aménagement Int./Ext.",
    category: "Hardwood",
    common_names: "Chêne rouvre, Chêne pédonculé",
    density_kg_m3: 720,
    provenances: "France, Europe centrale, Russie",
    durability_class: "Classe 2 (durable)",
    moisture_note: "Séchage lent ; fort retrait ; nécessite une saison soignée",
    description:
      "Le chêne est l'essence noble par excellence. Dense, résistant et chaleureux, il se prête à l'ébénisterie, aux plans de travail, aux escaliers et au parquet.",
  },
  {
    name: "Noyer",
    comarbois_family: "Menuiserie & Agencement",
    category: "Hardwood",
    common_names: "Noyer européen",
    density_kg_m3: 640,
    provenances: "Europe (France, Italie, Espagne), Asie Mineure",
    durability_class: "Classe 3 (moyennement durable)",
    moisture_note: "Séchage lent et soigneux ; très stable une fois sec",
    description:
      "Le noyer est un bois noble brun chocolat aux veinures magnifiques. Très prisé en ébénisterie d'art, placage et mobilier haut de gamme.",
  },
  {
    name: "Okoumé",
    comarbois_family: "Panneaux",
    category: "Exotic",
    common_names: "Okoumé du Gabon",
    density_kg_m3: 440,
    provenances: "Gabon, Afrique centrale (bassins de l'Ogooué)",
    durability_class: "Classe 3-4 (à protéger en extérieur)",
    moisture_note: "Séchage rapide et sans problème ; très stable ; humidité 8-12 %",
    description:
      "L'okoumé est le bois de référence du contreplaqué. Léger, stable et résistant, il est largement utilisé pour les panneaux contreplaqués et la construction légère.",
  },
  {
    name: "Hêtre étuvé",
    comarbois_family: "Menuiserie & Agencement",
    category: "Hardwood",
    common_names: "Hêtre commun",
    density_kg_m3: 690,
    provenances: "Europe (France, Allemagne, Europe centrale)",
    durability_class: "Classe 5 (peu durable — intérieur uniquement)",
    moisture_note: "Séchage assez rapide ; fort retrait ; stable une fois étuvé",
    description:
      "Le hêtre étuvé est un bois blanc clair et homogène, idéal pour les sièges, la menuiserie intérieure, les objets et l'agencement.",
  },
  {
    name: "Eucalyptus",
    comarbois_family: "Aménagement Int./Ext.",
    category: "Exotic",
    common_names: "Eucalyptus globulus",
    density_kg_m3: 750,
    provenances: "Australie, Amérique du Sud, Afrique du Nord (Maroc)",
    durability_class: "Classe 2 (durable — résistant au contact sol)",
    moisture_note: "Séchage rapide ; sujet à la torsion si mal séché ; très dense",
    description:
      "L'eucalyptus est un bois exotique dense, dur et résistant, souvent utilisé pour les poteaux, clôtures, brise-vue et structures extérieures.",
  },
];

export function normalizeName(s = "") {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
