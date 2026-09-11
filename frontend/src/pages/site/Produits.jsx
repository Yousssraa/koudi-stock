import { Link } from "react-router-dom";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import { FAMILLES } from "../../site/familles.js";

export default function Produits() {
  useDocumentTitle("Boutique — KOUDI WOOD");

  return (
    <div className="border-t border-line">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-frost">Boutique</h1>
            <p className="mt-1 text-sm text-ash">Trouvez le bois, panneau ou produit de coffrage adapté à votre projet.</p>
          </div>
        </div>

        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-frost">Nos gammes de produits</h2>
              <p className="mt-1 text-sm text-ash">Cliquez sur une gamme pour voir ses produits et demander un devis.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {FAMILLES.map((fam) => (
              <Link
                key={fam.key}
                to={`/gamme/${fam.key}`}
                className="group overflow-hidden rounded-xl bg-panel text-left ring-1 ring-line transition hover:shadow-lg hover:shadow-black/5 hover:ring-amber/30"
              >
                <div className="relative h-28 overflow-hidden">
                  <img src={fam.image} alt={fam.label} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                </div>
                <div className="p-3 sm:p-4">
                  <h3 className="font-display text-sm font-extrabold leading-snug tracking-tight text-frost group-hover:text-amber">
                    {fam.label}
                  </h3>
                  <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-ash">{fam.description}</p>
                  <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber">
                    Voir la gamme <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}