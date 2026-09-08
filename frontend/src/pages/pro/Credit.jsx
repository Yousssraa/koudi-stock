import { useEffect, useState } from "react";
import proApi from "../../api/proClient.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import { fmtDate, fmtMAD, fmtNum } from "./helpers.jsx";

export default function ProCredit() {
  useDocumentTitle("Espace Pro — Crédit");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    proApi
      .get("/pro/credit/")
      .then(({ data }) => setData(data))
      .catch((err) =>
        setError(err.response?.data?.detail || "Impossible de charger votre crédit.")
      );
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl bg-rose/10 px-5 py-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const pct = data.credit_used_pct ?? 0;
  const barColor =
    pct >= 100 ? "bg-rose" : pct >= 70 ? "bg-amber" : "bg-gradient-to-r from-amber to-copper";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-frost">Crédit</h1>
        <p className="mt-1 text-sm text-ash">
          Délai de paiement : {data.payment_terms_days} jours · Plafond : {fmtMAD(data.credit_limit)}
        </p>
      </div>

      {/* Credit bar */}
      <div className="rounded-2xl bg-panel p-6 shadow-lg shadow-black/20 ring-1 ring-line">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Impayés" value={data.outstanding} color="text-rose" />
          <Stat label="Échues (retard)" value={data.overdue} color="text-amber" />
          <Stat label="Crédit disponible" value={data.available_credit} color="text-jade" />
          <Stat label="Limite de crédit" value={data.credit_limit} color="text-frost" />
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs text-dim">
            <span>Utilisation du plafond</span>
            <span>{fmtNum(pct, 1)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-raise">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
        {data.is_blocked && (
          <div className="mt-5 rounded-lg bg-rose/10 px-4 py-3 text-sm text-rose ring-1 ring-rose/30">
            ⚠️ Votre compte est bloqué. Contactez notre équipe pour régulariser votre situation.
          </div>
        )}
        {data.over_limit && !data.is_blocked && (
          <div className="mt-5 rounded-lg bg-amber/10 px-4 py-3 text-sm text-amber ring-1 ring-amber/30">
            ⚠️ Votre encours dépasse votre plafond de crédit. Veuillez régulariser.
          </div>
        )}
      </div>

      {/* Statement */}
      <div className="rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold text-frost">Relevé de compte</h2>
        </div>
        {data.statement.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-dim">Aucun mouvement de compte.</p>
        ) : (
          <div className="divide-y divide-line">
            {data.statement.map((row) => (
              <div key={row.so_number} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-semibold text-frost">{row.so_number}</p>
                  <p className="text-xs text-dim">Facturé le {fmtDate(row.order_date)}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-dim">Montant</p>
                    <p className="text-sm font-semibold text-frost">{fmtMAD(row.total_amount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-dim">Réglé</p>
                    <p className="text-sm font-semibold text-jade">{fmtMAD(row.paid)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-dim">Solde</p>
                    <p className={`text-sm font-bold ${row.balance > 0 ? "text-rose" : "text-jade"}`}>
                      {fmtMAD(row.balance)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-dim">{label}</p>
      <p className={`mt-0.5 font-display text-xl font-bold ${color}`}>{fmtMAD(value)}</p>
    </div>
  );
}