import { useEffect, useState } from "react";
import proApi from "../../api/proClient.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import Skeleton from "../../components/Skeleton.jsx";

export default function ProProfile() {
  useDocumentTitle("Espace Pro — Profil");
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    proApi
      .get("/pro/profile/")
      .then(({ data }) =>
        setForm({
          company_name: data.company_name || "",
          contact_name: data.contact_name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          tax_id: data.tax_id || "",
        })
      )
      .catch((err) =>
        setError(err.response?.data?.detail || "Impossible de charger le profil.")
      );
  }, []);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await proApi.patch("/pro/profile/", form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Impossible d'enregistrer les modifications.");
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  const input =
    "w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none placeholder:text-dim focus:border-amber/60 focus:ring-2 focus:ring-amber/20";
  const label = "mb-1 block text-xs font-semibold text-ash";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-frost">Profil</h1>
        <p className="mt-1 text-sm text-ash">
          Mettez à jour les coordonnées de votre entreprise.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose/10 px-5 py-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>
      )}
      {saved && (
        <div className="rounded-2xl bg-jade/10 px-5 py-4 text-sm text-jade ring-1 ring-jade/30">
          ✓ Informations enregistrées avec succès.
        </div>
      )}

      <form
        onSubmit={submit}
        className="rounded-2xl bg-panel p-6 shadow-lg shadow-black/20 ring-1 ring-line"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Société</label>
            <input value={form.company_name} onChange={update("company_name")} required className={input} />
          </div>
          <div>
            <label className={label}>Contact</label>
            <input value={form.contact_name} onChange={update("contact_name")} className={input} />
          </div>
          <div>
            <label className={label}>Téléphone</label>
            <input value={form.phone} onChange={update("phone")} className={input} />
          </div>
          <div>
            <label className={label}>Email</label>
            <input type="email" value={form.email} onChange={update("email")} className={input} />
          </div>
          <div>
            <label className={label}>Identifiant fiscal</label>
            <input value={form.tax_id} onChange={update("tax_id")} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Adresse</label>
            <textarea
              value={form.address}
              onChange={update("address")}
              rows={2}
              className={input}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-6 rounded-lg bg-gradient-to-r from-amber to-copper px-5 py-2.5 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>

      <p className="text-center text-xs text-dim">
        Vos conditions commerciales (délais, plafond de crédit) sont gérées par notre équipe.
      </p>
    </div>
  );
}