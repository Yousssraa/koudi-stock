import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import { useToast } from "../components/ToastContext.jsx";
import useDocumentTitle from "../hooks/useDocumentTitle.jsx";
import Skeleton from "../components/Skeleton.jsx";

const input =
  "w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none transition focus:border-amber/50 focus:ring-2 focus:ring-amber/20";
const label = "mb-1 block text-xs font-semibold text-dim";

const EMPTY = {
  name: "",
  tagline: "",
  address: "",
  phone: "",
  email: "",
  ice: "",
  registre_commerce: "",
  identifiant_fiscal: "",
  patente: "",
  cnss: "",
  bank_name: "",
  bank_rib: "",
};

export default function Settings() {
  const toast = useToast();
  useDocumentTitle("Paramètres de la société");

  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get("/company/")
      .then((res) => setForm({ ...EMPTY, ...res.data }))
      .catch((err) => {
        setError(err.response?.data?.detail || err.message || "Impossible de charger la fiche société.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/company/", form);
      toast.success("Fiche société enregistrée. Apparaîtra sur les prochains documents.");
    } catch (err) {
      const d = err.response?.data;
      toast.error((d && (d.detail || Object.values(d).flat().join(" "))) || "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-frost">Paramètres de la société</h1>
        <p className="text-sm text-ash">
          Identité imprimée sur vos factures, devis et bons de commande. Les champs vides sont simplement omis
          des documents.
        </p>
      </header>

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

      <form onSubmit={submit} className="space-y-6">
        <section className="rounded-2xl bg-panel p-6 shadow-lg shadow-black/20 ring-1 ring-line">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-amber">Identité</h2>
          <div className="space-y-4">
            <div>
              <label className={label}>Nom de la société</label>
              <input value={form.name || ""} onChange={set("name")} className={input} placeholder="KOUDI STOCK" />
            </div>
            <div>
              <label className={label}>Slogan</label>
              <input
                value={form.tagline || ""}
                onChange={set("tagline")}
                className={input}
                placeholder="Vente & Gestion de Stock du Bois"
              />
            </div>
            <div>
              <label className={label}>Adresse</label>
              <textarea value={form.address || ""} onChange={set("address")} rows={2} className={input} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Téléphone</label>
                <input value={form.phone || ""} onChange={set("phone")} className={input} />
              </div>
              <div>
                <label className={label}>Email</label>
                <input type="email" value={form.email || ""} onChange={set("email")} className={input} />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-panel p-6 shadow-lg shadow-black/20 ring-1 ring-line">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-amber">Informations légales</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>ICE</label>
              <input value={form.ice || ""} onChange={set("ice")} className={input} />
            </div>
            <div>
              <label className={label}>RC (Registre de commerce)</label>
              <input value={form.registre_commerce || ""} onChange={set("registre_commerce")} className={input} />
            </div>
            <div>
              <label className={label}>Identifiant fiscal</label>
              <input value={form.identifiant_fiscal || ""} onChange={set("identifiant_fiscal")} className={input} />
            </div>
            <div>
              <label className={label}>Patente</label>
              <input value={form.patente || ""} onChange={set("patente")} className={input} />
            </div>
            <div>
              <label className={label}>CNSS</label>
              <input value={form.cnss || ""} onChange={set("cnss")} className={input} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-panel p-6 shadow-lg shadow-black/20 ring-1 ring-line">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-amber">Coordonnées bancaires</h2>
          <p className="mb-4 text-xs text-dim">
            Le RIB apparaîtra sur les factures pour le virement (paiement à 30 jours).
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>Banque</label>
              <input value={form.bank_name || ""} onChange={set("bank_name")} className={input} />
            </div>
            <div>
              <label className={label}>RIB</label>
              <input
                value={form.bank_rib || ""}
                onChange={set("bank_rib")}
                className={input}
                placeholder="24 chiffres sans espaces"
              />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={load}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ash transition hover:bg-raise"
          >
            Réinitialiser
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gradient-to-r from-amber to-copper px-5 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
