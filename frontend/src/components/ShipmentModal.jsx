import { useEffect, useState } from "react";
import api from "../api/client.js";

const fmt = (n, d = 2) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const input =
  "w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none transition focus:border-amber/50 focus:ring-2 focus:ring-amber/20";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-dim";

function emptyItem() {
  return { product_id: "", quantity: "1", price_per_m3: "" };
}

export default function ShipmentModal({ open, onClose, clients = [], warehouses = [], defaultWarehouseId, onSaved }) {
  const [clientId, setClientId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [truckPlate, setTruckPlate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([emptyItem()]);
  const [products, setProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setClientId(clients[0]?.id ?? "");
    setWarehouseId(defaultWarehouseId ?? warehouses[0]?.id ?? "");
    setDriverName("");
    setTruckPlate("");
    setNotes("");
    setItems([emptyItem()]);
    setError(null);
    setSubmitting(false);
    api
      .get("/products/lookup/")
      .then((r) => setProducts(r.data || []))
      .catch(() => setProducts([]));
  }, [open, clients, warehouses, defaultWarehouseId]);

  if (!open) return null;

  const productMap = Object.fromEntries(products.map((p) => [String(p.id), p]));

  const setItem = (i, patch) => {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const addItem = () => setItems((arr) => [...arr, emptyItem()]);
  const removeItem = (i) => setItems((arr) => arr.filter((_, idx) => idx !== i));

  const itemVolume = (it) => {
    const p = productMap[String(it.product_id)];
    if (!p || !p.volume_cubic_m) return 0;
    const q = parseFloat(it.quantity) || 0;
    return p.volume_cubic_m * q;
  };
  const itemPrice = (it) => {
    const p = productMap[String(it.product_id)];
    if (!p) return 0;
    const price = parseFloat(it.price_per_m3) || p.sale_price || 0;
    return itemVolume(it) * price;
  };
  const totalVolume = items.reduce((s, it) => s + itemVolume(it), 0);
  const totalAmount = items.reduce((s, it) => s + itemPrice(it), 0);

  const valid = clientId && warehouseId && items.some((it) => it.product_id && parseFloat(it.quantity) > 0);

  const submit = async () => {
    setError(null);
    if (!valid) {
      setError("Renseignez le client, le dépôt et au moins une ligne produit valide.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/delivery-notes/create/", {
        client_id: Number(clientId),
        warehouse_id: Number(warehouseId),
        driver_name: driverName.trim(),
        truck_plate: truckPlate.trim(),
        notes: notes.trim(),
        items: items
          .filter((it) => it.product_id && parseFloat(it.quantity) > 0)
          .map((it) => ({
            product_id: Number(it.product_id),
            quantity: Number(it.quantity),
            price_per_m3: it.price_per_m3 ? Number(it.price_per_m3) : undefined,
          })),
      });
      onSaved?.(data);
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Échec de la création du bon de livraison.");
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
        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-panel shadow-2xl shadow-black/50 ring-1 ring-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line bg-raise px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-frost">Nouvelle livraison</h2>
            <p className="text-xs text-dim">Bon de livraison (BL) — déduit le stock et génère le document.</p>
          </div>
          <button onClick={onClose} className="text-dim transition hover:text-frost" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>Client *</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={input}>
                {clients.length === 0 && <option value="">Aucun client</option>}
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Dépôt *</label>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={input}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Chauffeur</label>
              <input
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Nom du livreur"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Immatriculation</label>
              <input
                value={truckPlate}
                onChange={(e) => setTruckPlate(e.target.value)}
                placeholder="12345-A-6"
                className={input}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={label}>Articles</label>
              <button
                type="button"
                onClick={addItem}
                className="rounded-lg border border-amber/40 px-3 py-1 text-xs font-semibold text-amber transition hover:bg-amber/10"
              >
                + Ajouter une ligne
              </button>
            </div>

            <div className="space-y-3">
              {items.map((it, i) => {
                const p = productMap[String(it.product_id)];
                return (
                  <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl bg-raise/50 p-3 ring-1 ring-line">
                    <div className="col-span-5">
                      <label className={label}>Produit</label>
                      <select
                        value={it.product_id}
                        onChange={(e) => setItem(i, { product_id: e.target.value })}
                        className={input}
                      >
                        <option value="">— Choisir —</option>
                        {products.map((pr) => (
                          <option key={pr.id} value={pr.id}>
                            {pr.sku} · {pr.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={label}>Qté</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={it.quantity}
                        onChange={(e) => setItem(i, { quantity: e.target.value })}
                        className={input}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className={label}>PU (MAD/m³)</label>
                      <input
                        type="number"
                        step="any"
                        value={it.price_per_m3}
                        onChange={(e) => setItem(i, { price_per_m3: e.target.value })}
                        placeholder={p ? String(p.sale_price || "") : ""}
                        className={input}
                      />
                    </div>
                    <div className="col-span-2 text-right">
                      <label className={label}>Vol. m³</label>
                      <p className="py-1 text-sm font-semibold text-amber">{fmt(itemVolume(it), 3)}</p>
                    </div>
                    <div className="col-span-1 flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        disabled={items.length === 1}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose/40 text-rose transition hover:bg-rose/10 disabled:opacity-30"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={input}
              />
            </div>
            <div className="flex flex-col justify-center rounded-xl bg-raise p-4 ring-1 ring-line">
              <div className="flex items-center justify-between text-sm">
                <span className="text-dim">Volume total</span>
                <span className="font-semibold text-amber">{fmt(totalVolume, 3)} m³</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-dim">Total HT</span>
                <span className="font-semibold text-frost">{fmt(totalAmount, 0)} MAD</span>
              </div>
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
              {submitting ? "Création…" : "Créer le bon de livraison"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
