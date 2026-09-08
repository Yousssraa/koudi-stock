import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client.js";
import { downloadPdf } from "../api/download.js";
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "../components/ToastContext.jsx";
import useDocumentTitle from "../hooks/useDocumentTitle.jsx";

const fmt = (n, d = 2) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtDate = (s) => {
  if (!s) return "—";
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  return isNaN(d) ? "—" : d.toLocaleDateString("fr-FR");
};

const PAY_BADGE = {
  paid: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  awaited: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
  partial: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  pending: "bg-slate-400/10 text-slate-300 ring-slate-400/30",
  overdue: "bg-rose-400/10 text-rose-300 ring-rose-400/30",
};
const PAY_STATUS_CHIPS = [
  { key: "", label: "Toutes" },
  { key: "paid", label: "Réglée" },
  { key: "awaited", label: "En attente d'échéance" },
  { key: "partial", label: "Partielle" },
  { key: "pending", label: "Non réglée" },
  { key: "overdue", label: "En retard" },
];
const AVOIR_REASONS = [
  { key: "", label: "" },
  { key: "return", label: "Retour de marchandise" },
  { key: "volume_correction", label: "Correction de volume (m³)" },
  { key: "commercial", label: "Avoir commercial" },
];

function PayBadge({ status }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${PAY_BADGE[status] || PAY_BADGE.pending}`}>
      {status === "paid"
        ? "Réglée"
        : status === "awaited"
        ? "En attente d'échéance"
        : status === "partial"
        ? "Partiellement réglée"
        : status === "overdue"
        ? "En retard"
        : "Non réglée"}
    </span>
  );
}

const inputCls =
  "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-amber-500/70";
const btnPrimary =
  "rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/20 transition hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none";
const btnGhost =
  "rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-50";

function SummaryCard({ label, value, accent, sub }) {
  return (
    <div className="rounded-2xl bg-slate-800 p-4 shadow-lg shadow-black/20 ring-1 ring-slate-700/60">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`font-display mt-1 text-xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default function Facturation() {
  const { warehouses, warehouseId } = useApp();
  const toast = useToast();
  useDocumentTitle("Facturation");

  const [tab, setTab] = useState("factures");

  // Factures tab
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [q, setQ] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expanded, setExpanded] = useState(new Set());
  const [loadingInvoices, setLoadingInvoices] = useState(true);

  // Regroupement tab
  const [unbilled, setUnbilled] = useState([]);
  const [unbilledClient, setUnbilledClient] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [groupNotes, setGroupNotes] = useState("");
  const [groupDate, setGroupDate] = useState("");
  const [grouping, setGrouping] = useState(false);

  // Avoirs tab
  const [avoirs, setAvoirs] = useState([]);
  const [loadingAvoirs, setLoadingAvoirs] = useState(true);
  const [avoirOpen, setAvoirOpen] = useState(false);
  const [avoirForm, setAvoirForm] = useState({ client_id: "", sales_order_id: "", reason: "", amount: "", notes: "" });
  const [emitting, setEmitting] = useState(false);

  const [clients, setClients] = useState([]);
  const [loadKey, setLoadKey] = useState(0);
  const reload = () => setLoadKey((k) => k + 1);

  const loadClients = useCallback(() => {
    api
      .get("/clients/", { params: { page_size: 500 } })
      .then((r) => setClients(r.data.results || r.data || []))
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const loadInvoices = useCallback(() => {
    setLoadingInvoices(true);
    api
      .get("/invoices/", {
        params: {
          client: clientFilter || undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
          q: q || undefined,
          status: statusFilter || undefined,
        },
      })
      .then((r) => {
        setInvoices(r.data.results || []);
        setSummary(r.data.summary || null);
      })
      .catch((err) => toast.error(err.response?.data?.detail || "Échec du chargement des factures."))
      .finally(() => setLoadingInvoices(false));
  }, [clientFilter, dateFrom, dateTo, q, statusFilter, toast]);

  const loadUnbilled = useCallback(() => {
    api
      .get("/invoices/unbilled-bl/", { params: { client: unbilledClient || undefined } })
      .then((r) => {
        setUnbilled(r.data || []);
        setSelected((prev) => new Set([...prev].filter((id) => (r.data || []).some((b) => b.id === id))));
      })
      .catch((err) => toast.error(err.response?.data?.detail || "Échec du chargement des BL facturables."));
  }, [unbilledClient, toast]);

  const loadAvoirs = useCallback(() => {
    setLoadingAvoirs(true);
    api
      .get("/credit-notes/", { params: { client: clientFilter || undefined } })
      .then((r) => setAvoirs(r.data || []))
      .catch((err) => toast.error(err.response?.data?.detail || "Échec du chargement des avoirs."))
      .finally(() => setLoadingAvoirs(false));
  }, [clientFilter, toast]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices, loadKey]);

  useEffect(() => {
    if (tab === "regroupement") loadUnbilled();
  }, [tab, loadUnbilled]);

  useEffect(() => {
    if (tab === "avoirs") loadAvoirs();
  }, [tab, loadAvoirs]);

  const clientOptions = useMemo(() => [...new Set(clients)], [clients]);

  const toggleExpand = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedTotal = useMemo(
    () => unbilled.filter((b) => selected.has(b.id)).reduce((s, b) => s + (b.total_amount || 0), 0),
    [unbilled, selected]
  );

  const printInvoice = async (so) => {
    try {
      await downloadPdf(`/invoices/${so.id}/pdf/`, `${so.so_number}_FACTURE.pdf`);
      toast.success("Facture PDF générée.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de la génération du PDF.");
    }
  };

  const whatsappReminder = async (so) => {
    try {
      const { data } = await api.get(`/invoices/${so.id}/reminder/whatsapp/`);
      window.open(data.url, "_blank", "noopener");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de la relance WhatsApp.");
    }
  };

  const emailReminder = async (so) => {
    try {
      const { data } = await api.post(`/invoices/${so.id}/reminder/email/`);
      if (data.sent) toast.success("Relance e-mail envoyée.");
      else toast.info(data.detail || "Relance enregistrée (SMTP non configuré).");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de la relance e-mail.");
    }
  };

  const exportCsv = async () => {
    try {
      await downloadPdf(
        "/invoices/export/",
        "factures_import_comptable.csv",
        { client: clientFilter || undefined, from: dateFrom || undefined, to: dateTo || undefined, status: statusFilter || undefined }
      );
      toast.success("Export SAGE/Ciel téléchargé.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de l'export CSV.");
    }
  };

  const createGroupedInvoice = async () => {
    if (selected.size === 0) {
      toast.error("Sélectionnez au moins un bon de livraison.");
      return;
    }
    const clientId = Number(unbilledClient);
    if (!clientId) {
      toast.error("Sélectionnez un client.");
      return;
    }
    setGrouping(true);
    try {
      const { data } = await api.post("/invoices/grouped/", {
        client_id: clientId,
        warehouse_id: Number(warehouseId) || warehouses?.[0]?.id,
        bl_ids: [...selected],
        notes: groupNotes || undefined,
        order_date: groupDate || undefined,
      });
      toast.success(`Facture ${data.so_number} créée (${fmt(data.total_amount)} MAD).`);
      setSelected(new Set());
      setGroupNotes("");
      setGroupDate("");
      reload();
      setTab("factures");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de la création de la facture.");
    } finally {
      setGrouping(false);
    }
  };

  const printAvoir = async (cn) => {
    try {
      await downloadPdf(`/credit-notes/${cn.id}/pdf/`, `${cn.credit_note_number}_AVOIR.pdf`);
      toast.success("Avoir PDF généré.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de la génération du PDF.");
    }
  };

  const emitAvoir = async () => {
    const amount = Number(avoirForm.amount);
    if (!Number(avoirForm.client_id) || !amount || amount <= 0) {
      toast.error("Client et montant sont requis.");
      return;
    }
    setEmitting(true);
    try {
      const { data } = await api.post("/credit-notes/", {
        client_id: Number(avoirForm.client_id),
        sales_order_id: avoirForm.sales_order_id ? Number(avoirForm.sales_order_id) : null,
        reason: avoirForm.reason || "return",
        amount,
        notes: avoirForm.notes || undefined,
      });
      toast.success(`Avoir ${data.credit_note_number} émis (${fmt(data.applied_amount)} appliqués).`);
      setAvoirOpen(false);
      setAvoirForm({ client_id: "", sales_order_id: "", reason: "", amount: "", notes: "" });
      reload();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de l'émission de l'avoir.");
    } finally {
      setEmitting(false);
    }
  };

  const avoirInvoices = clientFilter
    ? invoices.filter((i) => i.client_id === Number(clientFilter))
    : invoices.filter((i) => i.client_id === Number(avoirForm.client_id));

  return (
    <div className="-m-6 min-h-screen bg-slate-900 px-6 py-6 text-slate-200 lg:-m-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Facturation</h1>
          <p className="text-sm text-slate-400">
            Regroupement des bons de livraison, factures légales TVA 20 %, avoirs et relances.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportCsv} className={btnGhost}>
            ⬇ Exporter SAGE/Ciel
          </button>
          <button onClick={() => setTab("avoirs")} className={btnGhost}>
            + Émettre un avoir
          </button>
          <button onClick={() => setTab("regroupement")} className={btnPrimary}>
            + Facturer des BL
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-slate-800 p-1 ring-1 ring-slate-700/60">
        {[
          { key: "factures", label: "Factures" },
          { key: "regroupement", label: "Facturer des BL" },
          { key: "avoirs", label: "Avoirs" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "factures" && (
        <>
          {/* Summary */}
          {summary && (
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryCard label="Total facturé" value={`${fmt(summary.total_invoiced)} MAD`} accent="text-white" />
              <SummaryCard label="Solde à recouvrer" value={`${fmt(summary.total_balance)} MAD`} accent="text-amber-400" />
              <SummaryCard
                label="En retard"
                value={`${fmt(summary.total_overdue)} MAD`}
                accent="text-rose-400"
                sub="Montants non réglés au-delà de l'échéance"
              />
            </div>
          )}

          {/* Filters */}
          <div className="mb-4 rounded-2xl bg-slate-800 p-4 shadow-lg shadow-black/20 ring-1 ring-slate-700/60">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Recherche</label>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N° facture…" className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Client</label>
                <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={`${inputCls} w-full`}>
                  <option value="">Tous les clients</option>
                  {clientOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Du</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Au</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Statut</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`${inputCls} w-full`}
                >
                  {PAY_STATUS_CHIPS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">Filtres rapides :</span>
              {PAY_STATUS_CHIPS.filter((s) => s.key).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(s.key === statusFilter ? "" : s.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                    statusFilter === s.key
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 ring-transparent"
                      : "bg-slate-900 text-slate-400 ring-slate-700 hover:text-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Register table */}
          {loadingInvoices ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-800 ring-1 ring-slate-700/60" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="rounded-2xl bg-slate-800 px-6 py-14 text-center ring-1 ring-slate-700/60">
              <p className="font-display text-lg font-bold text-white">Aucune facture</p>
              <p className="mt-1 text-sm text-slate-400">
                Facturez des bons de livraison livrés pour alimenter le registre.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-slate-800 shadow-lg shadow-black/20 ring-1 ring-slate-700/60">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/60">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Facture</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Client</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Date</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total HT</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Payé</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reste</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Échéance</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Statut</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">BL</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((so) => (
                    <ExpandableRow
                      key={so.id}
                      so={so}
                      expanded={expanded.has(so.id)}
                      onToggle={() => toggleExpand(so.id)}
                      onPdf={() => printInvoice(so)}
                      onWhatsapp={() => whatsappReminder(so)}
                      onEmail={() => emailReminder(so)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "regroupement" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl bg-slate-800 shadow-lg shadow-black/20 ring-1 ring-slate-700/60">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 p-4">
              <div>
                <h2 className="font-display text-lg font-bold text-white">Bons de livraison facturables</h2>
                <p className="text-xs text-slate-400">Sélectionnez les BL non encore facturés à regrouper en une facture mensuelle.</p>
              </div>
              <select value={unbilledClient} onChange={(e) => setUnbilledClient(e.target.value)} className={inputCls}>
                <option value="">Tous les clients</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
            {unbilled.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="font-display text-lg font-bold text-white">Aucun BL à facturer</p>
                <p className="mt-1 text-sm text-slate-400">Tous les bons de livraison ont déjà été regroupés en facture.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/60">
                {unbilled.map((b) => (
                  <label
                    key={b.id}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-slate-900/40"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(b.id)}
                      onChange={() => toggleSelect(b.id)}
                      className="h-4 w-4 accent-amber-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-white">{b.bl_number}</span>
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-400 ring-1 ring-slate-700">
                          {b.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {b.client} · {b.warehouse} · {fmtDate(b.order_date)} · {b.item_count} ligne(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Volume</p>
                      <p className="font-display text-sm font-bold text-amber-400">{fmt(b.total_volume_m3, 3)} m³</p>
                      <p className="text-xs text-slate-400">{fmt(b.total_amount)} MAD</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-slate-800 p-4 shadow-lg shadow-black/20 ring-1 ring-slate-700/60 lg:sticky lg:top-24 lg:self-start">
            <h2 className="font-display text-lg font-bold text-white">Créer la facture</h2>
            <p className="mt-1 text-xs text-slate-400">
              {selected.size} BL sélectionnés · {fmt(selectedTotal)} MAD HT
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Date de facture</label>
                <input type="date" value={groupDate} onChange={(e) => setGroupDate(e.target.value)} className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Notes</label>
                <textarea
                  value={groupNotes}
                  onChange={(e) => setGroupNotes(e.target.value)}
                  rows={3}
                  placeholder="Facture de regroupement mensuelle…"
                  className={`${inputCls} w-full resize-none`}
                />
              </div>
              <button onClick={createGroupedInvoice} disabled={grouping || selected.size === 0} className={`${btnPrimary} w-full`}>
                {grouping ? "Création…" : "Créer la facture de regroupement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "avoirs" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-400">{avoirs.length} avoir(s) émis</p>
            <button onClick={() => setAvoirOpen(true)} className={btnPrimary}>
              + Émettre un avoir
            </button>
          </div>
          {loadingAvoirs ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-800 ring-1 ring-slate-700/60" />
              ))}
            </div>
          ) : avoirs.length === 0 ? (
            <div className="rounded-2xl bg-slate-800 px-6 py-14 text-center ring-1 ring-slate-700/60">
              <p className="font-display text-lg font-bold text-white">Aucun avoir</p>
              <p className="mt-1 text-sm text-slate-400">
                Émettez une Facture d'Avoir pour la marchandise retournée ou une remise commerciale.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-slate-800 shadow-lg shadow-black/20 ring-1 ring-slate-700/60">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/60">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">N° Avoir</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Date</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Client</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Facture d'origine</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Motif</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Montant HT</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">TTC</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Appliqué</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {avoirs.map((cn) => (
                    <tr key={cn.id} className="border-b border-slate-700/50 transition hover:bg-slate-900/40">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-white">{cn.credit_note_number}</td>
                      <td className="px-4 py-3 text-slate-400">{fmtDate(cn.created_date)}</td>
                      <td className="px-4 py-3 text-slate-200">{cn.client}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{cn.sales_order_ref || "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{cn.reason_label}</td>
                      <td className="px-4 py-3 text-right text-slate-200">{fmt(cn.amount)}</td>
                      <td className="px-4 py-3 text-right text-slate-200">{fmt(cn.amount_ttc)}</td>
                      <td className="px-4 py-3 text-right text-amber-400">{fmt(cn.applied_amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => printAvoir(cn)}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white"
                        >
                          🖨 PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {avoirOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" onClick={() => setAvoirOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-slate-800 p-6 shadow-2xl ring-1 ring-slate-700" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-bold text-white">Émettre un avoir</h2>
            <p className="mt-0.5 text-xs text-slate-400">Crédite le client et réduit le solde de la facture liée.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Client</label>
                <select
                  value={avoirForm.client_id}
                  onChange={(e) => setAvoirForm((f) => ({ ...f, client_id: e.target.value, sales_order_id: "" }))}
                  className={`${inputCls} w-full`}
                >
                  <option value="">— Sélectionner —</option>
                  {clientOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Facture d'origine</label>
                <select
                  value={avoirForm.sales_order_id}
                  onChange={(e) => setAvoirForm((f) => ({ ...f, sales_order_id: e.target.value }))}
                  className={`${inputCls} w-full`}
                >
                  <option value="">— Sans facture (crédit client) —</option>
                  {avoirInvoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.so_number} · {fmt(i.balance_due)} MAD. restant
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Motif</label>
                <select
                  value={avoirForm.reason}
                  onChange={(e) => setAvoirForm((f) => ({ ...f, reason: e.target.value }))}
                  className={`${inputCls} w-full`}
                >
                  <option value="return">Retour de marchandise</option>
                  <option value="volume_correction">Correction de volume (m³)</option>
                  <option value="commercial">Avoir commercial</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Montant (MAD HT)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={avoirForm.amount}
                  onChange={(e) => setAvoirForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className={`${inputCls} w-full`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Notes</label>
                <textarea
                  value={avoirForm.notes}
                  onChange={(e) => setAvoirForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className={`${inputCls} w-full resize-none`}
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setAvoirOpen(false)} className={btnGhost}>
                  Annuler
                </button>
                <button onClick={emitAvoir} disabled={emitting} className={btnPrimary}>
                  {emitting ? "Émission…" : "Émettre l'avoir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpandableRow({ so, expanded, onToggle, onPdf, onWhatsapp, onEmail }) {
  return (
    <>
      <tr className="border-b border-slate-700/50 transition hover:bg-slate-900/40">
        <td className="px-4 py-3">
          <button onClick={onToggle} className="flex items-center gap-2 text-left">
            <span className={`text-xs text-slate-500 transition ${expanded ? "rotate-90" : ""}`}>▶</span>
            <span className="font-mono text-xs font-semibold text-white">{so.so_number}</span>
          </button>
        </td>
        <td className="px-4 py-3 text-slate-200">{so.client}</td>
        <td className="px-4 py-3 text-slate-400">{fmtDate(so.order_date)}</td>
        <td className="px-4 py-3 text-right text-slate-200">{fmt(so.total_amount)}</td>
        <td className="px-4 py-3 text-right text-slate-400">{fmt(so.paid_amount)}</td>
        <td className="px-4 py-3 text-right font-semibold text-amber-400">{fmt(so.balance_due)}</td>
        <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(so.due_date)}</td>
        <td className="px-4 py-3">
          <PayBadge status={so.payment_status} />
        </td>
        <td className="px-4 py-3 text-xs text-slate-400">
          {(so.delivery_notes || []).map((d) => d.bl_number).join(", ") || "—"}
        </td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1.5">
            <button
              onClick={onPdf}
              title="Facture PDF"
              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              🖨
            </button>
            <button
              onClick={onWhatsapp}
              title="Relance WhatsApp"
              className="rounded-lg border border-emerald-500/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/10"
            >
              ✆
            </button>
            <button
              onClick={onEmail}
              title="Relance e-mail"
              className="rounded-lg border border-sky-400/40 px-2.5 py-1.5 text-xs font-semibold text-sky-300 transition hover:bg-sky-400/10"
            >
              ✉
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-700/50 bg-slate-900/30">
          <td colSpan={10} className="px-6 py-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Lignes de la facture</p>
                <div className="overflow-hidden rounded-xl ring-1 ring-slate-700">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-800">
                        <th className="px-3 py-2 font-semibold text-slate-400">Produit</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-400">Qté</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-400">m³</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-400">PU</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-400">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(so.items || []).map((it) => (
                        <tr key={it.id} className="border-b border-slate-700/40">
                          <td className="px-3 py-2 text-slate-200">{it.product}</td>
                          <td className="px-3 py-2 text-right text-slate-400">{fmt(it.quantity_shipped)}</td>
                          <td className="px-3 py-2 text-right text-slate-400">{fmt(it.volume_m3, 3)}</td>
                          <td className="px-3 py-2 text-right text-slate-400">{fmt(it.unit_price)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-200">{fmt(it.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Avoirs liés</p>
                  {(so.avoirs || []).length === 0 ? (
                    <p className="text-xs text-slate-500">Aucun avoir.</p>
                  ) : (
                    <ul className="space-y-1">
                      {(so.avoirs || []).map((a) => (
                        <li key={a.id} className="flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-1.5 text-xs ring-1 ring-slate-700/60">
                          <span className="font-mono text-slate-300">{a.credit_note_number}</span>
                          <span className="text-slate-400">{a.reason_label}</span>
                          <span className="font-semibold text-amber-400">−{fmt(a.applied_amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-xl bg-slate-900/50 p-3 text-xs ring-1 ring-slate-700/60">
                  <p className="flex justify-between text-slate-400">
                    <span>Total HT</span>
                    <span className="text-slate-200">{fmt(so.total_amount)} MAD</span>
                  </p>
                  <p className="flex justify-between text-slate-400">
                    <span>TVA 20 %</span>
                    <span className="text-slate-200">{fmt(so.total_amount * 0.2)} MAD</span>
                  </p>
                  <p className="flex justify-between border-t border-slate-700 pt-1 font-semibold text-white">
                    <span>Total TTC</span>
                    <span>{fmt(so.total_amount * 1.2)} MAD</span>
                  </p>
                  <p className="mt-1 flex justify-between text-slate-400">
                    <span>Reste à régler (TTC)</span>
                    <span className="text-amber-400">{fmt(so.balance_due * 1.2)} MAD</span>
                  </p>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}