const STYLES = {
  kd: "bg-skyx/10 text-skyx ring-skyx/30",
  air_dried: "bg-amber/10 text-amber ring-amber/30",
  green: "bg-jade/10 text-jade ring-jade/30",
};

const LABELS = {
  kd: "Sec Séchoir",
  air_dried: "Séché à l'air",
  green: "Vert",
};

export default function MoistureBadge({ status }) {
  if (!status) return <span className="text-xs text-dim">—</span>;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status]}
    </span>
  );
}
