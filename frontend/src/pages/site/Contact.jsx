import { useEffect, useState } from "react";
import api from "../../api/client.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";

export default function Contact() {
  useDocumentTitle("Contact — KOUDI WOOD");
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get("/public/company/").then((r) => setCompany(r.data)).catch(() => {});
  }, []);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await api.post("/public/leads/", { kind: "contact", ...form });
      setDone(true);
    } catch (_) {
      setError("Impossible d'envoyer votre message. Réessayez ou appelez-nous directement.");
    } finally {
      setSending(false);
    }
  };

  const input =
    "w-full rounded-xl border border-line bg-panel px-4 py-2.5 text-sm text-frost outline-none transition placeholder:text-dim focus:border-amber/60 focus:ring-2 focus:ring-amber/20";
  const label = "mb-1 block text-xs font-semibold text-ash";

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 lg:px-6">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-frost">Contact</h1>
        <p className="mx-auto mt-2 max-w-xl text-ash">Une question, un projet ? Notre équipe vous répond.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        {/* Info */}
        <div className="lg:col-span-2">
          <div className="rounded-3xl bg-gradient-to-br from-amber to-copper p-8 text-ink shadow-xl shadow-amber/20">
            <h2 className="font-display text-2xl font-extrabold">{company?.name || "KOUDI WOOD"}</h2>
            <p className="mt-1 text-ink/80">{company?.tagline || "Vente de bois massifs & panneaux"}</p>
            <ul className="mt-6 space-y-4 text-sm">
              <li className="flex gap-3">
                <span aria-hidden>📍</span>
                <span>{company?.address || "Casablanca, Maroc"}</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden>☎</span>
                <a href={`tel:${company?.phone}`} className="underline-offset-2 hover:underline">{company?.phone || "—"}</a>
              </li>
              <li className="flex gap-3">
                <span aria-hidden>✉</span>
                <a href={`mailto:${company?.email}`} className="underline-offset-2 hover:underline">{company?.email || "—"}</a>
              </li>
              {company?.ice && (
                <li className="flex gap-3">
                  <span aria-hidden>➤</span>
                  <span>ICE : {company.ice}</span>
                </li>
              )}
              {company?.registre_commerce && (
                <li className="flex gap-3">
                  <span aria-hidden>➤</span>
                  <span>RC : {company.registre_commerce}</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-3">
          {done ? (
            <div className="rounded-3xl bg-panel p-10 text-center ring-1 ring-line">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-jade/20 text-3xl text-jade ring-1 ring-jade/30">✓</span>
              <p className="font-display mt-5 text-xl font-bold text-frost">Message bien reçu !</p>
              <p className="mt-2 text-sm text-ash">Nous revenons vers vous dans les plus brefs délais.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="rounded-3xl bg-panel p-6 shadow-xl shadow-black/5 ring-1 ring-line sm:p-8">
              {error && <div className="mb-5 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={label}>Nom complet *</label>
                  <input value={form.name} onChange={update("name")} required className={input} placeholder="Votre nom" />
                </div>
                <div>
                  <label className={label}>Email *</label>
                  <input type="email" value={form.email} onChange={update("email")} required className={input} placeholder="vous@exemple.com" />
                </div>
                <div>
                  <label className={label}>Téléphone</label>
                  <input value={form.phone} onChange={update("phone")} className={input} placeholder="06 XX XX XX XX" />
                </div>
                <div>
                  <label className={label}>Sujet</label>
                  <input value={form.subject} onChange={update("subject")} className={input} placeholder="Votre demande" />
                </div>
              </div>
              <div className="mt-4">
                <label className={label}>Message *</label>
                <textarea value={form.message} onChange={update("message")} required rows={5} className={input} placeholder="Votre message…" />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber to-copper px-6 py-3 text-sm font-bold text-ink shadow-xl shadow-amber/20 transition hover:brightness-110 disabled:opacity-60"
              >
                {sending ? "Envoi en cours…" : "Envoyer le message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
