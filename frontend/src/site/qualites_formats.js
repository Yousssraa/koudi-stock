// Rubriques « Qualités » (classements, certifications, gradations) et
// « Spécificités & formats » (formats de vente) des exemples de la boutique.
// Valeurs documentées à partir des référentiels du négoce bois & matériaux
// (NF EN 975-1, EN 14081-1, EN 622-5, EN 314-2, EN 13162, EN 10080, PEFC/FSC,
// CTB B+, DTU 51.4…) et des usages courants du marché.
export const QUALITES_FORMATS = {
  "bois-menuiserie": {
    "Bois rouge — Pin sylvestre": {
      qualites:
        "Classements d'aspect du négoce nordique : 1er choix Unsorted, choix V, VI, Schaal et VII ; bois de structure classés C24 (EN 14081-1) ; filières PEFC/FSC, marquage CE pour la construction et dispositions ISPM 15.",
      specif:
        "Avivés, planches, bastaings et madriers (27 à 100 mm d'épaisseur) ; lambris rabotés rainure-languette ; plots et sections sur mesure. Longueurs 2,7 à 6,1 m, largeurs 75 à 225 mm.",
    },
    "Bois blanc — Épicéa / Sapin du Nord": {
      qualites:
        "Tri des scieries scandinaves en choix A/B ou VA1 ; charpente classée C18/C24 (EN 14081-1, classes D35-D40 par classement visuel NF B 52-001-1) ; lambris qualité Petit Nœud / Sans Nœud ; PEFC/FSC.",
      specif:
        "Avivés, planches et bastaings (25, 32, 38, 50, 63, 75 mm) ; chevrons et madriers pour charpente ; lambris rabotés 10-20 mm en profils plats ou moulurés. Longueurs 2 à 6 m.",
    },
    "Essences nobles — Chêne, Hêtre, Frêne, Noyer": {
      qualites:
        "Classements d'aspect normalisés NF EN 975-1 : chêne Q-F1a à Q-F4, hêtre F-B1 à F-B3 ; bois importés gradés FAS / 1ère-choice (First & Seconds) ; 1er choix Unsorted courant ; PEFC/FSC et démarches Bois de France.",
      specif:
        "Plots, plateaux, avivés et frises (40-100 mm), carrelets massifs, débits rabotés ou bruts de sciage ; parquet massif chêne 14-21 mm ; sciages sur dosse, demi-dosse ou quartier.",
    },
  },
  "panneaux-decoratifs": {
    "MDF (brut, laqué, replaqué)": {
      qualites:
        "Conforme NF EN 622-5 (types MDF/MDF.H) et EN 13986, marquage CE ; émissions formaldéhyde classe E1 (≤ 0,124 mg/m³) ; réaction au feu D-s2,d0 ≥ 9 mm ; FSC/PEFC disponibles ; faces poncées 2 faces, choisies ou sélectées.",
      specif:
        "Panneaux 2440×1220 mm (ép. 2,5 à 30 mm), formats 2800×2070 et 3050×1830 mm ; bruts, laqués unis, replaqués ; délignage et découpe au mm, chants collés sur demande.",
    },
    "Contreplaqué OKOUMÉ": {
      qualites:
        "EN 636-1/-3 (WBP phénolique), collage EN 314-2 classe 3, faces classées EN 635-2 (B/BB) ; marquage CE 2+ EN 13986 ; classe E1, émissions COV A+, réaction au feu D-s2,d0 ≥ 9 mm ; FSC possible.",
      specif:
        "Panneaux 2500×1220 et 3100×1530 mm (ép. 3 à 40 mm) ; découpe sur mesure ± 1 mm et débit en atelier ; rainures/languettes sur demande ; version marine 8-13 % d'humidité.",
    },
    "HDF (brut & laqué)": {
      qualites:
        "EN 622-2 (HDF) et EN 13986, marquage CE ; sans colle ni formaldéhyde : classe E1, conformité CARB II / TSCA ; masse volumique ≈ 1000 kg/m³ ; face lisse et face toilée, versions lisse, perforée et laquée.",
      specif:
        "Panneaux 1220×1220, 2440×1220, 2750×1220/1300 et 3050×1220 mm ; ép. 2,5 / 2,7 / 3 mm en stock (jusqu'à 4 mm sur commande) ; perforé Ø 4 mm entraxe 13 mm.",
    },
  },
  "produits-coffrage": {
    "Contreplaqué filmé bakélisé": {
      qualites:
        "EN 13353 et EN 314-2 classe 3 (classe d'emploi 3) ; faces F/F ou B/BB ; film phénolique 120, 170 ou 220 g/m² sur 2 faces ; version antidérapante ; FSC/PEFC selon origine.",
      specif:
        "Panneaux 2500×1250, 2440×1220, 3000×1000 et 3000×1500 mm ; ép. réelles 4 à 27 mm (coffrage 15/18/21, jusqu'à 27 mm) ; chants peints/vernis, à quadrillage imprimé.",
    },
    "Poutres H20 & panneaux triplis": {
      qualites:
        "EN 13377 classe P20 (M = 5 kN·m, Q = 11 kN, EI = 450 kN·m²) ; triplis EN 13353 ; PEFC ; fabrications Doka, Hünnebeck, Pfeifer et françaises avec marquage au pas de 50 cm.",
      specif:
        "Poutres H20 de 1,25 à 5,90 m (semelle 80×40 mm, hauteur 200 mm, jusqu'à 12 m) ; triplis 27 mm × 500 mm en 2,00 / 2,50 / 3,00 m ; têtes plastiques, rivets et plaques d'assemblage.",
    },
    "Madriers & bois de coffrage": {
      qualites:
        "Classement structurel C18/C24 (EN 14081-1) ; classes d'emploi NF EN 335 ; choix 2-3 scié brut à arêtes vives ; PEFC/FSC ; CTB B+ pour traitements classe 2 (trempage) et classe 4 (autoclave).",
      specif:
        "Planches 27×150 à 38×200, chevrons/bastaings 50×70 à 75×145, madriers 50×150 à 100×250 mm ; longueurs 2-6 m sur mesure ; brut 4 faces ou raboté, débit sur demande.",
    },
  },
  "isolation-etancheite": {
    "Laine de verre": {
      qualites:
        "NF EN 13162+A1, marquage CE via Déclaration de Performance (RPC UE 305/2011) ; certifications ACERMI et Keymark ; étiquetage sanitaire A+ ; laine nue classée Euroclasse A1 (incombustible).",
      specif:
        "Rouleaux et panneaux de 45 à 300 mm (75, 85, 100, 120, 140, 160, 200, 300) ; largeurs 0,6 à 1,2 m ; formats combles déroulés et panneaux semi-rigides ; revêtus kraft ou aluminium.",
    },
    "Laine de roche": {
      qualites:
        "NF EN 13162+A1, marquage CE (DdP) ; certifications ACERMI et Keymark ; Euroclasse A1 pour produits nus, certaines gammes A2-s1,d0 ; Avis Techniques/DTA CSTB pour toitures-terrasses.",
      specif:
        "Panneaux semi-rigides 45 à 210 mm (Rockplus 45-210, Rockmur 75-200, toiture-terrasse 50-180) ; largeur 0,6-1,2 m ; nue ou revêtue kraft polyéthylène.",
    },
    "Étanchéité bitumineuse": {
      qualites:
        "NF EN 13707 (membranes bitume élastomère armées), marquage CE (DdP) ; référentiels DTU série 43 (DTU 43.1, 43.2, 43.3) ; Avis Techniques/DTA CSTB ; SBS ou APP autocicatrisant.",
      specif:
        "Rouleaux en lés de 1,00 m sur 8 à 10 m ; membranes 2,5 à 5,0 mm (monocouche, bicouche) ; faces autoprotégées paillettes d'ardoise ou aluminium gaufré ; versions autoadhésives sarking.",
    },
  },
  "amenagement-interieur": {
    "Parquet en chêne / hêtre": {
      qualites:
        "NF EN 13226 (parquet massif rainure-languette) et NF EN 13489 (contrecollé) ; NF EN 14342 marquage CE ; usages 21-23 domestique / 31-34 commercial, classement UPEC ; PEFC/FSC ; qualité de l'air A+.",
      specif:
        "Lames massives 10-27 mm (14-23 mm usuels) et contrecollées 9-22 mm (12-14 mm, couche d'usure 2,5-7 mm) ; largeurs 70-200 mm ; finitions brut, huilé, verni, fumé, lessivé, blanchi, brossé ; mosaïque 8 mm.",
    },
    "Lambris & habillages muraux": {
      qualites:
        "Qualités AB / C / D, choix Petit Nœud / Sans Nœud ; marquage CE des produits dérivés du bois ; certification PEFC ; qualité de l'air A+ ; fabrications françaises fréquentes.",
      specif:
        "Lames 9 à 20 mm (10-16 mm usuels), largeurs 90-200 mm, longueurs 1,8-5,1 m ; profils élégie, grain d'orge, mouchette, jointif, double mouchette ; panneaux MDF plafond/mural 8 mm.",
    },
    "Plinthes & quarts de rond": {
      qualites:
        "Menuiserie intérieure rattachée au marquage CE des revêtements de sol bois (NF EN 14342) ; PEFC ; chêne de France, fabrication française fréquente ; profils massifs, plaqués MDF ou stratifiés.",
      specif:
        "Plinthes 8-20 mm × 40-200 mm (12×68, 14×80, 16×80, 20×120), longueurs 2,0-3,1 m ; quarts de rond 10×10 à 25×25 mm ; bords droits, arrondis ou moulurés, prépeints ou à finir.",
    },
  },
  "amenagement-exterieur": {
    "Lame de terrasse pin autoclave classe 4": {
      qualites:
        "Traitement autoclave classe 4 CTB B+ (NF EN 335) ; PEFC ; garantie de traitement jusqu'à 10 ans ; profils lisses ou rainurés, arêtes chanfreinées.",
      specif:
        "Lames 27×145 mm en 3,9 à 4,5 m et 21×120 mm ; pose sur lambourdes traitées classe 4 selon DTU 51.4 avec vis inox ; 2 faces réversibles.",
    },
    "Lame de terrasse bois exotique": {
      qualites:
        "Durabilité naturelle classes 4-5 (NF EN 350) ; traçabilité renforcée : Ipé inscrit annexe II CITES (2024), FSC/PEFC et chaîne de contrôle (CoC), conformité EUDR ; densité 800-1 100 kg/m³.",
      specif:
        "Lames 21×145 mm et 20×140 mm (2 faces lisses) ; longueurs variables selon grumes ; entraxe de lambourdes 40-50 cm ; pose sur lambourdes selon DTU 51.4.",
    },
    "Bardage & palissade": {
      qualites:
        "Traitement autoclave classes 3-4 CTB B+ (NF EN 335), imprégnation en profondeur 5-12 mm ; PEFC ; coloris vert, marron, gris, noir imprégnés dans la masse.",
      specif:
        "Bardage 19×90/140/175, 20×70, 21×130/145 mm, clin 27×130 ; palissade en lames 16×140 / 28×145 à emboîter dans poteaux rainurés ; longueurs jusqu'à 4-5 m.",
    },
  },
  "tole-fer-beton": {
    "Fer à béton (rond HLE)": {
      qualites:
        "Nuances B500A / B500B / B500C conformes NF EN 10080 et NF A 35-080-1 (Re ≥ 500 MPa) ; certificat 3.1 avec contrôle de traction et essai de pliage ; marquage de laminage remontant à l'usine.",
      specif:
        "Barres Ø 6, 8, 10, 12, 14, 16, 20 et 25 mm en longueurs de 2 et 6 m (8 et 10 mm courants) ; coupe, cintrage et façonnage sur mesure ; ligature plutôt que soudure.",
    },
    "Tôle acier plane": {
      qualites:
        "EN 10025-2 (S235JR/S235JO), EN 10051 / EN 10131 / EN 10130 (laminé à froid), NF EN 10346 (galvanisé DX51D, S320GD…) ; certificats 2.2 / 3.1 et marquage de la nuance.",
      specif:
        "Feuilles 1000×2000, 1250×2500 et 1500×3000 mm ; épaisseurs 0,20 à 5 mm ; laminé à chaud (calamine), décapé, à froid ou galvanisé ; coupe sur devis.",
    },
    "Bac acier nervuré": {
      qualites:
        "NF EN 14782 et NF EN 508-1 (plaques métalliques autoportantes) ; marquage CE / DoP ; acier revêtu NF EN 10346 (S320GD) et prélavage NF EN 10169.",
      specif:
        "Bacs 5 ondes et profils 45T / 36T de couverture, profils de bardage ; épaisseurs 0,50 / 0,60 / 0,63 / 0,75 / 1,00 mm ; laques polyester RAL standards ; longueurs sur mesure.",
    },
  },
};