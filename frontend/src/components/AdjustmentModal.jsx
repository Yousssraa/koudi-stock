import { useEffect, useState } from "react";
import api from "../api/client.js";

const fmt = (n, d = 2) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const input =
  "w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none transition focus:border-amber/50 focus:ring-2 focus:ring-amber/20";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-dim";

const warehouseShort = (name) => (name || "").replace(/^Dépôt\s+/i, "") || name || "—";

export default function AdjustmentModal({ open, onClose, product, warehouses = [], onSaved }) {
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setWarehouseId(warehouses[0]?.id ?? "");
    setQuantity("");
    setReason("");
    setError(null);
    setSubmitting(false);
  }, [open, warehouses]);

  if (!open) return null;

  const stockByWh = product?.stock_by_warehouse || [];
  const currentRow = stockByWh.find((w) => w.warehouse_id === Number(warehouseId));
  const currentQty = currentRow?.quantity ?? 0;

  const q = parseFloat(quantity);
  const validQty = !isNaN(q) && q !== 0;
  const resultingQty = validQty ? currentQty + q : null;
  const wouldGoNegative = resultingQty !== null && resultingQty < 0;

  const submit = async () => {
    setError(null);
    if (!warehouseId) return setError("Sélectionnez le dépôt à ajuster.");
    if (!validQty) return setError("Quantité invalide (doit être non nulle).");
    if (wouldGoNegative)
      return setError(`L'ajustement ferait passer le stock sous zéro (${fmt(currentQty)} disponible).`);

    setSubmitting(true);
    try {
      const { data } = await api.post("/stock-adjustments/", {
        product_id: product.id,
        warehouse_id: Number(warehouseId),
        quantity: q,
        reason: reason.trim(),
      });
      onSaved?.(data);
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => (typeof d === "string" ? d : JSON.stringify(d))).join(" · ")
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
            <h2 className="font-display text-lg font-bold text-frost">Ajustement de Stock</h2>
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
            Une quantité <strong>positive</strong> ajoute du stock, une quantité <strong>négative</strong> en
            retire (casse, perte, mauvais comptage). L'écart est tracé dans le journal des mouvements.
          </p>

          <div>
            <label className={label}>
              Dépôt
            </label>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={input}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>
              Quantité (signée)
            </label>
            <input
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="ex. 12.5 ou -4"
              className={input}
            />
          </div>

          <div>
            <label className={label}>
              Motif (optionnel)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Inventaire, casse, perte…"
              className={input}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-xl bg-raise p-4 ring-1 ring-line">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-dim">Dépôt</p>
              <p className="truncate text-sm font-semibold text-frost">
                {warehouses.find((w) => w.id === Number(warehouseId))?.name || "—"}
              </p>
              <p className="truncate text-[11px] text-dim">{warehouseShort(currentRow?.warehouse_name)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-dim">Actuel</p>
              <p className="font-display text-xl font-bold text-frost">{fmt(currentQty)}</p>
              <p className="text-[11px] text-dim">{currentRow?.volume_m3 ? `${fmt(currentRow.volume_m3, 4)} m³` : ""}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-dim">Résultat</p>
              <p className={`font-display text-xl font-bold ${wouldGoNegative ? "text-rose" : "text-jade"}`}>
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
              className="rounded-lg bg-gradient-to-r from-amber to-copper px-5 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? "Envoi…" : "Enregistrer l'ajustement"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
