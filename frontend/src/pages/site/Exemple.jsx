import { Link, useParams } from "react-router-dom";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { FAMILLES } from "../../site/familles.js";
import { PRODUITS_DETAIL } from "../../site/produits_detail.js";
import { downloadFiche } from "../../site/fiche.js";

const TECH_SECTIONS = [
  { key: "couleurs", label: "Couleurs" },
  { key: "epaisseurs", label: "Épaisseurs & formats" },
  { key: "humidite", label: "Humidité" },
  { key: "provenances", label: "Provenances" },
  { key: "sciage", label: "Sciage & aspect" },
  { key: "tracabilite", label: "Traçabilité & normes" },
  { key: "conseils", label: "Conseils de mise en œuvre" },
];

export default function Exemple() {
  const { famKey, index } = useParams();
  const fam = FAMILLES.find((f) => f.key === famKey);
  const idx = Number(index);
  const ex = fam?.examples?.[idx];
  const detail = ex ? PRODUITS_DETAIL[famKey]?.[ex.name] : null;
  useDocumentTitle(ex ? `${ex.name} — KOUDI WOOD` : "Produit — KOUDI WOOD");

  if (!fam || !ex) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center lg:px-6">
        <p className="text-4xl">🪵</p>
        <h1 className="font-display mt-3 text-2xl font-bold text-frost">Produit introuvable</h1>
        <p className="mt-1 text-sm text-ash">Ce produit n'existe pas ou n'est plus disponible.</p>
        <Link to="/produits" className="mt-6 inline-block rounded-lg bg-amber px-6 py-2.5 text-sm font-semibold text-ink shadow transition hover:brightness-110">
          ← Retour à la boutique
        </Link>
      </div>
    );
  }

  const techRows = TECH_SECTIONS.filter((s) => detail?.[s.key]);

  return (
    <div>
      {/* Banner */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: `url(${fam.image})` }} />
        <div className="relative mx-auto max-w-6xl px-4 py-10 lg:px-6">
          <Link to={`/gamme/${famKey}`} className="text-sm font-medium text-amber hover:underline">← {fam.label}</Link>
          <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-frost sm:text-4xl">{ex.name}</h1>
          <p className="mt-2 text-sm text-ash">{ex.essence}</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
          {/* Colonne gauche : informations sans cadre */}
          <div className="min-w-0">
            <p className="text-base leading-relaxed text-frost">{detail?.description || ex.description}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to={`/devis?nom=${encodeURIComponent(ex.name)}`}
                className="rounded-xl bg-gradient-to-r from-amber to-copper px-6 py-3 text-sm font-semibold text-ink shadow-xl shadow-amber/20 transition hover:brightness-110"
              >
                Ajouter au devis →
              </Link>
              <Link to="/contact" className="rounded-xl border border-line bg-panel px-6 py-3 text-sm font-semibold text-frost transition hover:bg-raise">
                Nous contacter
              </Link>
            </div>

            <div className="mt-10">
              {techRows.map((s, i) => (
                <section key={s.key} className="border-t border-line py-6 first:border-t-0 first:pt-0">
                  <h2 className="flex items-baseline gap-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-amber">
                    <span className="font-display text-lg font-bold tracking-normal text-frost">{String(i + 2).padStart(2, "0")}</span>
                    {s.label}
                  </h2>
                  <p className="mt-2.5 text-sm leading-relaxed text-ash">{detail[s.key]}</p>
                </section>
              ))}
            </div>
          </div>

          {/* Colonne droite : image + téléchargement de la fiche */}
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div className="overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
              <img src={ex.image} alt={ex.name} className="aspect-[4/3] w-full object-cover" />
            </div>
            <button
              onClick={() => downloadFiche({ fam, ex, detail })}
              className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-amber to-copper px-6 py-3 text-sm font-semibold text-ink shadow-xl shadow-amber/20 transition hover:brightness-110"
            >
              <span className="text-base leading-none">⬇</span>
              Télécharger la fiche produit
            </button>
            <p className="mt-2 text-center text-[11px] text-ash">
              Fiche PDF · {ex.name}
            </p>
          </aside>
        </div>

        {/* CTA devis */}
        <div className="mt-12 flex flex-col items-center gap-4 border-t border-line pt-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-display text-lg font-bold text-frost">{ex.name}</p>
            <p className="mt-1 text-sm text-ash">
              Ajoutez ce produit à votre demande pour recevoir un devis sur mesure.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
            <Link
              to={`/devis?nom=${encodeURIComponent(ex.name)}`}
              className="rounded-xl bg-gradient-to-r from-amber to-copper px-6 py-3 text-sm font-semibold text-ink shadow-xl shadow-amber/20 transition hover:brightness-110"
            >
              Ajouter au devis →
            </Link>
            <Link
              to={`/gamme/${famKey}`}
              className="rounded-xl border border-line bg-panel px-6 py-3 text-sm font-semibold text-frost transition hover:bg-raise"
            >
              Voir toute la gamme
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}