import { useEffect, useState } from "react";
import api from "../api/client.js";

const fmt = (n, d = 2) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const input =
  "w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none transition focus:border-amber/50 focus:ring-2 focus:ring-amber/20";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-dim";

const MODE_META = {
  add: {
    title: "Ajouter du stock",
    action: "Ajouter",
    sign: "positive",
    tone: "text-jade",
    accent: "from-jade to-jade/60",
    note: "Augmente la quantité enregistrée dans le dépôt sélectionné.",
  },
  subtract: {
    title: "Retirer du stock",
    action: "Retirer",
    sign: "negative",
    tone: "text-rose",
    accent: "from-rose to-rose/60",
    note: "Diminue la quantité enregistrée (casse, perte, vente manuelle…).",
  },
};

export default function StockAdjustModal({ open, mode = "add", onClose, product, warehouses = [], onSaved }) {
  const meta = MODE_META[mode] || MODE_META.add;
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setWarehouseId(warehouses[0]?.id ?? "");
    setQuantity("1");
    setReason("");
    setError(null);
    setSubmitting(false);
  }, [open, warehouses, mode]);

  if (!open) return null;

  const stockByWh = product?.stock_by_warehouse || [];
  const currentRow = stockByWh.find((w) => w.warehouse_id === Number(warehouseId));
  const currentQty = currentRow?.quantity ?? 0;

  const q = parseFloat(quantity);
  const validQty = !isNaN(q) && q > 0;
  const delta = meta.sign === "positive" ? q : -q;
  const resultingQty = validQty ? currentQty + delta : null;
  const wouldGoNegative = resultingQty !== null && resultingQty < 0;

  const submit = async () => {
    setError(null);
    if (!warehouseId) return setError("Sélectionnez le dépôt.");
    if (!validQty) return setError("Quantité invalide (strictement positive).");
    if (wouldGoNegative)
      return setError(`Stock insuffisant (${fmt(currentQty)} disponible dans ce dépôt).`);

    setSubmitting(true);
    try {
      const { data } = await api.post("/stock-adjustments/", {
        product_id: product.id,
        warehouse_id: Number(warehouseId),
        quantity: delta,
        reason: reason.trim(),
      });
      onSaved?.(data);
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : err.response?.data?.quantity?.[0] || err.message
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-panel shadow-2xl shadow-black/50 ring-1 ring-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line bg-raise px-6 py-4">
          <div>
            <h2 className={`font-display text-lg font-bold ${meta.tone}`}>{meta.title}</h2>
            <p className="text-xs text-dim">
              {product?.name} · <span className="font-mono">{product?.sku}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-dim transition hover:text-frost" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
          <p className="rounded-lg bg-skyx/10 px-3 py-2 text-xs text-skyx ring-1 ring-skyx/30">
            {meta.note} L'opération est tracée dans le journal des mouvements.
          </p>

          <div>
            <label className={label}>Dépôt</label>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={input}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Quantité</label>
            <input
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="ex. 40"
              className={input}
            />
          </div>

          <div>
            <label className={label}>Motif (optionnel)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={mode === "add" ? "Achat, réception…" : "Vente, casse, perte…"}
              className={input}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-xl bg-raise p-4 ring-1 ring-line">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-dim">Dépôt</p>
              <p className="truncate text-sm font-semibold text-frost">
                {warehouses.find((w) => w.id === Number(warehouseId))?.name || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-dim">Actuel</p>
              <p className="font-display text-xl font-bold text-frost">{fmt(currentQty)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-dim">Résultat</p>
              <p className={`font-display text-xl font-bold ${wouldGoNegative ? "text-rose" : "text-frost"}`}>
                {resultingQty === null ? "—" : fmt(resultingQty)}
              </p>
              {wouldGoNegative && <p className="text-[11px] font-semibold text-rose">Sous zéro !</p>}
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-rose/10 px-3 py-2 text-sm text-rose ring-1 ring-rose/30">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-ash transition hover:bg-raise"
            >
              Annuler
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className={`rounded-lg bg-gradient-to-r ${meta.accent} px-5 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110 disabled:opacity-60`}
            >
              {submitting ? "Envoi…" : `${meta.action} ${fmt(validQty ? q : 0)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
