import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import proApi from "../../api/proClient.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import { fmtDate, fmtMAD, fmtNum, ORDER_BADGES, ORDER_LABELS, StatusBadge } from "./helpers.jsx";

const FILTERS = [
  ["", "Toutes"],
  ["confirmed", "Confirmées"],
  ["shipped", "Expédiées"],
  ["delivered", "Livrées"],
  ["cancelled", "Annulées"],
];

export default function ProCommandes() {
  useDocumentTitle("Espace Pro — Commandes");
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");

  const load = useCallback((status = "") => {
    setOrders(null);
    setError(null);
    proApi
      .get("/pro/orders/", { params: status ? { status } : {} })
      .then(({ data }) => setOrders(data))
      .catch((err) =>
        setError(err.response?.data?.detail || "Impossible de charger vos commandes.")
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-frost">Commandes</h1>
        <p className="mt-1 text-sm text-ash">
          Suivez l'avancement de vos commandes et de vos livraisons.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setFilter(key);
              load(key);
            }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ${
              filter === key
                ? "bg-gradient-to-r from-amber to-copper text-ink ring-transparent"
                : "bg-panel text-ash ring-line hover:text-frost"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl bg-rose/10 px-5 py-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>
      )}

      {!orders && !error && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {orders && orders.length === 0 && (
        <EmptyState
          icon="📦"
          title="Aucune commande"
          message="Vos commandes apparaîtront ici dès qu'elles auront été créées."
        />
      )}

      {orders && orders.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }) {
  const volume = order.items.reduce((s, i) => s + (i.volume_m3 || 0), 0);
  return (
    <div className="rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line transition hover:ring-amber/30">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber/15 text-lg text-amber ring-1 ring-amber/30">
            📦
          </div>
          <div>
            <p className="font-semibold text-frost">{order.so_number}</p>
            <p className="text-xs text-dim">Passée le {fmtDate(order.order_date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} map={ORDER_BADGES} labels={ORDER_LABELS} />
          <span className="font-display text-lg font-bold text-frost">{fmtMAD(order.total_amount)}</span>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="mb-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-dim">Volume</p>
            <p className="text-sm font-semibold text-frost">{fmtNum(volume)} m³</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-dim">Articles</p>
            <p className="text-sm font-semibold text-frost">{order.items.length}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-dim">Payé</p>
            <p className="text-sm font-semibold text-jade">{fmtMAD(order.paid_amount)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-dim">Solde</p>
            <p className="text-sm font-semibold text-rose">{fmtMAD(order.balance_due)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {order.items.slice(0, 4).map((i) => (
            <span key={i.id} className="rounded-lg bg-raise px-2.5 py-1 text-xs text-ash ring-1 ring-line">
              {i.product} · {fmtNum(i.quantity_ordered)}
            </span>
          ))}
          {order.items.length > 4 && (
            <span className="rounded-lg bg-raise px-2.5 py-1 text-xs text-dim ring-1 ring-line">
              +{order.items.length - 4} autre{order.items.length - 4 > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProOrderDetail() {
  useDocumentTitle("Espace Pro — Commande");
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    proApi
      .get(`/pro/orders/${id}/`)
      .then(({ data }) => setOrder(data))
      .catch((err) => setError(err.response?.data?.detail || "Impossible de charger la commande."));
  }, [id]);

  if (error) {
    return (
      <div className="rounded-2xl bg-rose/10 px-5 py-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>
    );
  }
  if (!order) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const volume = order.items.reduce((s, i) => s + (i.volume_m3 || 0), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <a href="/pro/commandes" className="text-sm font-medium text-amber hover:underline">
            ← Toutes mes commandes
          </a>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-frost">
            {order.so_number}
          </h1>
        </div>
        <StatusBadge status={order.status} map={ORDER_BADGES} labels={ORDER_LABELS} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MiniStat label="Commandée le" value={fmtDate(order.order_date)} />
        <MiniStat label="Livraison prévue" value={fmtDate(order.delivery_date)} />
        <MiniStat label="Volume" value={`${fmtNum(volume)} m³`} />
        <MiniStat label="Solde" value={fmtMAD(order.balance_due)} />
      </div>

      <div className="overflow-hidden rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
        <div className="divide-y divide-line">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate font-semibold text-frost">{item.product}</p>
                <p className="text-xs text-dim">
                  {item.quantity_ordered} unité{item.quantity_ordered > 1 ? "s" : ""}
                  {item.volume_m3 ? ` · ${fmtNum(item.volume_m3)} m³` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-dim">{fmtMAD(item.unit_price)} / m³</p>
                <p className="text-sm font-bold text-frost">{fmtMAD(item.line_total)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1.5 border-t border-line px-5 py-4">
          <div className="flex justify-between text-sm text-ash">
            <span>Sous-total</span>
            <span>{fmtMAD(order.subtotal)}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-sm text-jade">
              <span>
                Remise {order.tier_name ? `(${order.tier_name})` : ""} —{order.discount_percent}%
              </span>
              <span>− {fmtMAD(order.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-ash">
            <span>TVA</span>
            <span>{fmtMAD(order.tax_amount)}</span>
          </div>
          <div className="flex justify-between pt-1 text-base font-bold text-frost">
            <span>Total</span>
            <span>{fmtMAD(order.total_amount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-panel px-4 py-3 shadow-lg shadow-black/20 ring-1 ring-line">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-dim">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-frost">{value}</p>
    </div>
  );
}