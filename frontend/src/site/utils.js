// Map an essence / category to an available stock image in /public/wood.
const ESSENCE_IMAGE = {
  "pin sylvestre": "/wood/pin-sylvestre.jpg",
  "épicéa": "/wood/epicea.jpg",
  "éphra": "/wood/epicea.jpg",
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
  "Panneaux & Dérivés": "/wood/panneaux.jpg",
};

export function productImage(product) {
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
