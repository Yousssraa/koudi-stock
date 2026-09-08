import { useState } from "react";
import { Link } from "react-router-dom";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import Reveal from "../../site/Reveal.jsx";

const KEYWORDS = [
  { label: "AMBITION" },
  { label: "PERFORMANCE" },
  { label: "FUTUR" },
];

const DEPARTMENTS = [
  "Achats & logistique",
  "Commercial",
  "Financier",
  "Import & transit",
  "Marketing",
  "Ressources humaines",
  "Système d'information",
  "Autre",
];

const INPUT =
  "w-full rounded-xl border border-line bg-raise/60 px-4 py-2.5 text-sm text-frost outline-none transition placeholder:text-dim focus:border-amber/60 focus:ring-2 focus:ring-amber/20";

export default function Equipe() {
  useDocumentTitle("Notre Équipe — KOUDI WOOD");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    cv: null,
    motivation: null,
    message: "",
    accept: false,
  });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.message) {
      setError("Merci de remplir tous les champs obligatoires.");
      return;
    }
    if (!form.accept) {
      setError("Veuillez accepter les conditions générales d'utilisation.");
      return;
    }
    setError("");
    setSent(true);
  };

  return (
    <div>
      {/* BANNER / BREADCRUMB */}
      <section
        className="relative flex min-h-[38vh] items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: "url(/wood/noyer.jpg)", backgroundColor: "#5c1420" }}
      >
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            KOUDI WOOD · Casablanca
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Notre Équipe
          </h1>
          <p className="mt-3 text-sm font-medium uppercase tracking-wide text-white/85">
            Plus qu'un job, une carrière
          </p>
          <nav className="mt-5 flex items-center justify-center gap-2 text-sm text-white/90">
            <Link to="/" className="transition hover:text-amber">Accueil</Link>
            <span aria-hidden className="text-white/50">›</span>
            <span>Notre Équipe</span>
          </nav>
        </div>
      </section>

      {/* KEYWORDS */}
      <Reveal>
        <section className="mx-auto max-w-5xl px-4 pt-14 lg:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {KEYWORDS.map((k) => (
              <div
                key={k.label}
                className="rounded-2xl border-b-4 border-amber bg-panel p-6 text-center ring-1 ring-line"
              >
                <p className="font-display text-xl font-extrabold uppercase tracking-[0.2em] text-frost">
                  {k.label}
                </p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* TEAM TEXT */}
      <Reveal>
        <section className="mx-auto max-w-3xl px-4 pt-14 text-center lg:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight text-frost sm:text-3xl">
            <span className="border-b-4 border-amber pb-1">REJOIGNEZ NOTRE ÉQUIPE</span>
          </h2>
          <p className="mt-6 text-justify text-sm leading-relaxed text-ash">
            Notre équipe représente le capital le plus important de KOUDI WOOD. Nos
            collaborateurs sont porteurs du savoir-faire, transmis de générations en
            générations, qui a contribué au bon développement de notre entreprise. Afin de
            toujours rester une équipe compétente et dynamique, nous investissons de manière
            régulière dans la formation et le perfectionnement de nos ressources humaines.
          </p>
          <p className="mt-4 text-justify text-sm leading-relaxed text-ash">
            N'hésitez pas à tenter votre chance en remplissant le formulaire ci-dessous !
          </p>
        </section>
      </Reveal>

      {/* APPLICATION FORM */}
      <Reveal>
        <section className="mx-auto max-w-3xl px-4 py-14 lg:px-6">
          <div className="overflow-hidden rounded-3xl bg-panel p-6 ring-1 ring-line sm:p-8">
            {sent ? (
              <div className="py-10 text-center">
                <p className="text-4xl">✅</p>
                <h3 className="font-display mt-3 text-xl font-bold text-frost">
                  Candidature envoyée !
                </h3>
                <p className="mt-2 text-sm text-ash">
                  Merci pour votre intérêt. Notre équipe des ressources humaines étudiera votre
                  dossier et reviendra vers vous rapidement.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-frost">
                      Votre nom <span className="text-rose">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      className={INPUT}
                      placeholder="Nom et prénom"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-frost">
                      Votre email <span className="text-rose">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      className={INPUT}
                      placeholder="vous@exemple.com"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-frost">
                    Votre téléphone <span className="text-rose">*</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    className={INPUT}
                    placeholder="+212 6 00 00 00 00"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="department" className="mb-1.5 block text-sm font-semibold text-frost">
                    Choix département(s)
                  </label>
                  <select
                    id="department"
                    className={INPUT}
                    value={form.department}
                    onChange={(e) => set("department", e.target.value)}
                  >
                    <option value="">— Sélectionner —</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="cv" className="mb-1.5 block text-sm font-semibold text-frost">
                      Votre CV <span className="text-rose">*</span>
                    </label>
                    <input
                      id="cv"
                      type="file"
                      accept=".pdf"
                      className={`${INPUT} file:mr-3 file:rounded-lg file:border-0 file:bg-amber/10 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-amber`}
                      onChange={(e) => set("cv", e.target.files?.[0] || null)}
                    />
                    <p className="mt-1 text-xs text-dim">Format PDF uniquement.</p>
                  </div>
                  <div>
                    <label htmlFor="motivation" className="mb-1.5 block text-sm font-semibold text-frost">
                      Votre lettre de motivation <span className="text-rose">*</span>
                    </label>
                    <input
                      id="motivation"
                      type="file"
                      accept=".pdf"
                      className={`${INPUT} file:mr-3 file:rounded-lg file:border-0 file:bg-amber/10 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-amber`}
                      onChange={(e) => set("motivation", e.target.files?.[0] || null)}
                    />
                    <p className="mt-1 text-xs text-dim">Format PDF uniquement.</p>
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="mb-1.5 block text-sm font-semibold text-frost">
                    Votre message <span className="text-rose">*</span>
                  </label>
                  <textarea
                    id="message"
                    rows={4}
                    className={INPUT}
                    placeholder="Parlez-nous de vous, de votre parcours et de vos motivations…"
                    value={form.message}
                    onChange={(e) => set("message", e.target.value)}
                  />
                </div>

                <label className="flex items-start gap-2 text-sm text-ash">
                  <input
                    type="checkbox"
                    checked={form.accept}
                    onChange={(e) => set("accept", e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-line text-amber accent-amber"
                  />
                  <span>
                    J'ai lu et j'accepte les conditions générales d'utilisation.
                  </span>
                </label>

                {error && (
                  <p className="rounded-lg bg-rose/10 px-4 py-2 text-sm font-medium text-rose ring-1 ring-rose/20">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-amber to-copper px-6 py-3 text-sm font-bold text-ink shadow-xl shadow-amber/20 transition hover:brightness-110"
                >
                  Envoyer ma candidature →
                </button>
              </form>
            )}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
