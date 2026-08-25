const STYLES = {
  in_stock: "bg-jade/10 text-jade ring-jade/30",
  low: "bg-amber/10 text-amber ring-amber/30",
  out_of_stock: "bg-rose/10 text-rose ring-rose/30",
};

const LABELS = {
  in_stock: "En stock",
  low: "Stock bas",
  out_of_stock: "Rupture",
};

export default function StockBadge({ status }) {
  const key = status || "out_of_stock";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STYLES[key]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[key]}
    </span>
  );
}
