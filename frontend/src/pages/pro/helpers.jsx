export const fmtMAD = (n) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " MAD";

export const fmtNum = (n, digits = 2) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("fr-FR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

export const fmtDate = (d) => {
  if (!d) return "—";
  const [datePart] = String(d).split("T");
  const [y, m, day] = datePart.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
};

export const QUOTE_BADGES = {
  draft: "bg-ash/15 text-ash ring-ash/30",
  sent: "bg-skyx/15 text-skyx ring-skyx/30",
  accepted: "bg-jade/15 text-jade ring-jade/30",
  rejected: "bg-rose/15 text-rose ring-rose/30",
  expired: "bg-amber/15 text-amber ring-amber/30",
};

export const ORDER_BADGES = {
  draft: "bg-ash/15 text-ash ring-ash/30",
  confirmed: "bg-skyx/15 text-skyx ring-skyx/30",
  partially_shipped: "bg-amber/15 text-amber ring-amber/30",
  shipped: "bg-skyx/15 text-skyx ring-skyx/30",
  delivered: "bg-jade/15 text-jade ring-jade/30",
  cancelled: "bg-rose/15 text-rose ring-rose/30",
};

export const QUOTE_LABELS = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
  expired: "Expiré",
};

export const ORDER_LABELS = {
  draft: "Brouillon",
  confirmed: "Confirmée",
  partially_shipped: "Part. expédiée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const DELIVERY_LABELS = {
  preparation: "En préparation",
  in_transit: "En cours",
  delivered: "Livré",
  waiting: "En attente",
  validated: "Validé & Chargé",
  invoiced: "Facturé",
  cancelled: "Annulé",
};

const DELIVERY_BADGES = {
  preparation: "bg-amber/15 text-amber ring-amber/30",
  in_transit: "bg-skyx/15 text-skyx ring-skyx/30",
  delivered: "bg-jade/15 text-jade ring-jade/30",
  waiting: "bg-ash/15 text-ash ring-ash/30",
  validated: "bg-skyx/15 text-skyx ring-skyx/30",
  invoiced: "bg-jade/15 text-jade ring-jade/30",
  cancelled: "bg-rose/15 text-rose ring-rose/30",
};

export function StatusBadge({ status, map, labels }) {
  const key = status || Object.keys(labels)[0];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
        map[key] || "bg-ash/15 text-ash ring-ash/30"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {(labels || QUOTE_LABELS)[key] || key}
    </span>
  );
}

export function DeliveryBadge({ status }) {
  return StatusBadge({ status, map: DELIVERY_BADGES, labels: DELIVERY_LABELS });
}

export const ORDER_STATUS_KEYS = "draft,confirmed,partially_shipped,shipped,delivered,cancelled";