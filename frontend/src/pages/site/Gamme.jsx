import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { FAMILLES } from "../../site/familles.js";

export default function Gamme() {
  const { key } = useParams();
  const fam = FAMILLES.find((f) => f.key === key);
  useDocumentTitle(fam ? `${fam.label} — KOUDI WOOD` : "Gamme — KOUDI WOOD");
  const [selected, setSelected] = useState([]);

  const toggle = (name) =>
    setSelected((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]));

  if (!fam) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center lg:px-6">
        <p className="text-4xl">🪵</p>
        <h1 className="font-display mt-3 text-2xl font-bold text-frost">Gamme introuvable</h1>
        <p className="mt-1 text-sm text-ash">Cette gamme de produits n'existe pas ou n'est plus disponible.</p>
        <Link to="/produits" className="mt-6 inline-block rounded-lg bg-amber px-6 py-2.5 text-sm font-semibold text-ink shadow transition hover:brightness-110">
          ← Retour à la boutique
        </Link>
      </div>
    );
  }

  const devisUrl =
    selected.length === 0
      ? "/devis"
      : `/devis?${selected.map((n) => `nom=${encodeURIComponent(n)}`).join("&")}`;

  return (
    <div>
      {/* Banner */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: `url(${fam.image})` }} />
        <div className="relative mx-auto max-w-6xl px-4 py-12 lg:px-6">
          <Link to="/produits" className="text-sm font-medium text-amber hover:underline">← Boutique</Link>
          <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-frost sm:text-4xl">{fam.label}</h1>
          <p className="mt-2 text-sm text-ash">{fam.description}</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-frost">Produits de la gamme</h2>
            <p className="mt-1 text-sm text-ash">
              Ajoutez les produits qui vous intéressent à votre demande de devis.
            </p>
          </div>
          <span className="rounded-full bg-amber/10 px-3 py-1 text-xs font-semibold text-amber ring-1 ring-amber/20">
            {fam.examples.length} produits
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fam.examples.map((ex, i) => {
            const added = selected.includes(ex.name);
            const detailUrl = `/gamme/${key}/${i}`;
            return (
              <div key={ex.name} className="group flex flex-col overflow-hidden rounded-2xl bg-panel ring-1 ring-line transition hover:shadow-lg hover:shadow-black/5">
                <Link to={detailUrl} className="relative block h-44 overflow-hidden">
                  <img src={ex.image} alt={ex.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                </Link>
                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <Link to={detailUrl} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber hover:text-copper">
                    {ex.essence}
                  </Link>
                  <Link to={detailUrl} className="font-display mt-1.5 text-base font-bold text-frost hover:text-amber">
                    {ex.name}
                  </Link>
                  <Link to={detailUrl} className="mt-1.5 text-xs leading-relaxed text-ash hover:text-ash">
                    {ex.description}
                  </Link>
                  <button
                    onClick={() => toggle(ex.name)}
                    className={`mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      added
                        ? "bg-jade/15 text-jade ring-1 ring-jade/40 hover:bg-jade/25"
                        : "bg-gradient-to-r from-amber to-copper text-ink shadow-lg shadow-amber/20 hover:brightness-110"
                    }`}
                  >
                    {added ? "✓ Ajouté au devis" : "Ajouter au devis"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA devis */}
        <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl bg-panel p-6 text-center ring-1 ring-line sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-display text-lg font-bold text-frost">
              {selected.length === 0
                ? "Prêt à passer commande ?"
                : `${selected.length} produit(s) ajouté(s) au devis`}
            </p>
            <p className="mt-1 text-sm text-ash">
              {selected.length === 0
                ? "Ajoutez les produits de la gamme à votre demande pour recevoir un devis sur mesure."
                : selected.join(" · ")}
            </p>
          </div>
          <Link
            to={devisUrl}
            className="shrink-0 rounded-xl bg-gradient-to-r from-amber to-copper px-6 py-3 text-sm font-semibold text-ink shadow-xl shadow-amber/20 transition hover:brightness-110"
          >
            {selected.length === 0 ? "Demander un devis →" : `Finaliser ma demande (${selected.length}) →`}
          </Link>
        </div>
      </div>
    </div>
  );
}