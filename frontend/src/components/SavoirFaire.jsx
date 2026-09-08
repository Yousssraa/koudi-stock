import { SAVOIR_FAIRE } from "../site/savoirFaire.js";

// Les courtes phrases disposées autour de l'emblème « NOTRE SAVOIR-FAIRE »,
// à la manière des anecdotes du site Comarbois.
const PHRASES = [
  "Bien comprendre le bois & ses propriétés",
  "Des solutions pour tous les budgets",
  "Les meilleures marques sur le marché",
  "Des tarifs ultra compétitifs",
  "Choisir le bois adéquat",
  "Un service professionnel & personnalisé",
  "Le meilleur rapport qualité/prix",
  "Un suivi jusqu'au bout de vos projets",
];

// Positionnement des 8 phrases autour du cercle (8 points de la boussole).
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

// « Notre savoir-faire » — un emblème central entouré de courtes phrases
// disposées en cercle, à la manière du site Comarbois.
export default function SavoirFaire() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
      {/* Emblème central + courtes phrases autour */}
      <div className="relative mx-auto aspect-square w-full max-w-[720px]">
        {/* Emblème central */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="rounded-full border border-amber/30 bg-ink/60 p-[2px] shadow-2xl shadow-black/30">
            <div className="flex h-44 w-44 flex-col items-center justify-center rounded-full border-4 border-amber/40 bg-gradient-to-br from-panel to-raise px-5 text-center sm:h-56 sm:w-56">
              <span className="font-display text-4xl text-amber sm:text-5xl" aria-hidden>
                🪵
              </span>
              <h2 className="font-display mt-2 text-lg font-extrabold uppercase leading-tight tracking-tight text-frost sm:text-xl">
                {SAVOIR_FAIRE.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Courtes phrases en cercle autour de l'emblème */}
        {PHRASES.map((phrase, i) => {
          const angle = (ANGLES[i] * Math.PI) / 180;
          const r = 50;
          const x = 50 + r * Math.sin(angle);
          const y = 50 - r * Math.cos(angle);
          const left = `${x}%`;
          const top = `${y}%`;
          const flip = angle > Math.PI / 2 && angle < (3 * Math.PI) / 2;
          return (
            <div
              key={phrase}
              className="absolute z-0 hidden -translate-x-1/2 -translate-y-1/2 md:block"
              style={{ left, top }}
            >
              <span
                className={`inline-block max-w-[190px] rounded-xl border border-line bg-panel/90 px-3.5 py-2 text-center text-[13px] font-semibold leading-snug text-frost shadow-lg shadow-black/10 backdrop-blur transition hover:border-amber/40 hover:text-amber ${
                  flip ? "translate-x-2" : "-translate-x-2"
                }`}
              >
                {phrase}
              </span>
            </div>
          );
        })}
      </div>

      {/* Version empilée sur mobile et tablette */}
      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
        {PHRASES.map((phrase) => (
          <div
            key={phrase}
            className="rounded-xl border border-line bg-panel px-4 py-3 text-center text-sm font-semibold text-frost"
          >
            {phrase}
          </div>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-ash">
        {SAVOIR_FAIRE.subtitle}
      </p>
    </section>
  );
}
