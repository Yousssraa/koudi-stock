const ACCENTS = {
  amber: { bar: "from-amber to-copper", icon: "bg-amber/15 text-amber ring-amber/30" },
  jade: { bar: "from-jade to-jade/50", icon: "bg-jade/15 text-jade ring-jade/30" },
  rose: { bar: "from-rose to-rose/50", icon: "bg-rose/15 text-rose ring-rose/30" },
  sky: { bar: "from-skyx to-skyx/50", icon: "bg-skyx/15 text-skyx ring-skyx/30" },
};

export default function MetricCard({ title, value, sub, icon = "▤", accent = "amber" }) {
  const a = ACCENTS[accent] || ACCENTS.amber;
  return (
    <div className="overflow-hidden rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
      <div className={`h-1.5 bg-gradient-to-r ${a.bar}`} />
      <div className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm font-medium text-ash">{title}</p>
          <p className="font-display mt-2 text-2xl font-bold tracking-tight text-frost">{value}</p>
          {sub && <p className="mt-1 text-xs text-dim">{sub}</p>}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm ring-1 ${a.icon}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
