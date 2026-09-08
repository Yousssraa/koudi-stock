// Map an essence / category to an available stock image in /public/wood.
const ESSENCE_IMAGE = {
  "pin sylvestre": "/wood/pin-sylvestre.jpg",
  "épicéa": "/wood/epicea.jpg",
  "éphra": "/wood/epicea.jpg",
  "sapin du nord": "/wood/epicea.jpg",
  "hêtre": "/wood/hetre-etuve.jpg",
  "eucalyptus": "/wood/eucalyptus.jpg",
  "sapelli": "/wood/sapelli.jpg",
  "kossipo": "/wood/kossipo.jpg",
  "dabema": "/wood/dabema.jpg",
  "dibétou": "/wood/dibetou.jpg",
  "iroko": "/wood/iroko.jpg",
  "chêne": "/wood/chene.jpg",
  "noyer": "/wood/noyer.jpg",
  "okoumé": "/wood/okoume.jpg",
};

const CATEGORY_IMAGE = {
  "Bois de Construction": "/wood/pin-sylvestre.jpg",
  "Bois Traité Autoclave": "/wood/epicea.jpg",
  "Bois Feuillus & Nobles": "/wood/chene.jpg",
  "Panneaux & Dérivés": "/wood/contreplaque.jpg",
  "Bois rouge": "/wood/menuiserie.jpg",
  "Bois blanc": "/wood/bois-blanc.jpg",
  "Bois exotique": "/wood/iroko.jpg",
  "Bois noble": "/wood/chene.jpg",
  "Panneaux": "/wood/panneau-deco.jpg",
  "Coffrage": "/wood/coffrage.jpg",
};

// Real photos per product type, matched by keyword in the product name.
const PRODUCT_NAME_IMAGE = [
  { keys: ["bakelise", "bakélisé"], img: "/wood/contreplaque-bakelise.jpg" },
  { keys: ["contreplaqu", "plywood"], img: "/wood/contreplaque.jpg" },
  { keys: ["mdf", "stratifi", "high gloss"], img: "/wood/mdf-photo.jpg" },
  { keys: ["osb"], img: "/wood/osb-photo.jpg" },
  { keys: ["latt", "sorel"], img: "/wood/particule.jpg" },
  { keys: ["coffrage"], img: "/wood/coffrage.jpg" },
  { keys: ["h20", "poutrelle", "poutre"], img: "/wood/bois-charpente.jpg" },
  { keys: ["madrier", "poteau", "rondin"], img: "/wood/madrier-photo.jpg" },
  // Softwood framing only — requires a softwood indicator in the name,
  // otherwise "Plateau Sapelli/Chêne/Noyer" would wrongly read as framing.
  { keys: ["chevron", "bastaing", "plateau", "volige", "liteau"], softwood: true, img: "/wood/bois-charpente.jpg" },
  { keys: ["lame de terrasse"], img: "/wood/bois-charpente.jpg" },
];

const SOFTWOOD = /pin|epicea|épicéa|sapin|éphra|resineux/;

function detectPanelType(product) {
  const n = `${product?.name || ""} ${product?.sku || ""}`.toLowerCase();
  const isSoftwood = SOFTWOOD.test(n);

  // Dedicated real photos for framing products / plywood by essence.
  if (n.includes("bastaing")) {
    if (n.includes("pin") && !/(epicea|épicéa)/.test(n)) return "/wood/bastaing-pin.jpg";
    return "/wood/bastaing-epicea.jpg";
  }
  if (n.includes("chevron")) {
    if (n.includes("pin") && !/(epicea|épicéa)/.test(n)) return "/wood/chevron-pin.jpg";
    return "/wood/chevron-epicea.jpg";
  }
  if (n.includes("liteau") || n.includes("liteaux")) {
    return "/wood/liteau-epicea.jpg";
  }
  if (n.includes("madrier")) {
    if (n.includes("pin") && !/(epicea|épicéa)/.test(n)) return "/wood/madrier-pin.jpg";
    return "/wood/madrier-photo.jpg";
  }
  if (n.includes("contreplaqu") && /okoume|okoumé/.test(n)) {
    return "/wood/contreplaque-okoume.jpg";
  }

  for (const row of PRODUCT_NAME_IMAGE) {
    for (const k of row.keys) {
      if (n.includes(k)) {
        if (row.softwood && !isSoftwood) continue;
        const whiteWood = /epicea|épicéa|sapin|éphra/.test(n);
        if (whiteWood && k !== "contreplaqu") return "/wood/bois-blanc.jpg";
        return row.img;
      }
    }
  }
  return null;
}

export function productImage(product) {
  const byName = detectPanelType(product);
  if (byName) return byName;
  if (product?.is_panel) return "/wood/contreplaque.jpg";
  if (product?.category === "Panneaux & Dérivés") return "/wood/contreplaque.jpg";
  const essence = (product?.wood_type_name || "").toLowerCase();
  for (const [key, img] of Object.entries(ESSENCE_IMAGE)) {
    if (essence.includes(key)) return img;
  }
  if (product?.category && CATEGORY_IMAGE[product.category]) {
    return CATEGORY_IMAGE[product.category];
  }
  return "/wood/panneaux.jpg";
}

export function categoryImage(key) {
  return CATEGORY_IMAGE[key] || "/wood/panneaux.jpg";
}

export function fmtPrice(n) {
  const v = Number(n);
  if (isNaN(v)) return "—";
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

export function fmtQty(n) {
  const v = Number(n);
  if (isNaN(v)) return "0";
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}
