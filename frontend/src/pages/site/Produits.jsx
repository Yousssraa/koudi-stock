import { useState } from "react";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { FAMILLES } from "../../site/familles.js";

export default function Produits() {
  useDocumentTitle("Boutique — KOUDI WOOD");
  const [openFamily, setOpenFamily] = useState(null);

  return (
    <div className="border-t border-line">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-frost">Boutique</h1>
            <p className="mt-1 text-sm text-ash">Trouvez le bois, panneau ou produit de coffrage adapté à votre projet.</p>
          </div>
        </div>

        {/* Nos gammes — 7 familles, 3 exemples au clic */}
        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-frost">Nos gammes de produits</h2>
              <p className="mt-1 text-sm text-ash">Cliquez sur une gamme pour voir 3 exemples de produits et leurs applications.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {FAMILLES.map((fam) => {
              const open = openFamily === fam.key;
              return (
                <button
                  key={fam.key}
                  onClick={() => setOpenFamily(open ? null : fam.key)}
                  className={`group overflow-hidden rounded-xl bg-panel text-left ring-1 transition hover:shadow-lg hover:shadow-black/5 ${
                    open ? "ring-2 ring-amber/60" : "ring-line hover:ring-amber/30"
                  }`}
                >
                  <div className="relative h-28 overflow-hidden">
                    <img src={fam.image} alt={fam.label} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    {open && (
                      <span className="absolute right-2 top-2 rounded-full bg-amber px-2 py-0.5 text-[10px] font-semibold text-ink">Ouvert</span>
                    )}
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="font-display text-sm font-extrabold leading-snug tracking-tight text-frost group-hover:text-amber">
                      {fam.label}
                    </h3>
                    <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-ash">{fam.description}</p>
                    <span className={`mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold ${open ? "text-amber" : "text-amber"}`}>
                      Voir 3 exemples <span className={`transition-transform duration-300 ${open ? "rotate-90" : ""}`}>→</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {openFamily &&
            (() => {
              const fam = FAMILLES.find((f) => f.key === openFamily);
              if (!fam) return null;
              return (
                <div className="mt-3 rounded-2xl bg-panel p-4 ring-1 ring-line sm:p-6">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-extrabold tracking-tight text-frost">{fam.label}</h3>
                      <p className="mt-1 max-w-2xl text-xs text-dim">{fam.description}</p>
                    </div>
                    <button
                      onClick={() => setOpenFamily(null)}
                      className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold text-dim transition hover:bg-raise hover:text-frost"
                    >
                      Fermer ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {fam.examples.map((ex, i) => (
                      <div key={i} className="overflow-hidden rounded-xl bg-raise/50 ring-1 ring-line">
                        <img src={ex.image} alt={ex.name} className="h-24 w-full object-cover sm:h-28" />
                        <div className="p-3 sm:p-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber">{ex.essence}</p>
                          <h4 className="font-display mt-1 text-sm font-bold text-frost">{ex.name}</h4>
                          <p className="mt-1.5 text-xs leading-relaxed text-ash">{ex.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
        </section>
      </div>
    </div>
  );
}
