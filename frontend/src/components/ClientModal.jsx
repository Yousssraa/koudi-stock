import { useEffect, useState } from "react";
import api from "../api/client.js";

const input =
  "w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none transition focus:border-amber/50 focus:ring-2 focus:ring-amber/20";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-dim";

const EMPTY = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  tax_id: "",
  payment_terms_days: "30",
  credit_limit: "0",
};

export default function ClientModal({ open, onClose, client, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(client ? { ...EMPTY, ...client } : { ...EMPTY });
    setError(null);
    setSubmitting(false);
  }, [open, client]);

  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setError(null);
    if (!form.company_name.trim()) return setError("Le nom du client est requis.");
    setSubmitting(true);
    try {
      const payload = {
        company_name: form.company_name.trim(),
        contact_name: form.contact_name?.trim() || "",
        email: form.email?.trim() || "",
        phone: form.phone?.trim() || "",
        address: form.address?.trim() || "",
        tax_id: form.tax_id?.trim() || "",
        payment_terms_days: Number(form.payment_terms_days) || 30,
        credit_limit: Number(form.credit_limit) || 0,
      };
      if (client) {
        await api.patch(`/clients/${client.id}/`, payload);
      } else {
        await api.post("/clients/", payload);
      }
      onSaved?.(client ? "modifié" : "créé");
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Échec de l'enregistrement du client.");
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
            <h2 className="font-display text-lg font-bold text-frost">
              {client ? "Modifier le client" : "Nouveau client"}
            </h2>
            <p className="text-xs text-dim">Client destinataire des bons de livraison.</p>
          </div>
          <button onClick={onClose} className="text-dim transition hover:text-frost" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
          <div>
            <label className={label}>Nom du client *</label>
            <input value={form.company_name || ""} onChange={set("company_name")} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Contact</label>
              <input value={form.contact_name || ""} onChange={set("contact_name")} className={input} />
            </div>
            <div>
              <label className={label}>Téléphone</label>
              <input value={form.phone || ""} onChange={set("phone")} className={input} />
            </div>
            <div>
              <label className={label}>Email</label>
              <input type="email" value={form.email || ""} onChange={set("email")} className={input} />
            </div>
            <div>
              <label className={label}>ICE / Taxe</label>
              <input value={form.tax_id || ""} onChange={set("tax_id")} className={input} />
            </div>
          </div>
          <div>
            <label className={label}>Adresse</label>
            <textarea value={form.address || ""} onChange={set("address")} rows={2} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Délai de paiement (j)</label>
              <input
                type="number"
                min="0"
                value={form.payment_terms_days ?? ""}
                onChange={set("payment_terms_days")}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Plafond de crédit (MAD)</label>
              <input
                type="number"
                min="0"
                value={form.credit_limit ?? ""}
                onChange={set("credit_limit")}
                className={input}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-rose/10 px-3 py-2 text-sm text-rose ring-1 ring-rose/30">{error}</p>
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
              {submitting ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
