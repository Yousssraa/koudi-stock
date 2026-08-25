import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "../components/ToastContext.jsx";
import useDocumentTitle from "../hooks/useDocumentTitle.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Skeleton from "../components/Skeleton.jsx";

const fmt = (n, d = 2) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const input =
  "w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none transition focus:border-amber/60";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-dim";

export default function Clients() {
  const { refreshKey } = useApp();
  const toast = useToast();
  useDocumentTitle("Clients & Crédit");

  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalClient, setModalClient] = useState(null);
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get("/clients/", { params: { page_size: 200 } }),
      api.get("/payments/"),
    ])
      .then(([cRes, pRes]) => {
        setClients(cRes.data.results || cRes.data || []);
        setPayments(pRes.data || []);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message || "Impossible de charger les clients.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const totalOutstanding = clients.reduce((s, c) => s + (Number(c.outstanding) || 0), 0);
  const totalOverdue = clients.reduce((s, c) => s + (Number(c.overdue) || 0), 0);
  const overLimitCount = clients.filter((c) => c.over_limit).length;
  const blockedCount = clients.filter((c) => c.is_blocked).length;

  const openPayment = (client) => {
    setModalClient(client);
    setForm({ amount: "", payment_date: new Date().toISOString().slice(0, 10), method: "Virement" });
  };

  const submitPayment = async () => {
    setSubmitting(true);
    try {
      await api.post("/payments/", {
        client_id: modalClient.id,
        amount: form.amount,
        payment_date: form.payment_date || undefined,
        method: form.method || undefined,
        reference: form.reference || undefined,
        note: form.note || undefined,
      });
      toast.success(`Encaissement ${fmt(form.amount)} MAD enregistré.`);
      setModalClient(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de l'encaissement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-frost">Clients &amp; Crédit</h1>
          <p className="text-sm text-ash">
            Suivi des impayés, échéances de paiement et plafonds de crédit (MAD/m³).
          </p>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Impayés totaux", value: `${fmt(totalOutstanding, 0)} MAD`, tone: "text-rose", icon: "◕" },
          { label: "Retards", value: `${fmt(totalOverdue, 0)} MAD`, tone: "text-amber", icon: "⏳" },
          { label: "Clients > plafond", value: overLimitCount, tone: "text-copper", icon: "⚠" },
          { label: "Clients bloqués", value: blockedCount, tone: "text-rose", icon: "⛔" },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl bg-panel p-5 shadow-lg shadow-black/20 ring-1 ring-line">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-dim">
              <span className="text-base">{m.icon}</span> {m.label}
            </p>
            <p className={`mt-2 font-display text-2xl font-bold ${m.tone}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState icon="✉" title="Aucun client" message="Vos comptes clients apparaîtront ici avec leur plafond de crédit." />
      ) : (
        <div className="space-y-4">
          {clients.map((c) => {
            const pct = c.credit_limit > 0 ? Math.min(100, (c.outstanding / c.credit_limit) * 100) : 0;
            return (
              <article key={c.id} className="rounded-2xl bg-panel p-5 shadow-lg shadow-black/20 ring-1 ring-line">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-amber/10 text-sm font-bold text-copper ring-1 ring-amber/30">
                      ✉
                    </span>
                    <div>
                      <h3 className="font-display text-[15px] font-bold text-frost">{c.company_name}</h3>
                      <p className="font-mono text-[11px] text-dim">
                        {c.code} · paiement {c.payment_terms_days || "—"} j · {c.tax_id || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.is_blocked && (
                      <span className="rounded-full bg-rose/10 px-2.5 py-0.5 text-xs font-bold text-rose ring-1 ring-rose/30">
                        ⛔ Bloqué
                      </span>
                    )}
                    {c.over_limit && (
                      <span className="rounded-full bg-amber/10 px-2.5 py-0.5 text-xs font-bold text-amber ring-1 ring-amber/30">
                        ⚠ Dépassement
                      </span>
                    )}
                    {c.overdue > 0 && (
                      <span className="rounded-full bg-skyx/10 px-2.5 py-0.5 text-xs font-semibold text-skyx ring-1 ring-skyx/30">
                        Retard {fmt(c.overdue, 0)} MAD
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <p className="mb-1 flex items-center justify-between text-xs text-dim">
                      <span className="font-semibold uppercase tracking-wide">Impayé / Plafond</span>
                      <span className="font-semibold text-ash">
                        {fmt(c.outstanding, 0)} / {fmt(c.credit_limit, 0)} MAD
                      </span>
                    </p>
                    <div className="h-2.5 overflow-hidden rounded-full bg-raise ring-1 ring-line">
                      <div
                        className={`h-full rounded-full transition-all ${
                          c.over_limit
                            ? "bg-gradient-to-r from-rose to-copper"
                            : "bg-gradient-to-r from-amber to-jade"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-dim">
                      Crédit utilisé : {c.credit_used_pct === null ? "—" : `${c.credit_used_pct}%`} · Disponible :{" "}
                      <strong className="text-frost">{fmt(c.available_credit, 0)} MAD</strong>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-dim">Disponible</p>
                    <p className="mt-1 font-display text-base font-bold text-jade">{fmt(c.available_credit, 0)} MAD</p>
                  </div>
                  <div className="flex items-end justify-end">
                    <button
                      onClick={() => openPayment(c)}
                      className="rounded-lg border border-jade/40 bg-panel px-4 py-2 text-sm font-semibold text-jade transition hover:bg-jade/10"
                    >
                      + Encaisser
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {payments.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-bold text-frost">Encaissements récents</h2>
          <div className="overflow-x-auto rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-line text-dim">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Client</th>
                  <th className="px-4 py-2.5 font-medium">Réf.</th>
                  <th className="px-4 py-2.5 font-medium">Facture</th>
                  <th className="px-4 py-2.5 text-right font-medium">Montant MAD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {payments.slice(0, 25).map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 text-ash">{p.payment_date}</td>
                    <td className="px-4 py-2 font-medium text-frost">{p.client}</td>
                    <td className="px-4 py-2 text-ash">{p.reference || "—"}</td>
                    <td className="px-4 py-2 text-ash">{p.sales_order_ref || "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold text-jade">{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modalClient && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-panel shadow-2xl shadow-black/50 ring-1 ring-line">
            <div className="flex items-center justify-between border-b border-line bg-raise px-6 py-4">
              <div>
                <h2 className="font-display text-lg font-bold text-frost">Encaisser un paiement</h2>
                <p className="text-xs text-dim">{modalClient.company_name}</p>
              </div>
              <button onClick={() => setModalClient(null)} className="text-dim transition hover:text-frost" aria-label="Fermer">
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Montant (MAD)</label>
                  <input
                    type="number"
                    min="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Date</label>
                  <input
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                    className={input}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Mode</label>
                  <select
                    value={form.method || "Virement"}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                    className={input}
                  >
                    {["Virement", "Chèque", "Espèces", "Lettre de change"].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Référence</label>
                  <input
                    type="text"
                    value={form.reference || ""}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    placeholder="REG-…"
                    className={input}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-raise/60 px-4 py-3 text-xs text-ash ring-1 ring-line">
                Impayé client : <strong className="text-frost">{fmt(modalClient.outstanding)} MAD</strong> · Plafond :{" "}
                <strong className="text-frost">{fmt(modalClient.credit_limit)} MAD</strong>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setModalClient(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-ash transition hover:bg-raise"
                >
                  Annuler
                </button>
                <button
                  onClick={submitPayment}
                  disabled={submitting || !form.amount || Number(form.amount) <= 0}
                  className="rounded-lg bg-gradient-to-r from-jade to-teal px-5 py-2 text-sm font-semibold text-ink shadow-lg shadow-jade/20 transition hover:brightness-110 disabled:opacity-60"
                >
                  {submitting ? "Enregistrement…" : "Encaisser"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}