// Les 7 familles de la boutique (style catalogue bois Comarbois, référence du
// marché marocain). Contenu documenté à partir d'informations publiques sur le
// négoce bois & matériaux : essences, provenances, durabilité (NF EN 350),
// applications. Chaque famille affiche 3 exemples de produits à l'ouverture.
export const FAMILLES = [
  {
    key: "bois-menuiserie",
    label: "BOIS DE MENUISERIE & INDUSTRIELS",
    image: "/wood/menuiserie.jpg",
    description:
      "Résineux (bois rouge, bois blanc) et feuillus nobles pour la menuiserie, la charpente, l'ébénisterie et l'industrie.",
    examples: [
      {
        name: "Bois rouge — Pin sylvestre",
        essence: "Essence Pin sylvestre · Provenance Suède, Finlande",
        description:
          "Bois résineux au veinage rougeâtre, sec à 18 %. Menuiserie intérieure et extérieure, charpente, coffrage, ébénisterie. Densité ≈ 470 kg/m³.",
        image: "/wood/pin-sylvestre.jpg",
      },
      {
        name: "Bois blanc — Épicéa / Sapin du Nord",
        essence: "Essence Épicéa · Provenance Nord de l'Europe",
        description:
          "Bois tendre, clair et léger. Menuiserie intérieure et extérieure, cadres de portes et fenêtres, lamellé-collé, emballages et ossature bois.",
        image: "/wood/epicea.jpg",
      },
      {
        name: "Essences nobles — Chêne, Hêtre, Frêne, Noyer",
        essence: "Provenances France, Europe, Amérique du Nord",
        description:
          "Feuillus durs (chêne ≈ 710 kg/m³, hêtre ≈ 680 kg/m³) pour la menuiserie de précision, le mobilier, l'agencement et les parquets.",
        image: "/wood/chene.jpg",
      },
    ],
  },
  {
    key: "panneaux-decoratifs",
    label: "PANNEAUX DÉCORATIFS & INDUSTRIELS",
    image: "/wood/panneau-deco.jpg",
    description:
      "Panneaux dérivés du bois : MDF, HDF, contreplaqués, particules — bruts, laqués, replaqués et panneaux de portes.",
    examples: [
      {
        name: "MDF (brut, laqué, replaqué)",
        essence: "Fibres de bois · densité 500-800 kg/m³",
        description:
          "Panneau de fibres homogène, facile à usiner, peindre et vernir. Menuiserie, agencement, cuisine et décoration intérieure.",
        image: "/wood/mdf-photo.jpg",
      },
      {
        name: "Contreplaqué OKOUMÉ",
        essence: "Âme okoumé · plis croisés",
        description:
          "Contreplaqué léger, stable et imputrescible. Idéal pour le mobilier, l'agencement et la caisserie. Formats standard 1,22 × 2,44 m.",
        image: "/wood/contreplaque-okoume.jpg",
      },
      {
        name: "HDF (brut & laqué)",
        essence: "Fibres dures · plus dense que le MDF",
        description:
          "Panneau haute densité en décors chêne, hêtre, wenge, acajou ou teintes unies. Portes, menuiserie, emballage et agencement.",
        image: "/wood/panneau-deco.jpg",
      },
    ],
  },
  {
    key: "produits-coffrage",
    label: "PRODUITS DE COFFRAGE",
    image: "/wood/coffrage-new.jpg",
    description:
      "Solutions réutilisables pour béton : contreplaqué filmé bakélisé, poutres H20, madriers et bois de coffrage.",
    examples: [
      {
        name: "Contreplaqué filmé bakélisé",
        essence: "Pin, bouleau, peuplier, eucalyptus",
        description:
          "Panneau 2 faces film phénolique 170 g/m², antidérapant possible. Origines Finlande, Espagne, Brésil, Russie. Décoffrage facile, réutilisation optimisée.",
        image: "/wood/contreplaque-bakelise.jpg",
      },
      {
        name: "Poutres H20 & panneaux triplis",
        essence: "Bois résineux · système coffrage",
        description:
          "Poutres de coffrage réutilisables à grande portée, complétées de panneaux triple pli. Qualité et optimisation des coûts sur chantier.",
        image: "/wood/bois-charpente.jpg",
      },
      {
        name: "Madriers & bois de coffrage",
        essence: "Épicéa, pin maritime, pin radiata, grandis, sapin",
        description:
          "Bois massif de section importante pour les banches, butons et éléments de coffrage traditionnel en béton armé.",
        image: "/wood/madrier-photo.jpg",
      },
    ],
  },
  {
    key: "isolation-etancheite",
    label: "ISOLATION & ÉTANCHÉITÉ",
    image: "/wood/isolation.jpg",
    description:
      "Isolation thermique et acoustique (laines, plaques, panneaux) et étanchéité de toiture (feuilles bitumineuses).",
    examples: [
      {
        name: "Laine de verre",
        essence: "Isolant minéral · λ dès 0,030 W/m.K",
        description:
          "Excellent rapport performance/prix pour murs, combles, cloisons et planchers. Réduit aussi les nuisances sonores.",
        image: "/wood/isolation.jpg",
      },
      {
        name: "Laine de roche",
        essence: "Isolant minéral · bonne tenue au feu",
        description:
          "Plus dense, idéale pour l'isolation phonique, l'acoustique des cloisons et les plafonds. Support d'enduits et sous-étanchéité.",
        image: "/wood/isolation.jpg",
      },
      {
        name: "Étanchéité bitumineuse",
        essence: "Feuilles bitumineuses · toitures",
        description:
          "Feuilles d'étanchéité pour toitures-terrasses, posées à chaud ou à froid. Complétées par plaques de plâtre et panneaux isolants.",
        image: "/wood/isolation.jpg",
      },
    ],
  },
  {
    key: "amenagement-interieur",
    label: "AMÉNAGEMENT INTÉRIEUR",
    image: "/wood/panneau-deco.jpg",
    description:
      "Parquets, lambris, plinthes et quarts de rond, portes et habillages pour finir et valoriser l'intérieur.",
    examples: [
      {
        name: "Parquet en chêne / hêtre",
        essence: "Massif ou contrecollé",
        description:
          "Lames rainure-languette, naturellement robustes et élégantes. Pose collée, clouée ou flottante selon la structure.",
        image: "/wood/chene.jpg",
      },
      {
        name: "Lambris & habillages muraux",
        essence: "Pin, sapin, essences fines",
        description:
          "Revêtements muraux et plafonds en lames ou panneaux, bruts ou rabotés, pour une ambiance chaleureuse et facile à entretenir.",
        image: "/wood/menuiserie.jpg",
      },
      {
        name: "Plinthes & quarts de rond",
        essence: "Bois massif, MDF ou décor",
        description:
          "Finitions entre sol et mur qui accompagnent parquet et stratifié. Sections et essences variées, à peindre ou vernies.",
        image: "/wood/menuiserie.jpg",
      },
    ],
  },
  {
    key: "amenagement-exterieur",
    label: "AMÉNAGEMENT EXTÉRIEUR",
    image: "/wood/amenagement-ext.jpg",
    description:
      "Lames de terrasse, bardage, palissades et structures extérieures en bois autoclave classe 3-4 ou essence durable.",
    examples: [
      {
        name: "Lame de terrasse pin autoclave classe 4",
        essence: "Pin sylvestre · traitement autoclave marron/vert",
        description:
          "Environ 27 × 145 mm. Résiste à l'humidité et aux insectes, teinte brune qui limite l'entretien. Durée de vie de 20 ans et plus.",
        image: "/wood/amenagement-ext.jpg",
      },
      {
        name: "Lame de terrasse bois exotique",
        essence: "Ipé, Cumaru, Bangkirai, Padouk · classe 5",
        description:
          "Essences naturellement durables, très denses, patine gris argenté avec le temps. Le choix haut de gamme pour terrasses sur pilotis.",
        image: "/wood/iroko.jpg",
      },
      {
        name: "Bardage & palissade",
        essence: "Pin / sapin traité classe 3-4",
        description:
          "Lames de bardage ventilé et éléments de clôture, autoclave vert ou brun, pour façades, carports et aménagements de jardin.",
        image: "/wood/epicea.jpg",
      },
    ],
  },
  {
    key: "tole-fer-beton",
    label: "TÔLE & FER À BÉTON",
    image: "/wood/fer-a-beton.jpg",
    description:
      "Acier de gros œuvre : rond à béton haute adhérence, tôles planes et bacs acier pour la construction.",
    examples: [
      {
        name: "Fer à béton (rond HLE)",
        essence: "Acier B500 · diamètres 6 à 25 mm",
        description:
          "Barres torsadées haute adhérence, longueurs 2 et 6 m, cintrables. Armatures et ferraillages du béton armé (dallages, semelles, chaînages).",
        image: "/wood/fer-a-beton.jpg",
      },
      {
        name: "Tôle acier plane",
        essence: "Laminée à chaud ou à froid, galvanisée",
        description:
          "Plaques et feuilles d'acier pour planchers, capotages, chaudronnerie et fabrication métallique. Diverses épaisseurs et formats.",
        image: "/wood/fer-a-beton.jpg",
      },
      {
        name: "Bac acier nervuré",
        essence: "Acier protégé anti-corrosion",
        description:
          "Tôles nervurées ou ondulées pour toiture et bardage, posées sur ossature bois ou métallique. Léger, rapide à mettre en œuvre.",
        image: "/wood/fer-a-beton.jpg",
      },
    ],
  },
];