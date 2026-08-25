import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "../components/ToastContext.jsx";
import useDocumentTitle from "../hooks/useDocumentTitle.jsx";
import MoistureBadge from "../components/MoistureBadge.jsx";
import MetricCard from "../components/MetricCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Skeleton from "../components/Skeleton.jsx";

const fmt = (n, d = 2) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const dateFr = (v) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");

const input =
  "w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none transition focus:border-amber/60";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-dim";

const STATUS_META = {
  in_progress: { label: "En cours", cls: "bg-jade/10 text-jade ring-jade/30" },
  completed: { label: "Terminé", cls: "bg-skyx/10 text-skyx ring-skyx/30" },
  cancelled: { label: "Annulé", cls: "bg-rose/10 text-rose ring-rose/30" },
};

const STATUS_PILLS = [
  { value: "", label: "Tous" },
  { value: "in_progress", label: "En cours" },
  { value: "completed", label: "Terminés" },
  { value: "cancelled", label: "Annulés" },
];

const warehouseShort = (name) => (name || "").replace(/^Dépôt\s+/i, "") || name || "—";

const SORTERS = {
  recent: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  end: (a, b) =>
    (a.estimated_end_date || "9999-12-31").localeCompare(b.estimated_end_date || "9999-12-31"),
  moisture: (a, b) => (Number(a.current_moisture ?? 999) - Number(b.current_moisture ?? 999)),
  progress: (a, b) => Number(b.progress_pct ?? -1) - Number(a.progress_pct ?? -1),
  volume: (a, b) => Number(b.initial_volume_m3 || 0) - Number(a.initial_volume_m3 || 0),
};

const SORT_OPTIONS = [
  ["recent", "Tri : Plus récents"],
  ["end", "Fin estimée"],
  ["moisture", "Humidité actuelle"],
  ["progress", "Progression"],
  ["volume", "Volume m³"],
];

export default function Drying() {
  const { refreshKey } = useApp();
  const toast = useToast();
  useDocumentTitle("Séchage & Séchoir");

  const [dashboard, setDashboard] = useState(null);
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState("recent");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [historyKiln, setHistoryKiln] = useState(null);
  const [historyBatches, setHistoryBatches] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get("/kilns/dashboard/"),
      api.get("/drying-batches/", { params: { page_size: 200 } }),
    ])
      .then(([d, b]) => {
        setDashboard(d.data);
        setBatches(b.data.results || b.data || []);
      })
      .catch((err) =>
        setError(err.response?.data?.detail || err.message || "Impossible de charger le séchage.")
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!modalOpen) return;
    api
      .get("/products/lookup/")
      .then((res) => setProducts(res.data || []))
      .catch(() => setProducts([]));
  }, [modalOpen]);

  const openCycle = () => {
    setForm({ quantity: "", start_moisture: "", target_moisture: "10", energy_cost: "" });
    setModalOpen(true);
  };

  const createCycle = async () => {
    setSubmitting(true);
    try {
      await api.post("/drying-batches/", {
        product_id: Number(form.product_id),
        kiln_id: Number(form.kiln_id),
        quantity: form.quantity,
        start_moisture: form.start_moisture || undefined,
        target_moisture: form.target_moisture || undefined,
        energy_cost: form.energy_cost || undefined,
        estimated_end_date: form.estimated_end_date || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Cycle de séchage ouvert.");
      setModalOpen(false);
      load();
    } catch (err) {
      const data = err.response?.data || {};
      const msg =
        data.detail ||
        (Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : null) ||
        (Object.values(data).find((v) => Array.isArray(v)) || [])[0] ||
        "Échec de l'ouverture du cycle.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const completeBatch = async (batch) => {
    const prefill = batch.current_moisture ?? batch.target_moisture ?? "";
    const val = window.prompt(
      `Humidité actuelle du lot ${batch.batch_no} (% — cible ${batch.target_moisture ?? "10"}) :`,
      prefill === null || prefill === undefined ? "" : String(prefill)
    );
    if (val === null) return;
    const moisture = Number(val);
    if (isNaN(moisture)) {
      toast.error("Valeur d'humidité invalide.");
      return;
    }
    setBusyId(batch.id);
    try {
      const { data } = await api.post(`/drying-batches/${batch.id}/complete/`, {
        current_moisture: String(moisture),
      });
      toast.success(`« ${data.batch_no} » terminé — prix réévalué (${fmt(data.energy_cost_per_m3, 2)} MAD/m³).`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Impossible de terminer le cycle.");
    } finally {
      setBusyId(null);
    }
  };

  const cancelBatch = async (batch) => {
    if (!window.confirm(`Annuler le lot ${batch.batch_no} ? Le produit ne sera pas modifié.`)) return;
    setBusyId(batch.id);
    try {
      await api.post(`/drying-batches/${batch.id}/cancel/`, {});
      toast.success(`« ${batch.batch_no} » annulé.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Impossible d'annuler le cycle.");
    } finally {
      setBusyId(null);
    }
  };

  const openHistory = (k) => {
    setHistoryKiln(k);
    setHistoryLoading(true);
    setHistoryBatches([]);
    api
      .get(`/kilns/${k.id}/batches/`)
      .then((res) => setHistoryBatches(res.data || []))
      .catch(() => setHistoryBatches([]))
      .finally(() => setHistoryLoading(false));
  };

  const shown = (statusFilter ? batches.filter((b) => b.status === statusFilter) : [...batches]).sort(
    SORTERS[sortKey] || SORTERS.recent
  );
  const kilns = dashboard?.kilns || [];

  // Live volume estimate in the "Nouveau Cycle" modal (product dims × qty).
  const selProduct = products.find((p) => String(p.id) === String(form.product_id));
  const selKiln = kilns.find((k) => String(k.id) === String(form.kiln_id));
  const qtyNum = parseFloat(form.quantity);
  const estVolume =
    selProduct && qtyNum > 0 && selProduct.thickness_mm && selProduct.width_mm && selProduct.length_mm
      ? (Number(selProduct.thickness_mm) * Number(selProduct.width_mm) *
         Number(selProduct.length_mm) * qtyNum) / 1e9
      : null;
  const overVolume =
    estVolume != null && selKiln ? estVolume > Number(selKiln.available_m3) : false;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-frost">Séchage &amp; Séchoir</h1>
          <p className="text-sm text-ash">
            Cycle <strong>En cours → Terminé / Annulé</strong>. Terminer un cycle enregistre l'humidité du produit
            (finition « kiln-dried ») et répercute le coût énergétique sur le prix de vente (MAD/m³).
          </p>
        </div>
        <button
          onClick={openCycle}
          className="rounded-lg bg-gradient-to-r from-amber to-copper px-4 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110"
        >
          + Nouveau Cycle
        </button>
      </header>

      {error && <div className="mb-4 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-44" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          {/* Metrics */}
          {dashboard && (
            <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicateurs séchoirs">
              <MetricCard
                title="Séchoirs en service"
                value={`${dashboard.operating_kilns} / ${dashboard.total_kilns}`}
                sub="unités avec au moins une charge active"
                icon="♨"
                accent="sky"
              />
              <MetricCard
                title="Capacité engagée"
                value={`${fmt(dashboard.occupied_m3, 2)} / ${fmt(dashboard.total_capacity_m3, 2)} m³`}
                sub={`Taux d'occupation ${fmt(dashboard.utilization_pct, 1)}%`}
                icon="▧"
                accent="amber"
              />
              <MetricCard
                title="Lots en cours"
                value={dashboard.batches_in_progress}
                sub="cycles de séchage actifs"
                icon="◍"
                accent="jade"
              />
              <MetricCard
                title="Coût énergie (en cours)"
                value={`${fmt(dashboard.total_energy_cost, 0)} MAD`}
                sub={`Durée moyenne : ${
                  dashboard.avg_drying_days == null ? "—" : `${fmt(dashboard.avg_drying_days, 1)} j`
                }`}
                icon="⚡"
                accent="rose"
              />
            </section>
          )}

          {/* Kiln occupancy */}
          {kilns.length > 0 && (
            <section aria-label="Occupation des séchoirs" className="mt-8">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="h-5 w-1 rounded-full bg-gradient-to-b from-amber to-copper" />
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-ash">Séchoirs</h2>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {kilns.map((k) => {
                  const max = Number(k.max_capacity_m3) || 0;
                  const occ = Number(k.occupied_m3) || 0;
                  const pct = max > 0 ? Math.min((occ / max) * 100, 100) : 0;
                  const over = max > 0 && occ > max;
                  return (
                    <article
                      key={k.id}
                      onClick={() => openHistory(k)}
                      title="Voir l'historique des cycles"
                      className={`cursor-pointer rounded-2xl bg-panel p-5 shadow-lg shadow-black/20 ring-1 transition hover:-translate-y-0.5 ${
                        over ? "ring-rose/50 hover:ring-rose" : "ring-line hover:ring-amber/40"
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs text-dim">{k.code}</p>
                          <h3 className="font-display text-[15px] font-bold text-frost">{k.name}</h3>
                          <p className="text-[11px] text-dim">{k.warehouse}</p>
                        </div>
                        {over ? (
                          <span className="rounded-full bg-rose/10 px-2.5 py-0.5 text-xs font-semibold text-rose ring-1 ring-rose/30">
                            ⚠ Dépassement
                          </span>
                        ) : (
                          <span className="rounded-full bg-skyx/10 px-2.5 py-0.5 text-xs font-semibold text-skyx ring-1 ring-skyx/30">
                            {k.active_batch_count} lot(s)
                          </span>
                        )}
                      </div>
                      <div className="mb-1 flex items-baseline justify-between text-xs">
                        <span className="text-dim">Occupation</span>
                        <span className={`font-semibold ${over ? "text-rose" : "text-frost"}`}>
                          {fmt(occ, 2)} / {fmt(k.max_capacity_m3, 2)} m³
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-raise">
                        <div
                          className={`h-full rounded-full transition-all ${
                            over ? "bg-rose" : "bg-gradient-to-r from-copper to-amber"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-dim">
                        <span>Disponible : {fmt(k.available_m3, 2)} m³</span>
                        <span>{over ? `${fmt(occ - max, 2)} m³ en excès` : `Historique →`}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Batches table */}
          <section aria-label="Lots de séchage" className="mt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="h-5 w-1 rounded-full bg-gradient-to-b from-amber to-copper" />
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-ash">Lots de séchage</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {STATUS_PILLS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setStatusFilter(p.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                      statusFilter === p.value
                        ? "bg-gradient-to-r from-amber to-copper text-ink ring-transparent shadow-lg shadow-amber/20"
                        : "bg-panel text-ash ring-line hover:bg-raise hover:text-frost"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                  className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs font-semibold text-ash outline-none transition focus:border-amber/50"
                >
                  {SORT_OPTIONS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {shown.length === 0 ? (
              <EmptyState
                icon="♨"
                title={
                  batches.length ? "Aucun lot sur ce filtre" : "Aucun lot de séchage"
                }
                message="Ouvrez un cycle pour charger du bois dans un séchoir et suivre l'humidité jusqu'à la finition."
              />
            ) : (
              <div className="overflow-hidden rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line bg-raise text-[11px] uppercase tracking-wide text-dim">
                        <th className="px-4 py-3 font-semibold">Lot</th>
                        <th className="px-4 py-3 font-semibold">Produit</th>
                        <th className="px-4 py-3 font-semibold">Séchoir</th>
                        <th className="px-4 py-3 font-semibold">Statut</th>
                        <th className="px-4 py-3 font-semibold">Humidité</th>
                        <th className="px-4 py-3 text-right font-semibold">Volume</th>
                        <th className="px-4 py-3 text-right font-semibold">Énergie</th>
                        <th className="px-4 py-3 font-semibold">Fin estimée</th>
                        <th className="px-4 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {shown.map((b) => {
                        const smeta = STATUS_META[b.status] || { label: b.status_label, cls: "bg-raise text-ash ring-line" };
                        return (
                          <tr key={b.id} className="transition hover:bg-raise/50">
                            <td className="px-4 py-3">
                              <p className="font-mono text-xs text-dim">{b.batch_no}</p>
                              <p className="text-[11px] text-ash">
                                {b.completed_at
                                  ? `Terminé ${dateFr(b.completed_at)}`
                                  : b.started_at
                                    ? `Démarré ${dateFr(b.started_at)}`
                                    : ""}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="max-w-[220px] truncate font-semibold text-frost">{b.product}</p>
                              <p className="font-mono text-[11px] text-dim">
                                {b.sku}
                                {b.species ? ` · ${b.species}` : ""}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-semibold text-ash">{b.kiln_code || "—"}</span>
                              <p className="text-[11px] text-dim">{b.warehouse ? warehouseShort(b.warehouse) : ""}</p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${smeta.cls}`}>
                                  {smeta.label}
                                </span>
                                {b.status === "in_progress" && <MoistureBadge status={b.stage} />}
                              </div>
                              <p className="mt-1 text-[11px] text-dim">{fmt(b.quantity)} pcs</p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-dim">{fmt(b.start_moisture)}%</span>
                                <span className="font-mono font-semibold text-jade">
                                  {b.current_moisture == null ? "—" : fmt(b.current_moisture)}%
                                </span>
                                <span className="text-dim">→ {fmt(b.target_moisture)}%</span>
                              </div>
                              <div className="mt-1.5 h-1.5 w-40 overflow-hidden rounded-full bg-raise">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-copper to-amber transition-all"
                                  style={{ width: `${Math.max(0, Math.min(b.progress_pct ?? 0, 100))}%` }}
                                />
                              </div>
                              <p className="mt-1 text-[10px] text-dim">{fmt(b.progress_pct, 0)}% du cycle</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-semibold text-ash">{fmt(b.initial_volume_m3, 3)}</p>
                              <p className="text-[11px] text-dim">m³</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-semibold text-ash">{fmt(b.energy_cost, 0)}</p>
                              <p className="text-[11px] text-dim">
                                {b.energy_cost_per_m3 == null
                                  ? "MAD"
                                  : `${fmt(b.energy_cost_per_m3, 2)} MAD/m³`}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-ash">
                                {b.estimated_end_date ? dateFr(b.estimated_end_date) : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                {b.status === "in_progress" ? (
                                  <>
                                    <button
                                      onClick={() => completeBatch(b)}
                                      disabled={busyId === b.id}
                                      className="rounded-lg border border-jade/40 bg-panel px-3 py-1.5 text-xs font-semibold text-jade transition hover:bg-jade/10 disabled:opacity-50"
                                    >
                                      {busyId === b.id ? "…" : "✓ Terminer"}
                                    </button>
                                    <button
                                      onClick={() => cancelBatch(b)}
                                      disabled={busyId === b.id}
                                      className="rounded-lg border border-rose/40 bg-panel px-3 py-1.5 text-xs font-semibold text-rose transition hover:bg-rose/10 disabled:opacity-50"
                                    >
                                      Annuler
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-xs text-dim">—</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-panel shadow-2xl shadow-black/50 ring-1 ring-line">
            <div className="flex items-center justify-between border-b border-line bg-raise px-6 py-4">
              <div>
                <h2 className="font-display text-lg font-bold text-frost">Nouveau cycle de séchage</h2>
                <p className="text-xs text-dim">Charge à mettre au séchoir (démarre en « En cours »).</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-dim transition hover:text-frost" aria-label="Fermer">
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
              <div>
                <label className={label}>Produit</label>
                <select
                  value={form.product_id || ""}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  className={input}
                >
                  <option value="">— Sélectionner un produit —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.sku}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={label}>Séchoir</label>
                <select
                  value={form.kiln_id || ""}
                  onChange={(e) => setForm({ ...form, kiln_id: e.target.value })}
                  className={input}
                >
                  <option value="">— Sélectionner un séchoir —</option>
                  {kilns.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.code} — {k.name} ({fmt(k.available_m3, 1)} m³ dispo)
                    </option>
                  ))}
                </select>
              </div>

              {estVolume != null && (
                <div
                  className={`rounded-lg px-3 py-2 text-xs ring-1 ${
                    overVolume ? "bg-rose/10 text-rose ring-rose/30" : "bg-jade/10 text-jade ring-jade/30"
                  }`}
                >
                  Volume estimé : <strong>{fmt(estVolume, 3)} m³</strong>
                  {selKiln &&
                    ` · disponible sur ${selKiln.code} : ${fmt(selKiln.available_m3, 2)} m³`}
                  {overVolume && " — dépasse la capacité disponible du séchoir !"}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Quantité (pcs)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="pcs"
                    value={form.quantity ?? ""}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Coût énergie (MAD)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.energy_cost ?? ""}
                    onChange={(e) => setForm({ ...form, energy_cost: e.target.value })}
                    className={input}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Humidité entrée %</label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    placeholder="18"
                    value={form.start_moisture ?? ""}
                    onChange={(e) => setForm({ ...form, start_moisture: e.target.value })}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Cible %</label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    placeholder="10"
                    value={form.target_moisture ?? ""}
                    onChange={(e) => setForm({ ...form, target_moisture: e.target.value })}
                    className={input}
                  />
                </div>
              </div>

              <div>
                <label className={label}>Fin estimée</label>
                <input
                  type="date"
                  value={form.estimated_end_date || ""}
                  onChange={(e) => setForm({ ...form, estimated_end_date: e.target.value })}
                  className={input}
                />
              </div>

              <div>
                <label className={label}>Notes (optionnel)</label>
                <input
                  type="text"
                  value={form.notes || ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Essence / provenance / observations…"
                  className={input}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-ash transition hover:bg-raise"
                >
                  Annuler
                </button>
                <button
                  onClick={createCycle}
                  disabled={submitting || !form.product_id || !form.kiln_id || !form.quantity}
                  className="rounded-lg bg-gradient-to-r from-amber to-copper px-5 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110 disabled:opacity-60"
                >
                  {submitting ? "Création…" : "Ouvrir le cycle"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {historyKiln && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-panel shadow-2xl shadow-black/50 ring-1 ring-line">
            <div className="flex items-center justify-between border-b border-line bg-raise px-6 py-4">
              <div>
                <h2 className="font-display text-lg font-bold text-frost">
                  {historyKiln.code} — {historyKiln.name}
                </h2>
                <p className="text-xs text-dim">
                  Historique des cycles · capacité {fmt(historyKiln.max_capacity_m3, 2)} m³ ·{" "}
                  {historyBatches.length} lot(s) enregistré(s)
                </p>
              </div>
              <button
                onClick={() => setHistoryKiln(null)}
                className="text-dim transition hover:text-frost"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-6">
              {historyLoading ? (
                <Skeleton className="h-40" />
              ) : historyBatches.length === 0 ? (
                <EmptyState
                  icon="♨"
                  title="Aucun cycle sur ce séchoir"
                  message="Les cycles passés et en cours de ce séchoir apparaîtront ici."
                />
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-[11px] uppercase tracking-wide text-dim">
                      <th className="pb-2 pr-3 font-semibold">Lot</th>
                      <th className="pb-2 pr-3 font-semibold">Produit</th>
                      <th className="pb-2 pr-3 font-semibold">Statut</th>
                      <th className="pb-2 pr-3 font-semibold">Humidité</th>
                      <th className="pb-2 pr-3 text-right font-semibold">Volume</th>
                      <th className="pb-2 pr-3 text-right font-semibold">Énergie/m³</th>
                      <th className="pb-2 font-semibold">Période</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {historyBatches.map((b) => {
                      const smeta = STATUS_META[b.status] || {
                        label: b.status_label,
                        cls: "bg-raise text-ash ring-line",
                      };
                      return (
                        <tr key={b.id}>
                          <td className="py-2.5 pr-3 font-mono text-xs text-dim">{b.batch_no}</td>
                          <td className="py-2.5 pr-3">
                            <p className="max-w-[180px] truncate text-xs font-semibold text-frost">{b.product}</p>
                            <p className="font-mono text-[10px] text-dim">{b.sku}</p>
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${smeta.cls}`}>
                              {smeta.label}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-xs">
                            <span className="text-dim">{fmt(b.start_moisture)}%</span>
                            {" → "}
                            <span className="font-mono font-semibold text-jade">
                              {b.current_moisture == null ? "—" : `${fmt(b.current_moisture)}%`}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-right text-xs font-semibold text-ash">
                            {fmt(b.initial_volume_m3, 3)}
                          </td>
                          <td className="py-2.5 pr-3 text-right text-xs text-ash">
                            {fmt(b.energy_cost_per_m3, 2)}
                          </td>
                          <td className="py-2.5 text-[11px] text-dim">
                            {dateFr(b.started_at)}
                            {b.completed_at ? ` → ${dateFr(b.completed_at)}` : " → …"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}