// « Notre savoir-faire » — les domaines d'expertise KOUDI WOOD, regroupés par
// famille Comarbois (Menuiserie & Agencement, Panneaux, Aménagement Int./Ext.,
// Produits métallurgiques).
export const SAVOIR_FAIRE = {
  title: "NOTRE SAVOIR-FAIRE",
  subtitle:
    "Importateur et distributeur de bois massifs, panneaux et matériaux de construction, KOUDI WOOD met son expertise au service des artisans, menuisiers et professionnels du BTP depuis Casablanca.",
  families: [
    {
      id: "menuiserie-agencement",
      key: "Menuiserie & Agencement",
      icon: "🪑",
      title: "Menuiserie & Agencement",
      tagline: "Portes, cadres & agencements",
      short: "Menuiserie & Agencement",
      text: "Bois massifs et dérivés pour la menuiserie, l'agencement de magasins, bureaux et habitations : chêne, hêtre étuvé, sapelli, noyer et contreplaqués, en plateau ou panneau, livrés à vos dimensions.",
      vignettes: [
        { label: "Menuiserie intérieure", text: "Portes, cadres, boiseries." },
        { label: "Agencement", text: "Magasins, bureaux, dressing." },
        { label: "Ébénisterie", text: "Mobilier et pièces sur mesure." },
      ],
      img: "/wood/chene.jpg",
    },
    {
      id: "panneaux",
      key: "Panneaux",
      icon: "🧱",
      title: "Panneaux & Dérivés",
      tagline: "Panneaux, découpe sur mesure",
      short: "Panneaux & Dérivés",
      text: "Une gamme complète de panneaux : MDF brut et décor, stratifié, latté, OSB, High Gloss et contreplaqué okoumé. Des formats standard 1,22 × 2,44 m aux découpes sur mesure pour vos finitions.",
      vignettes: [
        { label: "Panneaux décoratifs", text: "MDF, stratifié, High Gloss." },
        { label: "Panneaux techniques", text: "OSB, latté, contreplaqué." },
        { label: "Découpe sur mesure", text: "Formats et arasés à la demande." },
      ],
      img: "/wood/panneaux.jpg",
    },
    {
      id: "amenagement-int-ext",
      key: "Aménagement Int./Ext.",
      icon: "🌳",
      title: "Aménagement Int. / Ext.",
      tagline: "Terrasses & extérieurs durables",
      short: "Aménagement Int. / Ext.",
      text: "Des essences durables et traitées pour l'aménagement extérieur et le contact sol : terrasse en pin autoclave ou iroko, poteaux, brise-vue, clôtures et structures. Solutions résistantes aux intempéries.",
      vignettes: [
        { label: "Terrasses", text: "Lames bois ou exotique, platelage." },
        { label: "Ossatures & poteaux", text: "Autoclave Cl.3 / Cl.4, iroko." },
        { label: "Extérieur durable", text: "Résistance à l'humidité et au sol." },
      ],
      img: "/wood/iroko.jpg",
    },
    {
      id: "produits-metallurgiques",
      key: "Produits métallurgiques",
      icon: "🔩",
      title: "Produits métallurgiques",
      tagline: "Fixations & quincaillerie",
      short: "Produits métallurgiques",
      text: "Quincaillerie et accessoires métalliques pour la pose et la fixation : supports, sabots, platines, connecteurs et consommables indispensables à vos chantiers de charpente et de menuiserie.",
      vignettes: [
        { label: "Fixations & connecteurs", text: "Sabots, platines, étriers." },
        { label: "Quincaillerie", text: "Pose de charpente et de terrasse." },
        { label: "Consommables", text: "Accessoires de chantier." },
      ],
      img: "/wood/coffrage.jpg",
    },
  ],
};

export function savoirFaireForFamily(key) {
  return (
    SAVOIR_FAIRE.families.find((f) => f.id === key) ||
    SAVOIR_FAIRE.families.find((f) => f.key === key) ||
    null
  );
}
