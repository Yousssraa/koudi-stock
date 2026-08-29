import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import { downloadPdf } from "../api/download.js";
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "../components/ToastContext.jsx";
import useDocumentTitle from "../hooks/useDocumentTitle.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Skeleton from "../components/Skeleton.jsx";

const fmt = (n, d = 2) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const MOVEMENT_META = {
  purchase_in: { label: "Achat", tone: "text-jade" },
  sale_out: { label: "Vente", tone: "text-rose" },
  transfer_in: { label: "Transfert +", tone: "text-skyx" },
  transfer_out: { label: "Transfert −", tone: "text-skyx" },
  adjustment: { label: "Ajustement", tone: "text-amber" },
  opening: { label: "Initial", tone: "text-ash" },
  purchase_return: { label: "Retour achat", tone: "text-amber" },
  sale_return: { label: "Retour vente", tone: "text-jade" },
};
const INFLOW = ["purchase_in", "transfer_in", "opening", "sale_return"];

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function Archive() {
  const toast = useToast();
  useDocumentTitle("Archive");
  const { warehouses } = useApp();

  const [tab, setTab] = useState("bl");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // BL history
  const [bls, setBls] = useState([]);
  const [blYear, setBlYear] = useState("");
  const [blMonth, setBlMonth] = useState("");
  const [blStatus, setBlStatus] = useState("");

  // Movements
  const [moves, setMoves] = useState([]);
  const [moYear, setMoYear] = useState("");
  const [moMonth, setMoMonth] = useState("");
  const [moType, setMoType] = useState("");

  const now = new Date();
  const years = Array.from(new Set([now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]));

  const loadBls = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page_size: "500" });
    if (blYear) params.set("year", blYear);
    if (blMonth) params.set("month", blMonth);
    if (blStatus) params.set("status", blStatus);
    api
      .get(`/delivery-notes/?${params.toString()}`)
      .then((r) => setBls(r.data.results || r.data || []))
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false));
  }, [blYear, blMonth, blStatus]);

  const loadMoves = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page_size: "500", ordering: "-moved_at" });
    if (moYear) params.set("year", moYear);
    if (moMonth) params.set("month", moMonth);
    if (moType) params.set("movement_type", moType);
    api
      .get(`/stock-movements/?${params.toString()}`)
      .then((r) => setMoves(r.data.results || r.data || []))
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false));
  }, [moYear, moMonth, moType]);

  useEffect(() => {
    if (tab === "bl") loadBls();
    else loadMoves();
  }, [tab, loadBls, loadMoves]);

  const printBl = async (bl) => {
    try {
      await downloadPdf(`/delivery-notes/${bl.id}/pdf/`, `${bl.bl_number}_BON_DE_LIVRAISON.pdf`);
      toast.success("PDF téléchargé.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec du téléchargement du PDF.");
    }
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-frost">Archive</h1>
        <p className="text-sm text-ash">
          Historique des bons de livraison et journal des mouvements de stock.
        </p>
      </header>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-panel p-1 ring-1 ring-line">
        {[
          { key: "bl", label: "Bons de livraison" },
          { key: "moves", label: "Mouvements de stock" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.key ? "bg-gradient-to-r from-amber to-copper text-ink" : "text-ash hover:text-frost"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "bl" ? (
        <>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              value={blYear}
              onChange={(e) => setBlYear(e.target.value)}
              className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium text-frost outline-none transition focus:border-amber/60"
            >
              <option value="">Toutes années</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={blMonth}
              onChange={(e) => setBlMonth(e.target.value)}
              className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium text-frost outline-none transition focus:border-amber/60"
            >
              <option value="">Tous mois</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={blStatus}
              onChange={(e) => setBlStatus(e.target.value)}
              className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium text-frost outline-none transition focus:border-amber/60"
            >
              <option value="">Tous statuts</option>
              <option value="preparation">En préparation</option>
              <option value="in_transit">En cours</option>
              <option value="delivered">Livré</option>
            </select>
          </div>

          {error && <div className="mb-4 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>}

          {loading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : bls.length === 0 ? (
            <EmptyState icon="🗄" title="Aucun bon de livraison" message="Aucun BL ne correspond à ces filtres." />
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-raise">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">N° BL</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Date</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Client</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Chauffeur</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Véhicule</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">Volume</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Statut</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {bls.map((bl) => (
                    <tr key={bl.id} className="border-b border-line/50 transition hover:bg-raise/40">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-frost">{bl.bl_number}</td>
                      <td className="px-4 py-3 text-ash">{new Date(bl.order_date).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3 text-frost">{bl.client}</td>
                      <td className="px-4 py-3 text-ash">{bl.driver_name || "—"}</td>
                      <td className="px-4 py-3 text-ash">{bl.truck_plate || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber">
                        {fmt(bl.total_volume_m3, 3)} m³
                      </td>
                      <td className="px-4 py-3 text-ash">
                        {bl.status_label || bl.status}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => printBl(bl)}
                          title="Re-télécharger le PDF"
                          className="rounded-lg border border-amber/40 px-3 py-1.5 text-xs font-semibold text-amber transition hover:bg-amber/10"
                        >
                          ⭳ PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Movement filters */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              value={moYear}
              onChange={(e) => setMoYear(e.target.value)}
              className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium text-frost outline-none transition focus:border-amber/60"
            >
              <option value="">Toutes années</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={moMonth}
              onChange={(e) => setMoMonth(e.target.value)}
              className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium text-frost outline-none transition focus:border-amber/60"
            >
              <option value="">Tous mois</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={moType}
              onChange={(e) => setMoType(e.target.value)}
              className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium text-frost outline-none transition focus:border-amber/60"
            >
              <option value="">Tous types</option>
              {Object.entries(MOVEMENT_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {error && <div className="mb-4 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>}

          {loading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : moves.length === 0 ? (
            <EmptyState icon="↻" title="Aucun mouvement" message="Aucun mouvement ne correspond à ces filtres." />
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-raise">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Date</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Produit</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Type</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">Qté</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">Vol. m³</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Dépôt</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Réf.</th>
                  </tr>
                </thead>
                <tbody>
                  {moves.map((m) => {
                    const meta = MOVEMENT_META[m.movement_type] || { label: m.movement_type, tone: "text-ash" };
                    const inflow = INFLOW.includes(m.movement_type);
                    return (
                      <tr key={m.id} className="border-b border-line/50 transition hover:bg-raise/40">
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-ash">
                          {new Date(m.moved_at).toLocaleString("fr-FR")}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-frost">{m.product}</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${meta.tone} ${meta.tone.replace("text-", "bg-")}/10`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${inflow ? "text-jade" : "text-rose"}`}>
                          {inflow ? "+" : "−"}{fmt(Math.abs(Number(m.quantity)))}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-amber">
                          {m.volume_m3 === null ? "—" : fmt(m.volume_m3, 3)}
                        </td>
                        <td className="px-4 py-2.5 text-ash">{m.warehouse}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-dim">{m.movement_no}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
