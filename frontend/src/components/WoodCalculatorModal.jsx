import { useEffect, useMemo, useState } from "react";
import api from "../api/client.js";

const MODES = {
  purchase: { label: "Achat (Entrée)", verb: "Réceptionner" },
  sale: { label: "Vente (Sortie)", verb: "Vendre" },
  transfer: { label: "Transfert", verb: "Transférer" },
};

function fmt(n, d = 2) {
  return (n === null || n === undefined || isNaN(n))
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

const input =
  "w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none transition focus:border-amber/50 focus:ring-2 focus:ring-amber/20 disabled:opacity-50 disabled:text-dim";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-dim";

export default function WoodCalculatorModal({
  open,
  onClose,
  mode,
  warehouses = [],
  defaultWarehouseId,
  onConfirm,
}) {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [clients, setClients] = useState([]);
  const [productId, setProductId] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [thickness, setThickness] = useState("");
  const [width, setWidth] = useState("");
  const [length, setLength] = useState("");
  const [qty, setQty] = useState("");
  const [pricePerM3, setPricePerM3] = useState("");
  const [lot, setLot] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    api
      .get("/products/lookup/")
      .then((res) => setProducts(res.data || []))
      .catch(() => setProducts([]));
    if (mode === "purchase") {
      api
        .get("/suppliers/")
        .then((res) => setSuppliers(res.data.results || res.data || []))
        .catch(() => setSuppliers([]));
    }
    if (mode === "sale") {
      api
        .get("/clients/")
        .then((res) => setClients(res.data.results || res.data || []))
        .catch(() => setClients([]));
    }
    setError(null);
    setSubmitting(false);
    setCounterpartyId("");
    setToWarehouseId("");
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    setThickness("");
    setWidth("");
    setLength("");
    setQty("");
    setLot("");
    setError(null);
  }, [open]);

  const product = products.find((p) => p.id === Number(productId));
  const client =
    mode === "sale" ? clients.find((c) => c.id === Number(counterpartyId)) : null;

  const selectProduct = (id) => {
    setProductId(id);
    const p = products.find((x) => x.id === Number(id));
    if (!p) return;
    setThickness(p.thickness_mm ?? "");
    setWidth(p.width_mm ?? "");
    setLength(p.length_mm ?? "");
    setQty("");
    setPricePerM3(mode === "sale" ? p.sale_price ?? "" : p.cost_price ?? "");
  };

  // Volume (m³) = (L_mm × W_mm × T_mm × Qty) / 1,000,000,000
  const volume = useMemo(() => {
    const t = parseFloat(thickness);
    const w = parseFloat(width);
    const l = parseFloat(length);
    const q = parseFloat(qty);
    if ([t, w, l, q].some((v) => isNaN(v) || v <= 0)) return null;
    return (t * w * l * q) / 1_000_000_000;
  }, [thickness, width, length, qty]);

  const price = parseFloat(pricePerM3);
  const total = volume && !isNaN(price) && price > 0 ? volume * price : null;

  // Volume-based tier discount: live server lookup on the current m³ total.
  const [pricing, setPricing] = useState(null);
  useEffect(() => {
    if (!open || mode === "transfer" || !volume) {
      setPricing(null);
      return;
    }
    let cancelled = false;
    api
      .get("/pricing/lookup/", { params: { volume_m3: volume } })
      .then((res) => {
        if (!cancelled) setPricing(res.data || null);
      })
      .catch(() => {
        if (!cancelled) setPricing(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, volume]);

  const discountPercent = pricing?.discount_percent || 0;
  const displayedTotal =
    total !== null && discountPercent > 0 ? total * (1 - discountPercent / 100) : total;

  const creditWarning =
    mode === "sale" && client
      ? (() => {
          const out = Number(client.outstanding) || 0;
          const lim = Number(client.credit_limit) || 0;
          const projected = out + (Number(total) || 0);
          if (client.is_blocked)
            return {
              kind: "error",
              text: "Client bloqué — les ventes sont suspendues jusqu'à régularisation du compte.",
            };
          if (client.over_limit)
            return {
              kind: "error",
              text: `Plafond de crédit dépassé (impayé ${fmt(out)} / ${fmt(lim)} MAD).`,
            };
          if (lim > 0 && projected > lim)
            return {
              kind: "warn",
              text: `Cette commande dépasserait le plafond de crédit du client (impayé ${fmt(out)} / ${fmt(lim)} MAD).`,
            };
          if (out > 0)
            return {
              kind: "info",
              text: `Impayé à ce jour : ${fmt(out)} MAD sur ${fmt(lim)} MAD de plafond.`,
            };
          return null;
        })()
      : null;

  if (!open) return null;

  const submit = async () => {
    setError(null);
    if (!productId) return setError("Sélectionnez un produit.");
    const q = parseFloat(qty);
    if (!q || q <= 0) return setError("Quantité invalide.");
    if (!volume) return setError("Dimensions et quantité requises pour le volume.");

    if (mode === "transfer") {
      if (!toWarehouseId) return setError("Sélectionnez le dépôt de destination.");
      if (Number(toWarehouseId) === Number(defaultWarehouseId))
        return setError("Le dépôt source et la destination doivent différer.");
    } else if (!counterpartyId) {
      return setError(mode === "purchase" ? "Sélectionnez un fournisseur." : "Sélectionnez un client.");
    } else if (isNaN(price) || price <= 0) {
      return setError("Prix par m³ (MAD) invalide.");
    }

    setSubmitting(true);
    try {
      if (mode === "transfer") {
        const { data } = await api.post("/transfers/", {
          product_id: Number(productId),
          from_warehouse_id: Number(defaultWarehouseId),
          to_warehouse_id: Number(toWarehouseId),
          quantity: q,
        });
        onConfirm?.({ transfer: data });
      } else {
        const endpoint = mode === "purchase" ? "/purchases/" : "/sales/";
        const { data } = await api.post(endpoint, {
          supplier_id: mode === "purchase" ? Number(counterpartyId) : undefined,
          client_id: mode === "sale" ? Number(counterpartyId) : undefined,
          warehouse_id: Number(defaultWarehouseId),
          items: [
            {
              product_id: Number(productId),
              quantity: q,
              price_per_m3: price,
              thickness_mm: parseFloat(thickness),
              width_mm: parseFloat(width),
              length_mm: parseFloat(length),
              lot_number: lot || undefined,
            },
          ],
        });
        onConfirm?.({ order: data });
      }
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        Array.isArray(detail)
          ? detail.map((d) => (typeof d === "string" ? d : JSON.stringify(d))).join(" · ")
          : typeof detail === "string"
            ? detail
            : err.response?.data?.items?.[0]?.price_per_m3?.[0]
              || err.response?.data?.items?.[0]?.quantity?.[0]
              || err.message
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
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-panel shadow-2xl shadow-black/50 ring-1 ring-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line bg-raise px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-frost">
              {mode === "transfer" ? "Transfert de Stock" : "Calculateur de Bois (Live)"}
            </h2>
            <p className="text-xs text-dim">{MODES[mode].label}</p>
          </div>
          <button onClick={onClose} className="text-dim transition hover:text-frost" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
          <div>
            <label className={label}>
              Produit / Essence
            </label>
            <select
              value={productId}
              onChange={(e) => selectProduct(e.target.value)}
              className={input}
            >
              <option value="">— Sélectionner un produit —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.sku}
                </option>
              ))}
            </select>
          </div>

          {mode !== "transfer" && (
            <div>
              <label className={label}>
                {mode === "purchase" ? "Fournisseur" : "Client"}
              </label>
              <select
                value={counterpartyId}
                onChange={(e) => setCounterpartyId(e.target.value)}
                className={input}
              >
                <option value="">— Sélectionner —</option>
                {(mode === "purchase" ? suppliers : clients).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {creditWarning && (
            <p
              className={`rounded-lg px-3 py-2 text-xs font-medium ring-1 ${
                creditWarning.kind === "error"
                  ? "bg-rose/10 text-rose ring-rose/30"
                  : creditWarning.kind === "warn"
                    ? "bg-amber/10 text-amber ring-amber/30"
                    : "bg-skyx/10 text-skyx ring-skyx/30"
              }`}
            >
              {creditWarning.text}
            </p>
          )}

          {product && (
            <p className="rounded-lg bg-raise px-3 py-2 text-xs text-ash ring-1 ring-line">
              Volume unitaire : <strong className="text-frost">{fmt(product.volume_cubic_m, 6)} m³</strong> — entrez
              vos dimensions pour recalculer en direct.
            </p>
          )}

          <div className="grid grid-cols-4 gap-3">
            {[
              ["Épaisseur T (mm)", thickness, setThickness],
              ["Largeur W (mm)", width, setWidth],
              ["Longueur L (mm)", length, setLength],
              ["Quantité", qty, setQty],
            ].map(([l, val, setter]) => (
              <div key={l}>
                <label className={label}>
                  {l}
                </label>
                <input
                  type="number"
                  min="0"
                  value={val}
                  onChange={(e) => setter(e.target.value)}
                  className={input}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>
                Prix / m³ (MAD)
              </label>
              <input
                type="number"
                min="0"
                value={pricePerM3}
                onChange={(e) => setPricePerM3(e.target.value)}
                disabled={mode === "transfer"}
                className={input}
              />
            </div>
            <div>
              <label className={label}>
                N° Lot (optionnel)
              </label>
              <input
                type="text"
                value={lot}
                onChange={(e) => setLot(e.target.value)}
                disabled={mode === "transfer"}
                placeholder="LOT-2026-…"
                className={input}
              />
            </div>
          </div>

          {mode === "transfer" && (
            <div>
              <label className={label}>
                Dépôt de destination
              </label>
              <select
                value={toWarehouseId}
                onChange={(e) => setToWarehouseId(e.target.value)}
                className={input}
              >
                <option value="">— Sélectionner —</option>
                {warehouses
                  .filter((w) => w.id !== Number(defaultWarehouseId))
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Live calculator readout */}
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-raise p-4 ring-1 ring-line">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-dim">Volume</p>
              <p className="font-display text-xl font-bold text-jade">{fmt(volume, 4)} m³</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-dim">Prix / m³</p>
              <p className="font-display text-xl font-bold text-frost">
                {mode === "transfer" ? "—" : `${fmt(price)} MAD`}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-dim">Total</p>
              <p className="font-display text-xl font-bold text-amber">
                {mode === "transfer" ? "—" : `${fmt(displayedTotal)} MAD`}
              </p>
              {discountPercent > 0 && (
                <p className="text-[11px] font-semibold text-jade">
                  −{discountPercent}% · {pricing?.tier_name || "remise volume"}
                </p>
              )}
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
              {submitting ? "Envoi…" : MODES[mode].verb}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
