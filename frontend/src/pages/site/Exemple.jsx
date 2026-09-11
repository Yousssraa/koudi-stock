import { Link, useParams } from "react-router-dom";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { FAMILLES } from "../../site/familles.js";
import { PRODUITS_DETAIL } from "../../site/produits_detail.js";

const TECH_SECTIONS = [
  { key: "couleurs", label: "Couleurs", icon: "🎨" },
  { key: "epaisseurs", label: "Épaisseurs & formats", icon: "📐" },
  { key: "humidite", label: "Humidité", icon: "💧" },
  { key: "provenances", label: "Provenances", icon: "🌍" },
  { key: "sciage", label: "Sciage & aspect", icon: "🪚" },
  { key: "tracabilite", label: "Traçabilité & normes", icon: "🏷️" },
  { key: "conseils", label: "Conseils de mise en œuvre", icon: "💡" },
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
  const hasSummary = detail?.description || ex.description;

  return (
    <div>
      {/* Banner */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: `url(${fam.image})` }} />
        <div className="relative mx-auto max-w-6xl px-4 py-12 lg:px-6">
          <Link to={`/gamme/${famKey}`} className="text-sm font-medium text-amber hover:underline">← {fam.label}</Link>
          <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-frost sm:text-4xl">{ex.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-block rounded-full bg-amber/10 px-3 py-1 text-xs font-semibold text-amber ring-1 ring-amber/20">
              {ex.essence}
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
        {/* Fiche produit */}
        <div className="overflow-hidden rounded-2xl bg-panel shadow-xl shadow-black/10 ring-1 ring-line">
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
            <div className="relative h-56 lg:h-full lg:min-h-[320px]">
              <img src={ex.image} alt={ex.name} className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col p-6 lg:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber">{fam.label}</p>
              <h2 className="font-display mt-2 text-3xl font-extrabold text-frost">{ex.name}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-amber/10 px-3 py-1 text-xs font-semibold text-amber ring-1 ring-amber/20">
                  {ex.essence}
                </span>
              </div>
              {hasSummary && <p className="mt-4 text-sm leading-relaxed text-ash">{detail?.description || ex.description}</p>}
              {!hasSummary && <p className="mt-4 text-sm leading-relaxed text-ash">{ex.description}</p>}

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
            </div>
          </div>
        </div>

        {/* Sections techniques */}
        <div className="mt-12 grid grid-cols-1 gap-4">
          {techRows.map((s) => (
            <section key={s.key} className="rounded-2xl bg-panel p-5 ring-1 ring-line sm:p-6">
              <h3 className="flex items-center gap-2.5 font-display text-lg font-bold text-frost">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber/10 text-base ring-1 ring-amber/20">{s.icon}</span>
                {s.label}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ash">{detail[s.key]}</p>
            </section>
          ))}
        </div>

        {/* CTA devis */}
        <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl bg-panel p-6 text-center ring-1 ring-line sm:flex-row sm:justify-between sm:text-left">
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