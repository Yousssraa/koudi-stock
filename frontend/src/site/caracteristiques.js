// Caractéristiques techniques (densité, élasticité, résistance, applications)
// des exemples de la boutique — valeurs indicatives issues de tableaux publics
// du négoce bois et des normes (NF EN 350, EN 13377, EN 10025, EN 13162…).
export const CARACTERISTIQUES = {
  "bois-menuiserie": {
    "Bois rouge — Pin sylvestre": {
      essence: "Pinus sylvestris",
      densite: "≈ 470 kg/m³ (sec à 12 %)",
      elasticite: "≈ 10 000 MPa",
      resistance: "Flexion : ≈ 75 MPa · Traction : ≈ 90 MPa · Compression : ≈ 40 MPa (indicatif)",
      applications: "Menuiserie intérieure & extérieure, charpente, coffrage, ébénisterie, agencement.",
    },
    "Bois blanc — Épicéa / Sapin du Nord": {
      essence: "Picea abies (épicéa)",
      densite: "≈ 440 kg/m³ (sec à 12 %)",
      elasticite: "≈ 11 000 MPa",
      resistance: "Flexion : 75 MPa · Traction : 90 MPa · Compression : 40 MPa (indicatif)",
      applications: "Menuiserie, cadres de portes et fenêtres, lamellé-collé, tourets, emballages, palettes, ossature bois.",
    },
    "Essences nobles — Chêne, Hêtre, Frêne, Noyer": {
      essence: "Quercus · Fagus · Fraxinus · Juglans",
      densite: "Chêne ≈ 710 · Hêtre ≈ 680 · Frêne ≈ 690 · Noyer ≈ 640 kg/m³ (à 12 %)",
      elasticite: "Chêne ≈ 12 000 · Hêtre ≈ 14 000 · Frêne ≈ 12 000 · Noyer ≈ 11 000 MPa",
      resistance: "Chêne : flexion ≈ 85 MPa, compression ≈ 50 MPa (indicatif)",
      applications: "Menuiserie de précision, ébénisterie, agencement, mobilier, parquets, escaliers.",
    },
  },
  "panneaux-decoratifs": {
    "MDF (brut, laqué, replaqué)": {
      essence: "Panneau de fibres de bois (moyenne densité)",
      densite: "≈ 500 à 800 kg/m³",
      elasticite: "≈ 2 000 à 3 000 MPa",
      resistance: "Flexion (MDF ≥ 19 mm) : ≈ 20 MPa (EN 622-5, indicatif)",
      applications: "Mobilier, agencement, portes, plans de travail, habillages muraux.",
    },
    "Contreplaqué OKOUMÉ": {
      essence: "Okoumé (Aucoumea klaineana)",
      densite: "≈ 450 à 520 kg/m³ (≤ 12 %)",
      elasticite: "≈ 8 000 à 9 500 MPa",
      resistance: "Flexion (sens parallèle) : ≈ 60 à 70 MPa (indicatif)",
      applications: "Mobilier, agencement, caisserie, extérieur et marine (collage WBP classe 3).",
    },
    "HDF (brut & laqué)": {
      essence: "Panneau de fibres dures",
      densite: "≈ 900 à 1 000 kg/m³",
      elasticite: "≈ 3 000 à 4 000 MPa",
      resistance: "Flexion : ≈ 30 à 40 MPa (indicatif)",
      applications: "Fonds de placard, panneaux de portes, emballage, industrie.",
    },
  },
  "produits-coffrage": {
    "Contreplaqué filmé bakélisé": {
      essence: "Pin, bouleau, peuplier, eucalyptus (contreplaqué filmé phénolique)",
      densite: "≈ 610 à 700 kg/m³",
      elasticite: "≈ 8 000 à 12 000 MPa (selon âme)",
      resistance: "Béton coffré : voir fiches portées des fabricants (EN 13353 / EN 314-2 classe 3)",
      applications: "Coffrage béton : banches, dalles, voiles — 2 à 40 coulages selon le film (120/170/220 g/m²).",
    },
    "Poutres H20 & panneaux triplis": {
      essence: "Épicéa / sapin (semelles) · âme contreplaqué",
      densite: "≈ 4,4 à 4,8 kg/ml (H20) · triplis ≈ 12,5 kg/m²",
      elasticite: "EI = 450 kN·m² (H20)",
      resistance: "M = 5 kN·m · Q = 11 kN (classe P20, EN 13377)",
      applications: "Planchers et coffrages bois, dalles de 15 à 30 cm.",
    },
    "Madriers & bois de coffrage": {
      essence: "Épicéa, pin maritime, pin radiata, grandis, sapin",
      densite: "≈ 450 à 520 kg/m³ (résineux, à 12 %)",
      elasticite: "≈ 10 000 à 12 000 MPa",
      resistance: "Classement structurel C18/C24 (EN 14081-1)",
      applications: "Coffrage traditionnel : banches, butons, platelage, éléments de soutènement.",
    },
  },
  "isolation-etancheite": {
    "Laine de verre": {
      essence: "Isolant minéral (verre recyclé / calcin)",
      densite: "≈ 10 à 60 kg/m³ (selon produit)",
      elasticite: "Matériau fibreux souple",
      resistance: "Incombustible A1 (laine nue) · λ 0,030 à 0,040 W/m·K (EN 13162)",
      applications: "Isolation murs, combles, cloisons, planchers et toitures.",
    },
    "Laine de roche": {
      essence: "Isolant minéral (basalte)",
      densite: "≈ 40 à 175 kg/m³",
      elasticite: "Matériau fibreux semi-rigide",
      resistance: "Tenue au feu > 1 000 °C · Euroclasse A1/A2 · λ 0,032 à 0,042 W/m·K",
      applications: "Isolation thermique et acoustique, toitures-terrasses, cloisons.",
    },
    "Étanchéité bitumineuse": {
      essence: "Bitume modifié SBS/APP armé polyester ou verre",
      densite: "≈ 4 à 5 kg/m² (membrane 3 à 4 mm)",
      elasticite: "Allongement à la rupture élevé (SBS autocicatrisant)",
      resistance: "Flexion à froid < -15 °C · point de ramollissement ≥ 100 °C",
      applications: "Toitures-terrasses, toitures sarking, ouvrages enterrés (systèmes mono ou bicouche).",
    },
  },
  "amenagement-interieur": {
    "Parquet en chêne / hêtre": {
      essence: "Chêne (Quercus) · Hêtre (Fagus)",
      densite: "Chêne ≈ 710 · Hêtre ≈ 680 kg/m³",
      elasticite: "≈ 12 000 à 14 000 MPa",
      resistance: "Dureté Brinell : chêne 3,5-4 · usages classe 21-23 (domestique) / 31-34 (commercial)",
      applications: "Sols intérieurs, pose collée, clouée ou flottante (NF EN 13226 / 13489).",
    },
    "Lambris & habillages muraux": {
      essence: "Pin, sapin du Nord, épicéa, peuplier",
      densite: "≈ 420 à 520 kg/m³",
      elasticite: "≈ 10 000 à 12 000 MPa",
      resistance: "Qualités AB / C / D selon aspect (choix Petit Nœud / Sans Nœud)",
      applications: "Revêtements muraux et de plafond, profils rainure-languette (élégie, grain d'orge, mouchette).",
    },
    "Plinthes & quarts de rond": {
      essence: "Chêne, pin, sapin, hêtre, peuplier, MDF plaqué",
      densite: "≈ 450 à 710 kg/m³ selon essence",
      elasticite: "Menuiserie de finition",
      resistance: "Profils massifs ou plaqués (chêne, pin, MDF stratifié)",
      applications: "Finition sol-mur : masquage du jeu de dilatation du parquet, jonctions d'angles.",
    },
  },
  "amenagement-exterieur": {
    "Lame de terrasse pin autoclave classe 4": {
      essence: "Pin sylvestre (traitement autoclave classe 4)",
      densite: "≈ 490 à 560 kg/m³",
      elasticite: "≈ 10 000 MPa",
      resistance: "Classe d'emploi 4 (NF EN 335) · durée de vie > 20 ans",
      applications: "Terrasses extérieures sur lambourdes (DTU 51.4), abords de piscine.",
    },
    "Lame de terrasse bois exotique": {
      essence: "Ipé, Cumaru, Bangkirai, Padouk",
      densite: "≈ 800 à 1 100 kg/m³",
      elasticite: "≈ 16 000 à 22 000 MPa",
      resistance: "Durabilité naturelle classe 4-5 (NF EN 350) · durée de vie 30 à 50 ans",
      applications: "Terrasses haut de gamme, platelages, escaliers et structures extérieures (DTU 51.4).",
    },
    "Bardage & palissade": {
      essence: "Pin sylvestre / sapin-épicéa (autoclave classe 3-4)",
      densite: "≈ 450 à 520 kg/m³",
      elasticite: "≈ 10 000 MPa",
      resistance: "Classe d'emploi 3-4 (NF EN 335) · imprégnation 5 à 12 mm",
      applications: "Bardage ventilé de façades, abris, chalets, palissades et clôtures.",
    },
  },
  "tole-fer-beton": {
    "Fer à béton (rond HLE)": {
      essence: "Acier à béton armé (B500A / B500B / B500C)",
      densite: "Acier 7 850 kg/m³ · masse linéaire ≈ 0,222 kg/ml (Ø6) à 3,85 kg/ml (Ø25)",
      elasticite: "E ≈ 200 000 MPa",
      resistance: "Limite d'élasticité Re ≥ 500 MPa (NF EN 10080)",
      applications: "Ferraillage béton armé : chaînages, poteaux, dalles, longrines — longueurs 2 et 6 m.",
    },
    "Tôle acier plane": {
      essence: "Acier laminé à chaud / à froid / galvanisé",
      densite: "7 850 kg/m³",
      elasticite: "E ≈ 200 000 MPa",
      resistance: "Limite d'élasticité S235 : 235 MPa (EN 10025-2)",
      applications: "Construction métallique, serrurerie, chaudronnerie, capotages.",
    },
    "Bac acier nervuré": {
      essence: "Acier prélaqué / galvanisé (S320GD, DX51D)",
      densite: "7 850 kg/m³ · ≈ 4 à 8 kg/m² selon épaisseur (0,50 à 1,00 mm)",
      elasticite: "E ≈ 200 000 MPa",
      resistance: "Plaques autoportantes NF EN 14782 / NF EN 508-1",
      applications: "Couverture de toiture et bardage sur ossature bois ou métallique (5 ondes, 45T/36T).",
    },
  },
};