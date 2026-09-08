import { useEffect, useState } from "react";
import proApi from "../../api/proClient.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import { fmtDate, fmtMAD } from "./helpers.jsx";

const PAY_BADGES = {
  paid: "bg-jade/15 text-jade ring-jade/30",
  awaited: "bg-skyx/15 text-skyx ring-skyx/30",
  partial: "bg-amber/15 text-amber ring-amber/30",
  pending: "bg-ash/15 text-ash ring-ash/30",
  overdue: "bg-rose/15 text-rose ring-rose/30",
};

function PaymentBadge({ status }) {
  const label =
    status === "paid"
      ? "Réglée"
      : status === "awaited"
      ? "En attente d'échéance"
      : status === "partial"
      ? "Partiellement réglée"
      : status === "overdue"
      ? "En retard"
      : "Non réglée";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${PAY_BADGES[status] || PAY_BADGES.pending}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

async function downloadPdf(url, filename) {
  const { data } = await proApi.get(url, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export default function ProFactures() {
  useDocumentTitle("Espace Pro — Facturation");
  const [invoices, setInvoices] = useState(null);
  const [payments, setPayments] = useState(null);
  const [avoirs, setAvoirs] = useState(null);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    Promise.all([proApi.get("/pro/invoices/"), proApi.get("/pro/payments/"), proApi.get("/pro/avoirs/")])
      .then(([inv, pay, av]) => {
        setInvoices(inv.data || []);
        setPayments(pay.data || []);
        setAvoirs(av.data || []);
      })
      .catch((err) =>
        setError(err.response?.data?.detail || "Impossible de charger la facturation.")
      );
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl bg-rose/10 px-5 py-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>
    );
  }

  if (!invoices || !payments || !avoirs) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const totalInvoiced = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);
  const totalPaid = payments.filter((p) => p.due_date ? new Date(p.due_date) <= new Date() : true).reduce((s, p) => s + (p.amount || 0), 0);
  const awaiting = payments.filter((p) => p.due_date && new Date(p.due_date) > new Date()).reduce((s, p) => s + (p.amount || 0), 0);
  const balance = totalInvoiced - totalPaid;

  const printInvoice = async (inv) => {
    setDownloading(inv.id);
    try {
      await downloadPdf(`/pro/invoices/${inv.id}/pdf/`, `${inv.so_number}_FACTURE.pdf`);
    } catch (err) {
      setError(err.response?.data?.detail || "Échec de la génération du PDF.");
    } finally {
      setDownloading(null);
    }
  };

  const printAvoir = async (cn) => {
    setDownloading(`av-${cn.id}`);
    try {
      await downloadPdf(`/pro/avoirs/${cn.id}/pdf/`, `${cn.credit_note_number}_AVOIR.pdf`);
    } catch (err) {
      setError(err.response?.data?.detail || "Échec de la génération du PDF.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-frost">Facturation</h1>
        <p className="mt-1 text-sm text-ash">
          Consultez vos factures, vos bons de livraison, vos avoirs et vos encaissements.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Total facturé" value={fmtMAD(totalInvoiced)} color="text-amber" />
        <SummaryCard label="Total réglé" value={fmtMAD(totalPaid)} color="text-jade" />
        <SummaryCard label="Reste à payer" value={fmtMAD(balance)} color={balance + awaiting > 0 ? "text-rose" : "text-jade"} sub={awaiting > 0 ? `dont ${fmtMAD(awaiting)} en attente d'échéance` : null} />
      </div>

      {/* Invoices */}
      <div className="rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold text-frost">Mes factures</h2>
        </div>
        {invoices.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="Aucune facture"
            message="Vos factures apparaîtront ici après vos premières commandes."
          />
        ) : (
          <div className="divide-y divide-line">
            {invoices.map((inv) => (
              <div key={inv.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-frost">{inv.so_number}</p>
                      <PaymentBadge status={inv.payment_status} />
                    </div>
                    <p className="text-xs text-dim">
                      Facture du {fmtDate(inv.order_date)} · Échéance {fmtDate(inv.due_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-dim">Total</p>
                      <p className="text-sm font-bold text-frost">{fmtMAD(inv.total_amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-dim">Solde</p>
                      <p className={`text-sm font-bold ${inv.balance_due > 0 ? "text-rose" : "text-jade"}`}>
                        {fmtMAD(inv.balance_due)}
                      </p>
                    </div>
                    <button
                      onClick={() => printInvoice(inv)}
                      disabled={downloading === inv.id}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ash transition hover:bg-raise hover:text-amber disabled:opacity-50"
                    >
                      {downloading === inv.id ? "…" : "🗒 PDF"}
                    </button>
                  </div>
                </div>

                {(inv.delivery_notes?.length > 0 || inv.avoirs?.length > 0) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {inv.delivery_notes?.map((d) => (
                      <span key={d.bl_number} className="rounded-full bg-raise px-2.5 py-0.5 font-mono text-dim ring-1 ring-line">
                        📦 {d.bl_number}
                      </span>
                    ))}
                    {inv.avoirs?.map((a) => (
                      <span key={a.id} className="rounded-full bg-amber/10 px-2.5 py-0.5 font-mono text-amber ring-1 ring-amber/30">
                        Avoir {a.credit_note_number} · −{fmtMAD(a.applied_amount)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Avoirs */}
      <div className="rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold text-frost">Mes avoirs</h2>
        </div>
        {avoirs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-dim">Aucun avoir émis.</p>
        ) : (
          <div className="divide-y divide-line">
            {avoirs.map((cn) => (
              <div key={cn.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-frost">{cn.credit_note_number}</p>
                    <span className="rounded-full bg-amber/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber ring-1 ring-amber/30">
                      {cn.reason_label}
                    </span>
                  </div>
                  <p className="text-xs text-dim">
                    Émis le {fmtDate(cn.created_date)}
                    {cn.sales_order_ref ? ` · Facture ${cn.sales_order_ref}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-dim">Montant HT</p>
                    <p className="text-sm font-bold text-frost">{fmtMAD(cn.amount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-dim">TTC</p>
                    <p className="text-sm font-bold text-amber">{fmtMAD(cn.amount_ttc)}</p>
                  </div>
                  <button
                    onClick={() => printAvoir(cn)}
                    disabled={downloading === `av-${cn.id}`}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ash transition hover:bg-raise hover:text-amber disabled:opacity-50"
                  >
                    {downloading === `av-${cn.id}` ? "…" : "🗒 PDF"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payments */}
      <div className="rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold text-frost">Historique des paiements</h2>
        </div>
        {payments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-dim">Aucun paiement enregistré.</p>
        ) : (
          <div className="divide-y divide-line">
            {payments.map((p) => {
              const future = p.due_date && new Date(p.due_date) > new Date();
              return (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-frost">{fmtMAD(p.amount)}</p>
                    <p className="text-xs text-dim">
                      {fmtDate(p.payment_date)}
                      {p.method_label ? ` · ${p.method_label}` : ""}
                      {p.bank_name ? ` · ${p.bank_name}` : ""}
                      {p.sales_order_ref ? ` · ${p.sales_order_ref}` : ""}
                    </p>
                    {p.reference && <p className="text-xs text-dim">Réf : {p.reference}</p>}
                    {p.due_date && <p className="text-xs text-dim">Échéance : {fmtDate(p.due_date)}</p>}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                      future ? "bg-skyx/15 text-skyx ring-skyx/30" : "bg-jade/15 text-jade ring-jade/30"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {future ? "En attente d'encaissement" : "Encaissé"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, sub }) {
  return (
    <div className="rounded-2xl bg-panel p-5 shadow-lg shadow-black/20 ring-1 ring-line">
      <p className="text-sm font-medium text-ash">{label}</p>
      <p className={`font-display mt-2 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-dim">{sub}</p>}
    </div>
  );
}