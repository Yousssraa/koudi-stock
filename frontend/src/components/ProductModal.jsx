import { useEffect, useMemo, useState } from "react";
import api from "../api/client.js";
import { useToast } from "./ToastContext.jsx";

const CATEGORIES = ["Bois rouge", "Bois blanc", "Bois exotique", "Bois noble", "Panneaux", "Coffrage"];
const GRADES = ["FAS", "Cabinet grade", "Select", "Standard", "Construction"];
const FINISHES = ["rough-sawn", "planed", "poutre", "kiln-dried", "sanded"];

const EMPTY = {
  sku: "",
  name: "",
  wood_type_id: "",
  category: "Bois blanc",
  grade: "FAS",
  finish: "planed",
  thickness_mm: "",
  width_mm: "",
  length_mm: "",
  moisture_content: "",
  uom: "cbm",
  cost_price: "",
  sale_price: "",
  currency: "MAD",
  min_stock_qty: 0,
  reorder_threshold_m3: "",
};

const input =
  "w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none transition focus:border-amber/50 focus:ring-2 focus:ring-amber/20";
const label = "mb-1 block text-xs font-semibold text-dim";

export default function ProductModal({ open, onClose, onSaved, product }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [woodTypes, setWoodTypes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    api
      .get("/wood-types/")
      .then((r) => setWoodTypes(r.data.results || r.data))
      .catch(() => {
        setWoodTypes([]);
        toast.error("Impossible de charger les essences.");
      });
    if (product) {
      setForm({
        sku: product.sku || "",
        name: product.name || "",
        wood_type_id: product.wood_type?.id || "",
        category: product.category || "Bois blanc",
        grade: product.grade || "FAS",
        finish: product.finish || "planed",
        thickness_mm: product.thickness_mm ?? "",
        width_mm: product.width_mm ?? "",
        length_mm: product.length_mm ?? "",
        moisture_content: product.moisture_content ?? "",
        uom: product.uom || "cbm",
        cost_price: product.cost_price ?? "",
        sale_price: product.sale_price ?? "",
        currency: product.currency || "MAD",
        min_stock_qty: product.min_stock_qty ?? 0,
        reorder_threshold_m3: product.reorder_threshold_m3 ?? "",
      });
    } else {
      setForm(EMPTY);
    }
    setError(null);
  }, [open, product]);

  const volumePreview = useMemo(() => {
    const t = Number(form.thickness_mm);
    const w = Number(form.width_mm);
    const l = Number(form.length_mm);
    if (![t, w, l].every((v) => Number.isFinite(v) && v > 0)) return null;
    return (t * w * l) / 1_000_000_000;
  }, [form.thickness_mm, form.width_mm, form.length_mm]);

  if (!open) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, wood_type_id: form.wood_type_id || null };
      if (product) await api.patch(`/products/${product.id}/`, payload);
      else await api.post("/products/", payload);
      setForm(EMPTY);
      onSaved();
      onClose();
    } catch (err) {
      const d = err.response?.data;
      setError((d && (d.detail || Object.values(d).flat().join(" "))) || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-panel shadow-xl shadow-black/40 ring-1 ring-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-panel px-6 py-4">
          <h2 className="font-display text-lg font-bold text-frost">
            {product ? "Modifier le Produit" : "Nouveau Produit Bois"}
          </h2>
          <button onClick={onClose} className="text-dim transition hover:text-frost" aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 px-6 py-6">
          {error && (
            <div className="rounded-lg bg-rose/10 px-4 py-3 text-sm text-rose ring-1 ring-rose/30">{error}</div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>SKU *</label>
              <input className={input} value={form.sku} onChange={set("sku")} required placeholder="PR-063-175-4000" />
            </div>
            <div>
              <label className={label}>Nom du Produit *</label>
              <input className={input} value={form.name} onChange={set("name")} required placeholder="Chevron Pin 63x175x4000" />
            </div>
            <div>
              <label className={label}>Essence</label>
              <select className={input} value={form.wood_type_id} onChange={set("wood_type_id")}>
                <option value="">— sélectionner —</option>
                {woodTypes.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Catégorie</label>
              <select className={input} value={form.category} onChange={set("category")}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Qualité / Grade</label>
              <select className={input} value={form.grade} onChange={set("grade")}>
                {GRADES.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Surface</label>
              <select className={input} value={form.finish} onChange={set("finish")}>
                {FINISHES.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dim">
              Dimensions (mm) — le volume est calculé automatiquement
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={label}>Épaisseur</label>
                <input type="number" min="0" step="0.01" className={input} value={form.thickness_mm} onChange={set("thickness_mm")} placeholder="30" />
              </div>
              <div>
                <label className={label}>Largeur</label>
                <input type="number" min="0" step="0.01" className={input} value={form.width_mm} onChange={set("width_mm")} placeholder="140" />
              </div>
              <div>
                <label className={label}>Longueur</label>
                <input type="number" min="0" step="0.01" className={input} value={form.length_mm} onChange={set("length_mm")} placeholder="3000" />
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-raise px-4 py-2.5 text-sm text-ash ring-1 ring-line">
              Volume calculé :{" "}
              <span className="font-bold text-amber">
                {volumePreview !== null ? `${volumePreview.toFixed(6)} m³ / unité` : "entrez les dimensions"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={label}>Humidité %</label>
              <input type="number" min="0" max="100" step="0.1" className={input} value={form.moisture_content} onChange={set("moisture_content")} placeholder="12" />
            </div>
            <div>
              <label className={label}>Unité</label>
              <select className={input} value={form.uom} onChange={set("uom")}>
                <option value="cbm">cbm</option>
                <option value="piece">piece</option>
                <option value="m2">m²</option>
                <option value="linear_m">linear m</option>
                <option value="ton">ton</option>
              </select>
            </div>
            <div>
              <label className={label}>Stock Min.</label>
              <input type="number" min="0" step="0.0001" className={input} value={form.min_stock_qty} onChange={set("min_stock_qty")} />
            </div>
          </div>

          <div className="rounded-lg bg-raise/60 px-4 py-3 ring-1 ring-line">
            <label className={label}>Seuil de réapprovisionnement (m³)</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.0001"
                className={`${input} max-w-[180px]`}
                value={form.reorder_threshold_m3}
                onChange={set("reorder_threshold_m3")}
                placeholder="ex. 5.2"
              />
              <span className="text-xs text-dim">
                L'alerte "stock bas" se déclenche quand le volume total en dépôt passe sous cette valeur.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Prix Coût / m³ (MAD)</label>
              <input type="number" min="0" step="0.01" className={input} value={form.cost_price} onChange={set("cost_price")} />
            </div>
            <div>
              <label className={label}>Prix Vente / m³ (MAD)</label>
              <input type="number" min="0" step="0.01" className={input} value={form.sale_price} onChange={set("sale_price")} />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-line pt-4">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ash transition hover:bg-raise">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-gradient-to-r from-amber to-copper px-5 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110 disabled:opacity-50">
              {saving ? "Enregistrement…" : product ? "Mettre à jour" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
