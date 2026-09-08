import { useEffect, useState } from "react";
import proApi from "../../api/proClient.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import MetricCard from "../../components/MetricCard.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import {
  DeliveryBadge,
  fmtDate,
  fmtMAD,
  fmtNum,
  ORDER_BADGES,
  ORDER_LABELS,
  StatusBadge,
} from "./helpers.jsx";

export default function ProDashboard() {
  useDocumentTitle("Espace Pro — Tableau de bord");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    proApi
      .get("/pro/dashboard/")
      .then(({ data }) => setData(data))
      .catch((err) =>
        setError(err.response?.data?.detail || "Impossible de charger le tableau de bord.")
      );
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl bg-rose/10 px-5 py-4 text-sm text-rose ring-1 ring-rose/30">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const { company, credit, summary, recent_orders, recent_deliveries, notifications } = data;

  const creditPct = credit.credit_used_pct ?? 0;
  const creditColor =
    creditPct >= 100
      ? "bg-rose"
      : creditPct >= 70
      ? "bg-amber"
      : "bg-gradient-to-r from-amber to-copper";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-frost">
            Bonjour, {company.contact_name || company.company_name} 👋
          </h1>
          <p className="mt-1 text-sm text-ash">
            Voici l'activité de votre compte professionnel chez KOUDI WOOD.
          </p>
        </div>
        {notifications.length > 0 && (
          <div className="rounded-2xl bg-skyx/10 px-4 py-3 text-sm text-skyx ring-1 ring-skyx/30">
            🔔 {notifications.length} notification{notifications.length > 1 ? "s" : ""} non lue
            {notifications.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Montant facturé" value={fmtMAD(summary.total_invoiced)} icon="🧾" accent="amber" />
        <MetricCard title="Montant payé" value={fmtMAD(summary.total_paid)} icon="✅" accent="jade" />
        <MetricCard title="Solde dû" value={fmtMAD(summary.balance_due)} icon="💶" accent="rose" />
        <MetricCard
          title="Devis en attente"
          value={summary.pending_quotes}
          icon="📄"
          accent="sky"
          sub={`${summary.total_quotes} devis au total`}
        />
      </div>

      {/* Credit status */}
      <div className="rounded-2xl bg-panel p-6 shadow-lg shadow-black/20 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ash">État du crédit</p>
            <p className="font-display mt-1 text-2xl font-bold text-frost">
              {fmtMAD(credit.outstanding)}{" "}
              <span className="text-sm font-normal text-dim">
                sur {fmtMAD(credit.limit)} de plafond
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-dim">
              Délai de paiement :{" "}
              <span className="font-semibold text-frost">{credit.payment_terms_days} jours</span>
            </p>
            <p className="text-xs text-dim">
              Crédit disponible :{" "}
              <span className="font-semibold text-jade">{fmtMAD(credit.available_credit)}</span>
            </p>
          </div>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-raise">
          <div
            className={`h-full rounded-full ${creditColor}`}
            style={{ width: `${Math.min(creditPct, 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-right text-xs text-dim">Utilisation : {fmtNum(creditPct, 1)}%</p>
        {credit.is_blocked && (
          <p className="mt-4 rounded-lg bg-rose/10 px-4 py-3 text-sm text-rose ring-1 ring-rose/30">
            ⚠️ Votre compte est actuellement bloqué. Veuillez contacter le service commercial pour le
            régulariser.
          </p>
        )}
        {credit.overdue > 0 && (
          <p className="mt-4 rounded-lg bg-amber/10 px-4 py-3 text-sm text-amber ring-1 ring-amber/30">
            ⏰ Impayés totalisant {fmtMAD(credit.overdue)} arrivés à échéance. Merci de régulariser
            votre situation.
          </p>
        )}
      </div>

      {/* Recent orders */}
      <div className="rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold text-frost">Commandes récentes</h2>
          <a href="/pro/commandes" className="text-sm font-medium text-amber hover:underline">
            Voir tout →
          </a>
        </div>
        {recent_orders.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-dim">Aucune commande pour le moment.</p>
        ) : (
          <div className="divide-y divide-line">
            {recent_orders.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-semibold text-frost">{o.so_number}</p>
                  <p className="text-xs text-dim">Passée le {fmtDate(o.order_date)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-frost">{fmtMAD(o.total_amount)}</span>
                  <StatusBadge status={o.status} map={ORDER_BADGES} labels={ORDER_LABELS} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent deliveries + Notifications */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-lg font-bold text-frost">Livraisons</h2>
          </div>
          {recent_deliveries.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-dim">Aucune livraison pour le moment.</p>
          ) : (
            <div className="divide-y divide-line">
              {recent_deliveries.map((d) => (
                <div key={d.bl_number} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-semibold text-frost">{d.bl_number}</p>
                    <p className="text-xs text-dim">
                      {fmtDate(d.order_date)} · {fmtNum(d.total_volume_m3)} m³
                    </p>
                  </div>
                  <DeliveryBadge status={d.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-lg font-bold text-frost">Notifications</h2>
          </div>
          {notifications.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-dim">Aucune notification.</p>
          ) : (
            <div className="divide-y divide-line">
              {notifications.map((n) => (
                <div key={n.id} className="px-5 py-4">
                  <p className="text-sm font-semibold text-frost">{n.title}</p>
                  {n.message && <p className="mt-0.5 text-xs text-ash">{n.message}</p>}
                  <p className="mt-1 text-[11px] text-dim">
                    {new Date(n.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}