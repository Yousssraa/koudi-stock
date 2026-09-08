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

const fmtMAD = (n) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

const ACTION_LABELS = {
  create: "a créé",
  update: "a modifié",
  delete: "a supprimé",
  price_update: "a mis à jour le prix de",
  login: "s'est connecté",
  logout: "s'est déconnecté",
  download: "a téléchargé",
  reorder: "a généré une commande pour",
  transfer: "a transféré",
  close_month: "a clôturé le mois",
};

const ENTITY_LABELS = {
  delivery_note: "le BL",
  product: "le produit",
  reference_price: "le tarif",
  purchase_order: "le bon d'achat",
  sales_order: "la commande",
  client: "le client",
  supplier: "le fournisseur",
  stock_movement: "le mouvement",
  company_profile: "le profil société",
};

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

  // Month-over-month stock delta from the last two months of the flow series.
  const flow = data.monthly_flow_series || [];
  const lastMonth = flow[flow.length - 1];
  const prevMonth = flow[flow.length - 2];
  let stockDelta = null;
  if (lastMonth && prevMonth) {
    const cur = lastMonth.in_m3 - lastMonth.out_m3;
    const prev = prevMonth.in_m3 - prevMonth.out_m3;
    if (prev !== 0) {
      const pct = ((cur - prev) / Math.abs(prev)) * 100;
      stockDelta = {
        text: `${Math.abs(pct).toFixed(1)}% ce mois`,
        positive: pct >= 0,
        icon: pct >= 0 ? "▲" : "▼",
      };
    }
  }

  const maxFlow = Math.max(...flow.flatMap((d) => [d.in_m3, d.out_m3]), 0.0001);
  const flowTotal = flow.reduce(
    (acc, d) => ({ in: acc.in + d.in_m3, out: acc.out + d.out_m3 }),
    { in: 0, out: 0 }
  );

  const activity = data.activity_feed || [];

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
            title="Stock Total"
            value={`${fmt(data.total_volume_m3, 2)} m³`}
            sub={`${data.product_count} produits actifs`}
            delta={stockDelta}
            icon="▧"
            accent="amber"
          />
          <MetricCard
            title="Valeur Globale du Stock"
            value={`${fmtMAD(data.stock_value_sale ?? data.stock_value)} MAD`}
            sub="au prix de vente / m³"
            icon="◪"
            accent="jade"
          />
          <MetricCard
            title="Entrées Dépôt (Mois)"
            value={`${fmt(data.stock_in_month_m3 ?? 0, 2)} m³`}
            sub="achats & retours reçus ce mois"
            icon="▣"
            accent="sky"
          />
          <MetricCard
            title="Alertes Stock Bas"
            value={data.low_stock_count}
            sub={data.low_stock_count ? "références à réapprovisionner" : "tout est bien approvisionné"}
            delta={data.low_stock_count ? { text: "à traiter", positive: false } : null}
            icon="!"
            accent={data.low_stock_count ? "rose" : "jade"}
          />
        </div>
      </section>

      {/* Section 2 — Analyse : flux mensuel + répartition */}
      <section aria-label="Analyse" className="mt-8">
        <SectionTitle>Analyse — Flux de bois (m³)</SectionTitle>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card
            title="Volume Entré vs Livré (6 derniers mois)"
            className="lg:col-span-3"
            right={<span className="text-xs text-dim">m³</span>}
          >
            <div className="flex items-start justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-jade">
                <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-jade/40 to-jade" /> Entré
              </span>
              <span className="flex items-center gap-1.5 text-rose">
                <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-rose/40 to-rose" /> Livré
              </span>
              <span className="text-dim">
                +{fmt(flowTotal.in, 2)} / −{fmt(flowTotal.out, 2)} m³
              </span>
            </div>
            {flow.length === 0 ? (
              <p className="mt-3 text-center text-sm text-dim">Aucun mouvement sur les 6 derniers mois.</p>
            ) : (
              <div className="mt-4 flex h-52 items-end gap-2">
                {flow.map((d) => {
                  const groupMax = Math.max(d.in_m3, d.out_m3, 0.0001);
                  return (
                    <div key={d.key} className="group flex flex-1 flex-col items-center gap-1.5">
                      <div className="relative flex w-full items-end justify-center gap-0.5">
                        <div
                          className="w-1/3 rounded-t bg-gradient-to-t from-jade/40 to-jade transition-all group-hover:brightness-110"
                          style={{ height: `${(d.in_m3 / maxFlow) * 100}%` }}
                          title={`${d.month} — entré ${fmt(d.in_m3, 3)} m³`}
                        />
                        <div
                          className="w-1/3 rounded-t bg-gradient-to-t from-rose/40 to-rose transition-all group-hover:brightness-110"
                          style={{ height: `${(d.out_m3 / maxFlow) * 100}%` }}
                          title={`${d.month} — livré ${fmt(d.out_m3, 3)} m³`}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-dim">{d.month}</span>
                      <span className="text-[9px] tabular-nums text-ash">
                        {groupMax > 0 ? `${fmt(groupMax, 1)}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card
            title="Répartition du Stock par Essence"
            className="lg:col-span-2"
            right={<span className="text-xs text-dim">m³</span>}
          >
            {data.species_volume.length === 0 ? (
              <p className="text-sm text-dim">Aucune donnée.</p>
            ) : (
              <div className="space-y-3.5">
                {data.species_volume.map((s, i) => (
                  <div key={s.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-frost">{s.name}</span>
                      <span className="font-semibold text-ash">{fmt(s.volume_m3, 3)} m³</span>
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

      {/* Section 3 — Activité & stocks */}
      <section aria-label="Activité récente" className="mt-8">
        <SectionTitle>Activité Récente</SectionTitle>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card
            title="Flux d'Activité"
            className="lg:col-span-2"
            right={<span className="text-xs text-dim">en direct</span>}
          >
            {activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-dim">Aucune activité récente.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {activity.map((a) => {
                  const verb = ACTION_LABELS[a.action] || a.action;
                  const obj = ENTITY_LABELS[a.entity_type] || a.entity_type;
                  const ref = a.entity_ref || a.entity_id || "";
                  return (
                    <li key={a.id} className="relative">
                      <span
                        className={`absolute -left-[26px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-panel ${
                          a.action === "delete" || a.action === "price_update"
                            ? "bg-rose"
                            : a.action === "create"
                            ? "bg-jade"
                            : "bg-amber"
                        }`}
                      />
                      <p className="text-sm text-frost">
                        {a.user ? (
                          <span className="font-semibold">{a.user}</span>
                        ) : (
                          <span className="italic text-dim">Système</span>
                        )}{" "}
                        <span className="text-ash">{verb}</span>{" "}
                        <span className="font-semibold text-amber">{obj}</span>
                        {ref ? <span className="font-mono text-xs text-ash"> {ref}</span> : null}
                      </p>
                      <p className="text-[11px] text-dim">{a.created_at}</p>
                    </li>
                  );
                })}
              </ol>
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
