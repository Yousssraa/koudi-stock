import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { FAMILLES } from "../../site/familles.js";
import { PRODUITS_DETAIL } from "../../site/produits_detail.js";
import { CARACTERISTIQUES } from "../../site/caracteristiques.js";
import { QUALITES_FORMATS } from "../../site/qualites_formats.js";
import { downloadFiche } from "../../site/fiche.js";

const BRAND_LINE = "KOUDI WOOD — Importateur & Distributeur de Bois et Matériaux de Construction";
const INSTAGRAM = "https://www.instagram.com/koudi_wood?stkn=eDZyanZxOTR4Nmtx";

const firstSentence = (text) => {
  if (!text) return "";
  const t = text.trim();
  const m = t.match(/^.*?[.!?](?=\s|$)/s);
  return (m && m[0].trim()) || t;
};

export default function Exemple() {
  const { famKey, index } = useParams();
  const fam = FAMILLES.find((f) => f.key === famKey);
  const idx = Number(index);
  const ex = fam?.examples?.[idx];
  const detail = ex ? PRODUITS_DETAIL[famKey]?.[ex.name] : null;
  const c = ex ? CARACTERISTIQUES[famKey]?.[ex.name] || {} : {};
  const qf = ex ? QUALITES_FORMATS[famKey]?.[ex.name] || {} : {};
  useDocumentTitle(ex ? `${ex.name} — KOUDI WOOD` : "Produit — KOUDI WOOD");

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [dims, setDims] = useState({ length: "", width: "", thickness: "" });

  if (!fam || !ex) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center lg:px-6">
        <p className="text-4xl">🪵</p>
        <h1 className="font-display mt-3 text-2xl font-bold text-frost">Produit introuvable</h1>
        <p className="mt-1 text-sm text-dim">Ce produit n'existe pas ou n'est plus disponible.</p>
        <Link to="/produits" className="mt-6 inline-block rounded-xl bg-gradient-to-r from-amber to-copper px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:brightness-110">
          ← Retour à la boutique
        </Link>
      </div>
    );
  }

  const facts = [
    { label: "Essence", value: c.essence || ex.essence },
    { label: "Provenance", value: firstSentence(detail?.provenances) },
    { label: "Densité", value: c.densite },
    { label: "Humidité", value: firstSentence(detail?.humidite) },
    { label: "Épaisseurs", value: firstSentence(detail?.epaisseurs) },
    { label: "Formats", value: firstSentence(qf.specif || detail?.sciage) },
  ].filter((f) => f.value);

  const description = ex.description || firstSentence(detail?.description);

  const L = parseFloat((dims.length || "").replace(",", "."));
  const W = parseFloat((dims.width || "").replace(",", "."));
  const E = parseFloat((dims.thickness || "").replace(",", "."));
  const hasDims = L > 0 && W > 0 && E > 0;
  const volume = hasDims ? (L * W * E) / 1e6 : 0;
  const qteText = volume
    ? `${volume.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m³`
    : "";

  const setDim = (k) => (e) => setDims((d) => ({ ...d, [k]: e.target.value }));
  const dimInput =
    "w-full rounded-lg border-0 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 outline-none ring-1 ring-gray-200 transition placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-amber";

  const btnBase = "flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-sm font-bold transition";
  const btnSecondary = `${btnBase} bg-white text-gray-800 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 hover:ring-gray-300`;
  const btnDark = `${btnBase} bg-gray-900 text-white shadow-md shadow-gray-900/10 hover:bg-gray-800`;
  const btnPrimary = `${btnBase} bg-gradient-to-r from-amber to-copper text-white shadow-xl shadow-amber/25 hover:brightness-110`;

  return (
    <div className="bg-white text-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
        <Link to={`/gamme/${famKey}`} className="inline-flex items-center gap-1 text-sm font-medium text-amber hover:underline">
          ← {fam.label}
        </Link>

        {/* Image à gauche + PDF dessous, infos courtes à droite (style Comarbois) */}
        <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[440px_minmax(0,1fr)] lg:gap-14">
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <figure className="overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200">
              <img src={ex.image} alt={ex.name} className="aspect-[4/3] w-full object-cover" />
            </figure>
            <div className="mt-4 space-y-3">
              <button onClick={() => downloadFiche({ fam, ex, detail, c, qf })} className={btnDark}>
                ⬇ Télécharger la fiche produit (PDF)
              </button>
              <a href={INSTAGRAM} target="_blank" rel="noreferrer" className={btnSecondary} title="Voir les réalisations sur Instagram">
                🖼 Inspirations {ex.name}
              </a>
            </div>
            <p className="mt-2.5 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-gray-400">
              Rendu d'ambiance · photo non contractuelle
            </p>
          </aside>

          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">{BRAND_LINE}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
              <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{ex.name}</h1>
              <span className="rounded-full bg-amber/10 px-3 py-1 text-xs font-semibold text-amber ring-1 ring-amber/25">
                {c.essence || ex.essence}
              </span>
            </div>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-700">{description}</p>

            <dl className="mt-7 grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-xs font-bold uppercase tracking-wider text-gray-500">{f.label}</dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900">{f.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <button onClick={() => setQuoteOpen(true)} className={`${btnPrimary} !w-auto px-8`}>
                Demander un devis · Calculer le volume (m³) →
              </button>
              <Link to="/contact" className={`${btnSecondary} !w-auto px-6`}>
                Nous contacter
              </Link>
            </div>
            <p className="mt-3 text-xs text-gray-400">Devis gratuit, sans engagement — réponse sous 24 h ouvrées.</p>
          </div>
        </div>
      </div>

      {/* Chiffrage express */}
      {quoteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setQuoteOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Chiffrage express"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber">Chiffrage express B2B</p>
                <h2 className="font-display mt-1 text-lg font-bold text-gray-900">{ex.name}</h2>
              </div>
              <button
                onClick={() => setQuoteOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:bg-rose/10 hover:text-rose"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              Renseignez les dimensions pour estimer le volume en m³, puis envoyez votre demande de devis.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-500">Longueur (m)</label>
                <input value={dims.length} onChange={setDim("length")} inputMode="decimal" placeholder="2,00" className={dimInput} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-500">Largeur (mm)</label>
                <input value={dims.width} onChange={setDim("width")} inputMode="decimal" placeholder="150" className={dimInput} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-500">Épaisseur (mm)</label>
                <input value={dims.thickness} onChange={setDim("thickness")} inputMode="decimal" placeholder="18" className={dimInput} />
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-amber/5 px-4 py-3 ring-1 ring-amber/15">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Volume estimé</p>
              <p className={`font-display text-2xl font-bold ${hasDims ? "text-gray-900" : "text-gray-400"}`}>
                {hasDims ? `≈ ${qteText}` : "— m³"}
              </p>
            </div>

            {!hasDims && <p className="mt-2 text-xs text-gray-400">Renseignez les trois dimensions pour calculer le volume.</p>}

            <div className="mt-5 grid grid-cols-1 gap-3">
              <Link
                to={`/devis?nom=${encodeURIComponent(ex.name)}&qte=${encodeURIComponent(qteText)}`}
                onClick={() => setQuoteOpen(false)}
                className={`${btnPrimary} ${hasDims ? "" : "pointer-events-none opacity-40"}`}
                aria-disabled={!hasDims}
              >
                Valider et demander le devis →
              </Link>
              <Link
                to={`/devis?nom=${encodeURIComponent(ex.name)}`}
                onClick={() => setQuoteOpen(false)}
                className="text-center text-sm font-semibold text-amber hover:underline"
              >
                Passer la quantité · formulaire simple →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}