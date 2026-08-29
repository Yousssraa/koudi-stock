import { useEffect, useState } from "react";
import api from "../api/client.js";
import { useApp } from "../context/AppContext.jsx";
import useDocumentTitle from "../hooks/useDocumentTitle.jsx";
import MetricCard from "../components/MetricCard.jsx";
import Skeleton from "../components/Skeleton.jsx";

const fmt = (n, digits = 2) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const TYPE_META = {
  purchase_in: { label: "Achat", color: "text-jade bg-jade/10 ring-jade/30" },
  sale_out: { label: "Vente", color: "text-rose bg-rose/10 ring-rose/30" },
  transfer_in: { label: "Transfert +", color: "text-skyx bg-skyx/10 ring-skyx/30" },
  transfer_out: { label: "Transfert −", color: "text-skyx bg-skyx/10 ring-skyx/30" },
  adjustment: { label: "Ajustement", color: "text-amber bg-amber/10 ring-amber/30" },
  opening: { label: "Initial", color: "text-ash bg-raise ring-line" },
  purchase_return: { label: "Retour achat", color: "text-amber bg-amber/10 ring-amber/30" },
  sale_return: { label: "Retour vente", color: "text-jade bg-jade/10 ring-jade/30" },
};

const SPECIES_COLORS = ["#b85b14", "#2b4f3c", "#d97a2b", "#16291f", "#8a4d14", "#4a7a5f", "#c9884a", "#1e3a2b"];

function SectionTitle({ children, right }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="h-5 w-1 rounded-full bg-gradient-to-b from-amber to-copper" />
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-ash">{children}</h2>
      </div>
      {right}
    </div>
  );
}

function Card({ title, right, children, className = "" }) {
  return (
    <div className={`rounded-2xl bg-panel shadow-lg shadow-black/5 ring-1 ring-line ${className}`}>
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h3 className="font-display text-base font-bold text-frost">{title}</h3>
        {right}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const { refreshKey, refresh } = useApp();
  useDocumentTitle("Tableau de bord");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/dashboard/")
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || err.message));
  }, [refreshKey]);

  if (error) return <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">Erreur: {error}</div>;

  if (!data) {
    return (
      <div>
        <Skeleton className="mb-2 h-8 w-52" />
        <Skeleton className="mb-6 h-4 w-80" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Skeleton className="h-72 lg:col-span-3" />
          <Skeleton className="h-72 lg:col-span-2" />
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64 lg:col-span-3" />
        </div>
      </div>
    );
  }

  const maxSpecies = Math.max(...data.species_volume.map((s) => s.volume_m3), 0.0001);
  const maxMovement = Math.max(...data.movement_series.flatMap((d) => [d.in_m3, d.out_m3]), 0.0001);
  const movementTotal = data.movement_series.reduce(
    (acc, d) => ({ in: acc.in + d.in_m3, out: acc.out + d.out_m3 }),
    { in: 0, out: 0 }
  );

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-frost">Tableau de bord</h1>
          <p className="mt-0.5 text-sm text-ash">Vue d'ensemble du stock, des volumes et des livraisons.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 rounded-xl bg-panel px-4 py-2 text-sm shadow-lg shadow-black/5 ring-1 ring-line">
            <span className="flex items-center gap-1.5 font-semibold text-jade">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-jade/10 text-[11px]">↓</span>
              {data.monthly_in} entrées
            </span>
            <span className="h-4 w-px bg-line" />
            <span className="flex items-center gap-1.5 font-semibold text-rose">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose/10 text-[11px]">↑</span>
              {data.monthly_out} sorties
            </span>
            <span className="text-xs text-dim">ce mois-ci</span>
          </div>
          <button
            onClick={refresh}
            title="Actualiser les données"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel text-lg text-ash shadow-lg shadow-black/5 ring-1 ring-line transition hover:bg-raise hover:text-amber"
          >
            ↻
          </button>
        </div>
      </header>

      {/* Section 0 — Alertes de réapprovisionnement */}
      {data.reorder_alerts.length > 0 && (
        <section aria-label="Alertes de réapprovisionnement" className="mb-8">
          <div className="rounded-2xl border border-amber/30 bg-gradient-to-br from-amber/10 via-panel to-panel p-5 shadow-lg shadow-black/10">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber/20 text-base font-bold text-amber ring-1 ring-amber/40">!</span>
                <div>
                  <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-amber">
                    {data.reorder_alerts.length} produit(s) sous le seuil de réapprovisionnement
                  </h2>
                  <p className="text-xs text-ash">Seuils m³ configurés — envisagez un réapprovisionnement.</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {data.reorder_alerts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl bg-panel/80 px-3 py-2 ring-1 ring-line">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-frost">{a.name}</p>
                    <p className="truncate font-mono text-[11px] text-dim">{a.sku}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-dim">
                      {fmt(a.stock_m3, 2)} / <span className="font-semibold text-amber">{fmt(a.threshold_m3, 2)} m³</span>
                    </p>
                    <p className="text-[11px] font-semibold text-rose">suggéré : {fmt(a.suggested_qty, 0)} pcs</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section 1 — Indicateurs */}
      <section aria-label="Indicateurs">
        <SectionTitle>Indicateurs</SectionTitle>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Volume Total"
            value={`${fmt(data.total_volume_m3, 3)} m³`}
            sub={`${data.product_count} produits actifs`}
            icon="▧"
            accent="amber"
          />
          <MetricCard
            title="Valeur du Stock"
            value={`${fmt(data.stock_value)} MAD`}
            sub="au coût par m³"
            icon="◪"
            accent="amber"
          />
          <MetricCard
            title="Livraisons Aujourd'hui"
            value={data.shipments_today}
            sub={`${data.shipments_in_prep} en préparation`}
            icon="🚚"
            accent={data.shipments_today ? "amber" : "jade"}
          />
          <MetricCard
            title="Alertes Stock Bas"
            value={data.low_stock_count}
            sub={data.low_stock_count ? "produits à réapprovisionner" : "tout est bien approvisionné"}
            icon="!"
            accent={data.low_stock_count ? "amber" : "jade"}
          />
        </div>
      </section>

      {/* Section 2 — Analyse */}
      <section aria-label="Analyse" className="mt-8">
        <SectionTitle>Analyse</SectionTitle>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card
            title="Mouvements — Entrées / Sorties (14 jours)"
            className="lg:col-span-3"
            right={<span className="text-xs text-dim">m³</span>}
          >
            <div className="flex items-start justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-jade">
                <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-emerald-700 to-jade" /> Entrées
              </span>
              <span className="flex items-center gap-1.5 text-rose">
                <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-rose-800 to-rose" /> Sorties
              </span>
              <span className="text-dim">
                +{fmt(movementTotal.in, 2)} / −{fmt(movementTotal.out, 2)} m³
              </span>
            </div>
            <div className="mt-4 flex h-52 items-end gap-1.5">
              {data.movement_series.map((d) => (
                <div key={d.day} className="group flex flex-1 flex-col items-center gap-1.5">
                  <div className="relative flex w-full flex-1 flex-col justify-end gap-0.5">
                    <div
                      className="w-full rounded-t bg-rose/80 transition-all group-hover:bg-rose"
                      style={{ height: `${Math.max((d.out_m3 / maxMovement) * 50, 1)}%` }}
                      title={`${d.label} — sorties ${fmt(d.out_m3, 3)} m³`}
                    />
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-emerald-700 to-jade transition-all group-hover:brightness-110"
                      style={{ height: `${Math.max((d.in_m3 / maxMovement) * 50, 1)}%` }}
                      title={`${d.label} — entrées ${fmt(d.in_m3, 3)} m³`}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-dim">{d.label}</span>
                </div>
              ))}
            </div>
            {movementTotal.in === 0 && movementTotal.out === 0 && (
              <p className="mt-3 text-center text-xs text-dim">Aucun mouvement de stock sur les 14 derniers jours.</p>
            )}
          </Card>

          <Card title="Volume par Essence" className="lg:col-span-2" right={<span className="text-xs text-dim">m³</span>}>
            {data.species_volume.length === 0 ? (
              <p className="text-sm text-dim">Aucune donnée.</p>
            ) : (
              <div className="space-y-3.5">
                {data.species_volume.map((s, i) => (
                  <div key={s.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-frost">{s.name}</span>
                      <span className="font-semibold text-ash">{fmt(s.volume_m3, 3)}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-raise">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(s.volume_m3 / maxSpecies) * 100}%`, backgroundColor: SPECIES_COLORS[i % SPECIES_COLORS.length] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* Section 3 — Stocks & activité */}
      <section aria-label="Stocks et activité" className="mt-8">
        <SectionTitle>Stocks &amp; Activité</SectionTitle>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card
            title="Top Produits (volume m³)"
            className="lg:col-span-2"
            right={<span className="text-xs text-dim">tous dépôts</span>}
          >
            {data.top_products.length === 0 ? (
              <p className="text-sm text-dim">Aucun stock enregistré.</p>
            ) : (
              <div className="divide-y divide-line">
                {data.top_products.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber/10 text-xs font-bold text-amber ring-1 ring-amber/20">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-frost">{p.name}</p>
                      <p className="font-mono text-[11px] text-dim">{p.sku}</p>
                    </div>
                    <span className="font-semibold text-amber">{fmt(p.volume_m3, 3)} m³</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Mouvements Récents"
            className="lg:col-span-3"
            right={<span className="text-xs text-dim">10 derniers</span>}
          >
            <div className="divide-y divide-line">
              {data.recent_movements.length === 0 && (
                <p className="py-8 text-center text-sm text-dim">Aucun mouvement — enregistrez une livraison ou un ajustement.</p>
              )}
              {data.recent_movements.map((m) => {
                const meta = TYPE_META[m.movement_type] || { label: m.movement_type, color: "text-ash bg-raise ring-line" };
                const inflow = m.movement_type.includes("in") || m.movement_type === "sale_return";
                return (
                  <div key={m.id} className="flex items-center gap-4 py-2.5">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 ${
                        inflow ? "bg-jade/10 text-jade ring-jade/30" : "bg-rose/10 text-rose ring-rose/30"
                      }`}
                    >
                      {inflow ? "↓" : "↑"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-frost">{m.product}</p>
                      <p className="text-xs text-dim">
                        {m.warehouse} · {m.lot_number ? `Lot ${m.lot_number} · ` : ""}
                        {new Date(m.moved_at).toLocaleString()}
                      </p>
                    </div>
                    <span className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 sm:inline-block ${meta.color}`}>
                      {meta.label}
                    </span>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-bold ${inflow ? "text-jade" : "text-rose"}`}>
                        {inflow ? "+" : "−"}{fmt(Math.abs(m.quantity))}
                      </p>
                      <p className="text-[11px] text-dim">{m.volume_m3 ? `${fmt(m.volume_m3, 4)} m³` : "—"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
