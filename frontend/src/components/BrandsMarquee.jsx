import BRANDS from "../site/brands.js";

// « Les marques les plus réputées » — bandeau défilant des marques partenaires,
// inspiré du site Comarbois. Chaque nom est affiché comme un logo texte.
export default function BrandsMarquee() {
  const items = [...BRANDS, ...BRANDS];

  return (
    <section className="border-y border-line bg-panel py-12">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <h2 className="font-display text-center text-2xl font-bold uppercase tracking-tight text-frost sm:text-3xl">
          <span className="border-b-4 border-amber pb-1">Les marques les plus réputées</span>
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-ash">
          KOUDI WOOD distribue des produits issus des plus grandes marques
          internationales pour garantir qualité et performance sur vos chantiers.
        </p>
      </div>

      <div className="relative mt-10 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-panel to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-panel to-transparent" />

        <div className="flex w-max animate-marquee gap-10 px-6">
          {items.map((brand, i) => (
            <div
              key={`${brand}-${i}`}
              className="flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-line bg-ink px-6 py-3 font-display text-base font-bold tracking-wide text-ash transition hover:border-amber/40 hover:text-copper"
            >
              {brand}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
