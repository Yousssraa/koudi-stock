import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import proApi from "../../api/proClient.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import {
  fmtDate,
  fmtMAD,
  fmtNum,
  ORDER_BADGES,
  ORDER_LABELS,
  QUOTE_BADGES,
  QUOTE_LABELS,
  StatusBadge,
} from "./helpers.jsx";

const STATUS_STYLES = {
  fidele: {
    badge: "bg-gradient-to-r from-amber to-copper text-ink shadow-lg shadow-amber/20",
    text: "text-amber",
    ring: "ring-amber/40",
  },
  actif: { badge: "bg-skyx/15 text-skyx ring-skyx/40", text: "text-skyx", ring: "ring-skyx/30" },
  nouveau: { badge: "bg-ash/15 text-ash ring-ash/40", text: "text-ash", ring: "ring-ash/30" },
  a_risque: { badge: "bg-rose/15 text-rose ring-rose/40", text: "text-rose", ring: "ring-rose/30" },
};

export default function ProFidelite() {
  useDocumentTitle("Espace Pro — Fidélité");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    proApi
      .get("/pro/loyalty/")
      .then(({ data }) => setData(data))
      .catch((err) =>
        setError(err.response?.data?.detail || "Impossible de charger votre statut fidélité.")
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
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-44" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const style = STATUS_STYLES[data.status] || STATUS_STYLES.nouveau;
  const s = data.stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-frost">Fidélité</h1>
        <p className="mt-1 text-sm text-ash">
          Votre statut de client fidèle et votre dossier complet : devis, commandes et factures.
        </p>
      </div>

      {/* Status hero */}
      <div className={`rounded-2xl bg-gradient-to-br from-ink via-panel to-ink p-6 shadow-lg shadow-black/20 ring-1 ${style.ring}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${style.badge}`}>
              {data.is_loyal ? "★" : "○"} {data.status_label}
            </span>
            <p className="font-display mt-4 text-3xl font-bold tracking-tight text-frost">
              {data.is_loyal ? "Client Fidèle" : "Votre fidélité progresse"}
            </p>
            <p className="mt-1 text-sm text-ash">
              {data.is_loyal
                ? "Vous remplissez tous les critères du programme de fidélité."
                : `${fmtNum(100 - data.criteria.filter((c) => c.met).length * 25)}% des critères atteints.`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.15em] text-dim">Membre depuis</p>
            <p className="font-display mt-1 text-xl font-bold text-frost">{fmtDate(data.since)}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Volume commandé" value={`${fmtNum(s.invoiced_volume_m3)} m³`} />
          <MiniStat label="Total facturé" value={fmtMAD(s.total_invoiced)} />
          <MiniStat label="Commandes facturées" value={fmtNum(s.order_count, 0)} />
          <MiniStat
            label="Paiements à l'échéance"
            value={`${s.on_time_settled}/${s.settled || "–"}`}
          />
        </div>
      </div>

      {/* Criteria */}
      <div className="rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold text-frost">Critères du statut fidèle</h2>
          <p className="mt-0.5 text-xs text-dim">
            Les quatre conditions du programme sont évaluées sur votre historique.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {data.criteria.map((c) => (
            <CriterionCard key={c.key} criterion={c} />
          ))}
        </div>
      </div>

      {/* Dossier */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DossierSection title="Devis récents" icon="📄" empty="Aucun devis" linkTo="/pro/devis" linkLabel="Tous les devis">
          {(data.recent_quotes || []).map((q) => (
            <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <Link to={`/pro/devis/${q.id}`} className="font-semibold text-frost hover:text-amber">
                  {q.quote_number}
                </Link>
                <p className="text-xs text-dim">Créé le {fmtDate(q.created_at)}</p>
              </div>
              <div className="flex items-center gap-4">
                <StatusBadge status={q.status} map={QUOTE_BADGES} labels={QUOTE_LABELS} />
                <p className="text-sm font-bold text-frost">{fmtMAD(q.total_amount)}</p>
              </div>
            </div>
          ))}
        </DossierSection>

        <DossierSection title="Commandes récentes" icon="📦" empty="Aucune commande" linkTo="/pro/commandes" linkLabel="Toutes les commandes">
          {(data.recent_orders || []).map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <Link to={`/pro/commandes/${o.id}`} className="font-semibold text-frost hover:text-amber">
                  {o.so_number}
                </Link>
                <p className="text-xs text-dim">Commande du {fmtDate(o.order_date)}</p>
              </div>
              <div className="flex items-center gap-4">
                <StatusBadge status={o.status} map={ORDER_BADGES} labels={ORDER_LABELS} />
                <p className="text-sm font-bold text-frost">{fmtMAD(o.total_amount)}</p>
              </div>
            </div>
          ))}
        </DossierSection>

        <DossierSection title="Factures récentes" icon="🧾" empty="Aucune facture" linkTo="/pro/factures" linkLabel="Toutes les factures">
          {(data.recent_invoices || []).map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="font-semibold text-frost">{inv.so_number}</p>
                <p className="text-xs text-dim">Facture du {fmtDate(inv.order_date)}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-dim">Solde</p>
                  <p className={`text-sm font-bold ${inv.balance_due > 0 ? "text-rose" : "text-jade"}`}>
                    {fmtMAD(inv.balance_due)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </DossierSection>

        <DossierSection title="Paiements récents" icon="💳" empty="Aucun paiement" linkTo="/pro/factures" linkLabel="Historique des paiements">
          {(data.recent_payments || []).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="font-semibold text-frost">{fmtMAD(p.amount)}</p>
                <p className="text-xs text-dim">
                  {fmtDate(p.payment_date)}
                  {p.method ? ` · ${p.method}` : ""}
                  {p.sales_order_ref ? ` · ${p.sales_order_ref}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-jade/10 px-2.5 py-0.5 text-xs font-semibold text-jade ring-1 ring-jade/30">
                Encaissé
              </span>
            </div>
          ))}
        </DossierSection>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl bg-ink/60 px-4 py-3 ring-1 ring-line">
      <p className="text-xs text-dim">{label}</p>
      <p className="mt-1 text-lg font-bold text-frost">{value}</p>
    </div>
  );
}

function CriterionCard({ criterion }) {
  const ok = criterion.met;
  const showBar = criterion.key === "volume" || criterion.key === "orders";
  const pct = criterion.target > 0 ? Math.min(100, (criterion.value / criterion.target) * 100) : 0;
  return (
    <div
      className={`rounded-xl px-4 py-3.5 ring-1 ${
        ok ? "bg-jade/10 ring-jade/30" : "bg-rose/10 ring-rose/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`text-sm font-semibold ${ok ? "text-jade" : "text-rose"}`}>
          {ok ? "✓" : "✗"} {criterion.label}
        </p>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-frost/80">{criterion.detail}</p>
      {showBar && (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${ok ? "bg-jade" : "bg-rose"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function DossierSection({ title, icon, empty, linkTo, linkLabel, children }) {
  return (
    <div className="rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-display text-lg font-bold text-frost">
          <span className="mr-2" aria-hidden>
            {icon}
          </span>
          {title}
        </h2>
        <Link to={linkTo} className="text-xs font-semibold text-amber transition hover:text-copper">
          {linkLabel} →
        </Link>
      </div>
      {Array.isArray(children) && children.length === 0 ? (
        <EmptyState icon={icon} title={empty} message={`Votre dossier est vide pour le moment.`} />
      ) : (
        <div className="divide-y divide-line">{children}</div>
      )}
    </div>
  );
}