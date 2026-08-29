import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import { downloadPdf } from "../api/download.js";
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "../components/ToastContext.jsx";
import useDocumentTitle from "../hooks/useDocumentTitle.jsx";
import WoodCalculatorModal from "../components/WoodCalculatorModal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Skeleton from "../components/Skeleton.jsx";

const fmt = (n, d = 2) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

function OrderCard({ order, kind, toast }) {
  const isSale = kind === "sale";
  const party = isSale ? order.client : order.supplier;
  return (
    <div className="rounded-2xl bg-panel p-5 shadow-lg shadow-black/20 ring-1 ring-line">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ring-1 ${
              isSale ? "bg-rose/10 text-rose ring-rose/30" : "bg-jade/10 text-jade ring-jade/30"
            }`}
          >
            {isSale ? "↑" : "↓"}
          </span>
          <div>
            <p className="font-mono text-xs text-dim">{order[isSale ? "so_number" : "po_number"]}</p>
            <p className="text-sm font-semibold text-frost">{party || "—"}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`font-display text-lg font-bold ${isSale ? "text-rose" : "text-jade"}`}>
            {fmt(order.total_amount)} MAD
          </p>
          <p className="text-xs text-dim">{order.warehouse} · {order.order_date}</p>
          {isSale && order.tier_name && (
            <p className="text-[11px] font-semibold text-jade">
              −{order.discount_percent}% · {order.tier_name}
            </p>
          )}
          {isSale && order.margin_pct !== null && order.margin_pct !== undefined && (
            <p className="text-[11px] text-dim">
              Marge : <span className="font-semibold text-jade">{fmt(order.margin_pct, 1)}%</span>
            </p>
          )}
          {isSale && (
            <p className="text-[11px] text-dim">
              Payé <span className="font-semibold text-frost">{fmt(order.paid_amount, 0)}</span> · Reste{" "}
              <span className="font-semibold text-amber">{fmt(order.balance_due, 0)}</span>
            </p>
          )}
        </div>
      </div>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-line text-dim">
            <th className="py-1.5 font-medium">Produit</th>
            <th className="py-1.5 text-right font-medium">Qté</th>
            <th className="py-1.5 text-right font-medium">m³</th>
            <th className="py-1.5 text-right font-medium">MAD/m³</th>
            <th className="py-1.5 text-right font-medium">Total MAD</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {(order.items || []).map((it) => (
            <tr key={it.id}>
              <td className="py-1.5 font-medium text-ash">{it.product}</td>
              <td className="py-1.5 text-right text-ash">{fmt(it.quantity_ordered)}</td>
              <td className="py-1.5 text-right text-ash">{fmt(it.volume_m3, 4)}</td>
              <td className="py-1.5 text-right text-ash">{fmt(it.unit_price)}</td>
              <td className="py-1.5 text-right font-semibold text-frost">{fmt(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {isSale ? (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
          <PdfButton
            label="Devis PDF"
            onClick={async () => {
              try {
                await downloadPdf(`/sales-orders/${order.id}/quotation/`, `${order.so_number}_DEVIS.pdf`);
                toast.success("Devis téléchargé.");
              } catch (_) {
                toast.error("Échec du téléchargement du devis.");
              }
            }}
          />
          <PdfButton
            label="Facture PDF"
            accent
            onClick={async () => {
              try {
                await downloadPdf(`/sales-orders/${order.id}/invoice/`, `${order.so_number}_FACTURE.pdf`);
                toast.success("Facture téléchargée.");
              } catch (_) {
                toast.error("Échec du téléchargement de la facture.");
              }
            }}
          />
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
          <PdfButton
            label="Bon de commande PDF"
            accent
            onClick={async () => {
              try {
                await downloadPdf(
                  `/purchase-orders/${order.id}/pdf/`,
                  `${order.po_number}_BON_DE_COMMANDE.pdf`
                );
                toast.success("Bon de commande téléchargé.");
              } catch (_) {
                toast.error("Échec du téléchargement du bon de commande.");
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

function PdfButton({ label, onClick, accent = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
        accent
          ? "border-amber/40 text-amber hover:bg-amber/10"
          : "border-line text-ash hover:border-amber/40 hover:text-amber"
      }`}
    >
      ⭳ {label}
    </button>
  );
}

const MOVEMENT_META = {
  purchase_in: { label: "Entrée achat", tone: "text-jade", sign: "+" },
  sale_out: { label: "Sortie vente", tone: "text-rose", sign: "-" },
  purchase_return: { label: "Retour achat", tone: "text-rose", sign: "-" },
  sale_return: { label: "Retour vente", tone: "text-jade", sign: "+" },
  transfer_in: { label: "Entrée transfert", tone: "text-jade", sign: "+" },
  transfer_out: { label: "Sortie transfert", tone: "text-rose", sign: "-" },
  adjustment: { label: "Ajustement", tone: "text-skyx", sign: "±" },
  opening: { label: "Stock initial", tone: "text-jade", sign: "+" },
};

function MovementCard({ m }) {
  const meta = MOVEMENT_META[m.movement_type] || {
    label: m.movement_type,
    tone: "text-ash",
    sign: "±",
  };
  return (
    <div className="rounded-2xl bg-panel p-5 shadow-lg shadow-black/20 ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ring-1 ${
              m.movement_type === "adjustment"
                ? "bg-skyx/10 text-skyx ring-skyx/30"
                : meta.sign === "-"
                  ? "bg-rose/10 text-rose ring-rose/30"
                  : "bg-jade/10 text-jade ring-jade/30"
            }`}
          >
            {meta.sign}
          </span>
          <div>
            <p className="font-mono text-xs text-dim">{m.movement_no}</p>
            <p className="text-sm font-semibold text-frost">{m.product}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`font-display text-lg font-bold ${meta.tone}`}>
            {meta.sign === "-" ? "−" : meta.sign === "±" ? "" : "+"}
            {fmt(Math.abs(m.quantity))}
          </p>
          <p className="text-xs text-dim">{m.warehouse} · {m.moved_at}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-raise px-2.5 py-0.5 font-semibold text-ash ring-1 ring-line">
            {meta.label}
          </span>
          {m.lot_number && (
            <span className="rounded-full bg-raise px-2.5 py-0.5 font-mono text-dim ring-1 ring-line">
              {m.lot_number}
            </span>
          )}
        </div>
        <span className="text-dim">
          {m.volume_m3 !== null && m.volume_m3 !== undefined ? `${fmt(m.volume_m3, 4)} m³` : "—"}
        </span>
      </div>
      {m.note && <p className="mt-2 text-xs italic text-ash">{m.note}</p>}
    </div>
  );
}

export default function Transactions() {
  const { warehouses, warehouseId, refreshKey, refresh } = useApp();
  const toast = useToast();
  useDocumentTitle("Ventes & Achats");
  const [tab, setTab] = useState("sale");
  const [orders, setOrders] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    if (tab === "movements") {
      api
        .get("/stock-movements/", { params: { page_size: 50 } })
        .then((res) => setMovements(res.data.results || res.data || []))
        .catch((err) => {
          setMovements([]);
          setError(err.response?.data?.detail || err.message || "Impossible de charger les mouvements.");
        })
        .finally(() => setLoading(false));
      return;
    }
    const endpoint = tab === "sale" ? "/sales-orders/" : "/purchase-orders/";
    api
      .get(endpoint, { params: { page_size: 50 } })
      .then((res) => setOrders(res.data.results || res.data || []))
      .catch((err) => {
        setOrders([]);
        setError(err.response?.data?.detail || err.message || "Impossible de charger les commandes.");
      })
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-frost">Ventes &amp; Achats</h1>
          <p className="text-sm text-ash">Historique des commandes facturées au m³ (MAD/m³).</p>
        </div>
        <button
          onClick={() => setModal(tab)}
          disabled={tab === "movements"}
          className={`rounded-lg bg-gradient-to-r from-amber to-copper px-4 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110 ${
            tab === "movements" ? "opacity-40" : ""
          }`}
        >
          + Nouvelle {tab === "sale" ? "Vente" : "Commande Achat"}
        </button>
      </header>

      <div className="mb-5 flex gap-2">
        {[
          { key: "sale", label: "Ventes" },
          { key: "purchase", label: "Achats" },
          { key: "movements", label: "Mouvements" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? "bg-gradient-to-r from-amber to-copper text-ink shadow-lg shadow-amber/20"
                : "bg-panel text-ash ring-1 ring-line hover:bg-raise hover:text-frost"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">
          {error}
          <button
            onClick={load}
            className="ml-3 rounded-lg border border-rose/40 px-2.5 py-1 text-xs font-semibold text-rose transition hover:bg-rose/10"
          >
            Réessayer
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : tab === "movements" ? (
        movements.length === 0 ? (
          <EmptyState
            icon="⇅"
            title="Aucun mouvement"
            message="Le journal des mouvements de stock apparaîtra ici (ventes, achats, transferts, ajustements…)."
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {movements.map((m) => (
              <MovementCard key={m.id} m={m} />
            ))}
          </div>
        )
      ) : orders.length === 0 ? (
        <EmptyState
          icon={tab === "sale" ? "↑" : "↓"}
          title={tab === "sale" ? "Aucune vente enregistrée" : "Aucune commande d'achat"}
          message={
            tab === "sale"
              ? "Enregistrez votre première vente grâce au calculateur m³ pour suivre vos chiffres."
              : "Enregistrez une réception via le calculateur m³ pour alimenter votre stock."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} kind={tab} toast={toast} />
          ))}
        </div>
      )}

      <WoodCalculatorModal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        mode={modal || "sale"}
        warehouses={warehouses}
        defaultWarehouseId={warehouseId}
        onConfirm={() => {
          setModal(null);
          refresh();
        }}
      />
    </div>
  );
}
