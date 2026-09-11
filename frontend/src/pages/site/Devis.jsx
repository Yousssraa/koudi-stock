import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/client.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";

const EMPTY_LINE = { name: "", quantity: "" };

export default function Devis() {
  useDocumentTitle("Devis — KOUDI WOOD");
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    city: "",
    message: "",
  });
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sku = params.get("sku");
    const noms = params.getAll("nom");
    const filled = noms.filter((n) => n.trim());
    if (sku || filled.length) {
      setLines(filled.length ? filled.map((n) => ({ name: n, quantity: "" })) : [{ name: sku, quantity: "" }]);
    }
  }, [params]);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const updateLine = (i, k) => (e) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: e.target.value } : l)));
  const addLine = () => setLines((ls) => [...ls, { ...EMPTY_LINE }]);
  const removeLine = (i) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const filledLines = lines.filter((l) => l.name.trim()).map((l) => ({ name: l.name.trim(), quantity: l.quantity.trim() }));
    if (filledLines.length === 0) {
      setError("Indiquez au moins un produit dans votre demande.");
      return;
    }
    setSending(true);
    try {
      await api.post("/public/leads/", {
        kind: "devis",
        ...form,
        requested_lines: filledLines,
      });
      setDone(true);
    } catch (err) {
      setError(
        "Impossible d'envoyer votre demande. Vérifiez votre email puis réessayez, ou contactez-nous directement."
      );
    } finally {
      setSending(false);
    }
  };

  const input =
    "w-full rounded-xl border border-line bg-panel px-4 py-2.5 text-sm text-frost outline-none transition placeholder:text-dim focus:border-amber/60 focus:ring-2 focus:ring-amber/20";
  const label = "mb-1 block text-xs font-semibold text-ash";

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center lg:px-6">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-jade/20 text-3xl text-jade ring-1 ring-jade/30">✓</span>
        <h1 className="font-display mt-6 text-3xl font-extrabold text-frost">Demande envoyée !</h1>
        <p className="mt-3 text-ash">
          Merci {form.name}. Notre équipe étudie votre devis et vous recontacte rapidement par email ou téléphone.
        </p>
        <button
          onClick={() => {
            setDone(false);
            setForm({ name: "", company: "", email: "", phone: "", city: "", message: "" });
            setLines([{ ...EMPTY_LINE }]);
          }}
          className="mt-8 rounded-xl border border-line bg-panel px-6 py-3 text-sm font-semibold text-frost transition hover:bg-raise"
        >
          Nouvelle demande
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 lg:px-6">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-frost">Demande de devis</h1>
        <p className="mx-auto mt-2 max-w-xl text-ash">
          Renseignez vos produits et quantités souhaitées. Nous vous répondons avec un devis sur mesure, sans engagement.
        </p>
      </div>

      <form onSubmit={submit} className="rounded-3xl bg-panel p-6 shadow-xl shadow-black/5 ring-1 ring-line sm:p-8">
        {error && <div className="mb-5 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Nom complet *</label>
            <input value={form.name} onChange={update("name")} required className={input} placeholder="Votre nom" />
          </div>
          <div>
            <label className={label}>Société</label>
            <input value={form.company} onChange={update("company")} className={input} placeholder="Nom de l'entreprise" />
          </div>
          <div>
            <label className={label}>Email *</label>
            <input type="email" value={form.email} onChange={update("email")} required className={input} placeholder="vous@exemple.com" />
          </div>
          <div>
            <label className={label}>Téléphone</label>
            <input value={form.phone} onChange={update("phone")} className={input} placeholder="06 XX XX XX XX" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Ville</label>
            <input value={form.city} onChange={update("city")} className={input} placeholder="Casablanca…" />
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-frost">Produits souhaités</p>
          <div className="space-y-3">
            {lines.map((line, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex-1">
                  <label className={label}>Produit / référence</label>
                  <input value={line.name} onChange={updateLine(i, "name")} className={input} placeholder="Ex : Contreplaqué 18 mm" />
                </div>
                <div className="w-40">
                  <label className={label}>Quantité</label>
                  <input value={line.quantity} onChange={updateLine(i, "quantity")} className={input} placeholder="ex : 5 m³" />
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="mt-6 flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ash transition hover:bg-rose/10 hover:text-rose"
                  title="Retirer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addLine}
            className="mt-3 text-sm font-semibold text-amber hover:underline"
          >
            + Ajouter un produit
          </button>
        </div>

        <div className="mt-6">
          <label className={label}>Message / précisions</label>
          <textarea
            value={form.message}
            onChange={update("message")}
            rows={4}
            className={input}
            placeholder="Dimensions, essences, délais, lieu de livraison…"
          />
        </div>

        <button
          type="submit"
          disabled={sending}
          className="mt-7 w-full rounded-xl bg-gradient-to-r from-amber to-copper px-6 py-3 text-sm font-bold text-ink shadow-xl shadow-amber/20 transition hover:brightness-110 disabled:opacity-60"
        >
          {sending ? "Envoi en cours…" : "Envoyer ma demande de devis"}
        </button>
      </form>
    </div>
  );
}
