import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client.js";
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "../components/ToastContext.jsx";
import useDocumentTitle from "../hooks/useDocumentTitle.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Skeleton from "../components/Skeleton.jsx";

const fmt = (n, d = 2) =>
  n === null || n === undefined || isNaN(n)
    ? "\u2014"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const MONTH_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MONTH_SHORT = ["", "Jan", "F\u00e9v", "Mar", "Avr", "Mai", "Jun", "Juil", "Ao\u00fb", "Sep", "Oct", "Nov", "D\u00e9c"];

export default function Archive() {
  const { warehouseId } = useApp();
  const toast = useToast();
  useDocumentTitle("Archives");

  const [searchParams, setSearchParams] = useSearchParams();
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selYear, setSelYear] = useState(null);
  const [selMonth, setSelMonth] = useState(null);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");

  const now = new Date();
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeYear, setCloseYear] = useState(now.getFullYear());
  const [closeMonth, setCloseMonth] = useState(now.getMonth() + 1);
  const [closing, setClosing] = useState(false);
  const YEARS = [now.getFullYear(), now.getFullYear() - 1];

  const handleCloseMonth = async () => {
    if (!closeYear || !closeMonth || closing) return;
    setClosing(true);
    try {
      const res = await api.post("/archive/close/", {
        year: closeYear,
        month: closeMonth,
      });
      toast.success(res.data.detail || "Mois clôturé.");
      const r = await api.get("/archive/");
      setMonths(r.data || []);
      setSelYear(closeYear);
      setSelMonth(closeMonth);
      setSearchParams({ year: closeYear, month: closeMonth });
      setCloseOpen(false);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      toast.error(detail || "Impossible de clôturer ce mois.");
    } finally {
      setClosing(false);
    }
  };

  // Load months list
  useEffect(() => {
    setLoading(true);
    api
      .get("/archive/")
      .then((r) => {
        setMonths(r.data || []);
        const y = searchParams.get("year");
        const m = searchParams.get("month");
        if (y && m) {
          setSelYear(parseInt(y));
          setSelMonth(parseInt(m));
        } else if (r.data && r.data.length > 0) {
          setSelYear(r.data[0].year);
          setSelMonth(r.data[0].month);
        }
      })
      .catch(() => toast.error("Impossible de charger les archives."))
      .finally(() => setLoading(false));
  }, [toast, searchParams]);

  // Load products for selected month
  const loadProducts = useCallback(() => {
    if (!selYear || !selMonth) return;
    setProductsLoading(true);
    const params = new URLSearchParams();
    if (warehouseId) params.set("warehouse", warehouseId);
    if (category) params.set("category", category);
    if (search) params.set("search", search);
    const qs = params.toString() ? `?${params.toString()}` : "";
    api
      .get(`/archive/${selYear}/${selMonth}/${qs}`)
      .then((r) => setProducts(r.data.products || []))
      .catch(() => toast.error("Erreur chargement archivage."))
      .finally(() => setProductsLoading(false));
  }, [selYear, selMonth, warehouseId, category, search, toast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const selectMonth = (y, m) => {
    setSelYear(y);
    setSelMonth(m);
    setSearchParams({ year: y, month: m });
  };

  const selectedSummary = months.find((m) => m.year === selYear && m.month === selMonth);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-frost">Archives</h1>
          <p className="text-sm text-ash">
            Stock mensuel archiv\u00e9 \u2014 consultez les mois pr\u00e9c\u00e9dents.
          </p>
        </div>
        <button
          onClick={() => setCloseOpen((o) => !o)}
          className="rounded-lg border border-amber/40 bg-panel px-4 py-2 text-sm font-semibold text-amber transition hover:bg-amber/10"
        >
          {closeOpen ? "Fermer" : "+ Cl\u00f4turer un mois"}
        </button>
      </header>

      {closeOpen && (
        <div className="mb-6 rounded-2xl bg-panel p-4 ring-1 ring-amber/30">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-dim">
                Ann\u00e9e
              </label>
              <select
                value={closeYear}
                onChange={(e) => setCloseYear(parseInt(e.target.value))}
                className="rounded-lg border border-line bg-ink px-3 py-2 text-sm font-medium text-frost outline-none transition focus:border-amber/60"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-dim">
                Mois
              </label>
              <select
                value={closeMonth}
                onChange={(e) => setCloseMonth(parseInt(e.target.value))}
                className="rounded-lg border border-line bg-ink px-3 py-2 text-sm font-medium text-frost outline-none transition focus:border-amber/60"
              >
                {MONTH_NUMS.map((m) => (
                  <option key={m} value={m}>
                    {m} \u2013 {MONTH_SHORT[m]}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCloseMonth}
              disabled={closing}
              className="rounded-lg bg-gradient-to-r from-amber to-copper px-5 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {closing ? "Cl\u00f4ture en cours\u2026" : "Cl\u00f4turer le mois"}
            </button>
          </div>
          <p className="mt-3 text-xs text-dim">
            Cr\u00e9e un instantan\u00e9 mensuel (cl\u00f4ture, achats, ventes, transferts) \u00e0
            partir de l\u2019inventaire et du journal des mouvements.
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : months.length === 0 ? (
        <EmptyState
          icon="🗄"
          title="Aucune archive"
          message="Aucun mois n'a encore \u00e9t\u00e9 archiv\u00e9. Utilisez l'API /archive/close/ pour cl\u00f4turer un mois."
        />
      ) : (
        <>
          {/* Month selector grid */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {months.map((m) => {
              const active = m.year === selYear && m.month === selMonth;
              return (
                <button
                  key={`${m.year}-${m.month}`}
                  onClick={() => selectMonth(m.year, m.month)}
                  className={`group flex flex-col items-start rounded-2xl p-4 text-left ring-1 transition ${
                    active
                      ? "bg-gradient-to-br from-amber/20 to-copper/10 ring-amber shadow-lg shadow-amber/10"
                      : "bg-panel ring-line hover:ring-amber/40 hover:bg-raise"
                  }`}
                >
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      active ? "text-amber" : "text-dim"
                    }`}
                  >
                    {m.year}
                  </span>
                  <span
                    className={`mt-1 font-display text-lg font-bold ${
                      active ? "text-frost" : "text-ash group-hover:text-frost"
                    }`}
                  >
                    {m.month_name}
                  </span>
                  <span className="mt-2 text-[11px] text-dim">
                    {m.product_count} produits
                  </span>
                  <span className="text-[11px] text-dim">
                    {fmt(m.total_closing_value, 0)} MAD
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected month summary */}
          {selectedSummary && (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-panel p-4 ring-1 ring-line">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">
                  Cl\u00f4ture stock
                </p>
                <p className="mt-1 font-display text-xl font-bold text-frost">
                  {fmt(selectedSummary.total_closing_qty, 0)}
                  <span className="ml-1 text-xs text-ash">pcs</span>
                </p>
                <p className="text-xs text-dim">{fmt(selectedSummary.total_closing_value, 0)} MAD</p>
              </div>
              <div className="rounded-xl bg-panel p-4 ring-1 ring-line">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">
                  Achats
                </p>
                <p className="mt-1 font-display text-xl font-bold text-jade">
                  {fmt(selectedSummary.total_purchase_qty, 0)}
                  <span className="ml-1 text-xs text-ash">pcs</span>
                </p>
                <p className="text-xs text-dim">{fmt(selectedSummary.total_purchase_value, 0)} MAD</p>
              </div>
              <div className="rounded-xl bg-panel p-4 ring-1 ring-line">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">
                  Ventes
                </p>
                <p className="mt-1 font-display text-xl font-bold text-rose">
                  {fmt(selectedSummary.total_sale_qty, 0)}
                  <span className="ml-1 text-xs text-ash">pcs</span>
                </p>
                <p className="text-xs text-dim">{fmt(selectedSummary.total_sale_value, 0)} MAD</p>
              </div>
              <div className="rounded-xl bg-panel p-4 ring-1 ring-line">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">
                  Produits archiv\u00e9s
                </p>
                <p className="mt-1 font-display text-xl font-bold text-amber">
                  {selectedSummary.product_count}
                </p>
                <p className="text-xs text-dim">
                  {selectedSummary.total_sale_qty > 0
                    ? `Ratio vente/stock: ${fmt(
                        (selectedSummary.total_sale_qty / selectedSummary.total_closing_qty) * 100,
                        0
                      )}%`
                    : "\u2014"}
                </p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium text-frost outline-none transition focus:border-amber/60"
            >
              <option value="">Toutes cat\u00e9gories</option>
              <option value="Bois rouge">Bois rouge</option>
              <option value="Bois blanc">Bois blanc</option>
              <option value="Bois exotique">Bois exotique</option>
              <option value="Bois noble">Bois noble</option>
              <option value="Panneaux">Panneaux</option>
              <option value="Coffrage">Coffrage</option>
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Recherche SKU ou nom\u2026"
              className="w-48 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-frost outline-none placeholder:text-dim transition focus:border-amber/60"
            />
          </div>

          {/* Product table */}
          {productsLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon="📋"
              title="Aucune donn\u00e9e"
              message="Aucun produit archiv\u00e9 pour cette p\u00e9riode."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl ring-1 ring-line">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-panel/80">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">
                      Produit
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">
                      D\u00e9p\u00f4t
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">
                      Ouverture
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">
                      Achats
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">
                      Ventes
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">
                      Transf. in
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">
                      Transf. out
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">
                      Cl\u00f4ture
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">
                      Valeur MAD
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">
                      Vol. m\u00b3
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-line/50 transition hover:bg-raise/50"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-ash">{r.sku}</td>
                      <td className="px-4 py-2.5 text-frost">{r.product}</td>
                      <td className="px-4 py-2.5 text-ash">{r.warehouse}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-ash">
                        {fmt(r.opening_qty, 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-jade">
                        +{fmt(r.purchase_qty, 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-rose">
                        -{fmt(r.sale_qty, 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-skyx">
                        +{fmt(r.transfer_in_qty, 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-amber">
                        -{fmt(r.transfer_out_qty, 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-frost">
                        {fmt(r.closing_qty, 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-amber">
                        {fmt(r.closing_value, 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-copper">
                        {r.volume_m3 === null ? "\u2014" : fmt(r.volume_m3, 3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
