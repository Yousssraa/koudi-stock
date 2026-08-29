import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client.js";
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "../components/ToastContext.jsx";
import useDocumentTitle from "../hooks/useDocumentTitle.jsx";
import StockBadge from "../components/StockBadge.jsx";
import ProductModal from "../components/ProductModal.jsx";
import StockAdjustModal from "../components/StockAdjustModal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Skeleton from "../components/Skeleton.jsx";

const fmt = (n, d = 2) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function Stock() {
  const { warehouseId, refreshKey, warehouses } = useApp();
  const toast = useToast();
  useDocumentTitle("Stock");
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(searchParams.get("search") || "");

  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [adjust, setAdjust] = useState(null); // { mode, product }

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (warehouseId) params.set("warehouse", warehouseId);
    if (search) params.set("search", search);
    api
      .get(`/products/?${params.toString()}`)
      .then((res) => setRows(res.data.results || res.data || []))
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false));
  }, [warehouseId, search]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const runSearch = (e) => {
    e.preventDefault();
    setSearchParams(search ? { search } : {});
  };

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (p) => {
    setEditing(p);
    setModalOpen(true);
  };
  const onSaved = () => {
    toast.success("Produit enregistré.");
    load();
  };
  const onAdjusted = (mode) => {
    toast.success(mode === "add" ? "Stock ajouté." : "Stock retiré.");
    load();
  };

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-frost">Stock</h1>
          <p className="text-sm text-ash">
            Inventaire des bois — volume calculé automatiquement en m³.
          </p>
        </div>
        <button
          onClick={openNew}
          className="rounded-lg bg-gradient-to-r from-amber to-copper px-4 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110"
        >
          + Nouveau Produit
        </button>
      </header>

      <div className="mb-4 flex items-center gap-3">
        <form onSubmit={runSearch} className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 transition focus-within:border-amber/50">
          <span className="text-sm text-dim">⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche nom ou réf…"
            className="w-full bg-transparent text-sm text-frost outline-none placeholder:text-dim"
          />
          <button type="submit" className="text-xs font-semibold text-amber">OK</button>
        </form>
        <span className="text-sm text-dim">{loading ? "Chargement…" : `${rows.length} produit(s)`}</span>
      </div>

      {error && <div className="mb-4 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="▦"
          title="Aucun produit"
          message="Ajoutez un produit ou effectuez une entrée pour démarrer l'inventaire."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-raise">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Ref</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Essence</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Dimensions</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">Qté</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">Volume (m³)</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">Prix unitaire</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Statut</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-line/50 transition hover:bg-raise/40">
                  <td className="px-4 py-3 font-mono text-xs text-ash">{p.sku}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-frost">{p.name}</div>
                    <div className="text-[11px] text-dim">
                      {[p.wood_type?.name, p.piece_type, p.treatment].filter(Boolean).join(" · ") || p.category || "—"}
                    </div>
                    {p.colis_number && <div className="text-[11px] text-amber">Colis {p.colis_number}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-ash">{p.dimensions_display || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-frost">
                    {fmt(p.total_stock_qty)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber">
                    {p.total_stock_volume_m3 === null ? "—" : fmt(p.total_stock_volume_m3, 3)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-frost">
                    {fmt(p.sale_price, 0)} <span className="text-[11px] text-dim">MAD/m³</span>
                  </td>
                  <td className="px-4 py-3"><StockBadge status={p.stock_status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setAdjust({ mode: "add", product: p })}
                        title="Ajouter du stock"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-jade/40 text-sm font-bold text-jade transition hover:bg-jade/10"
                      >
                        +
                      </button>
                      <button
                        onClick={() => setAdjust({ mode: "subtract", product: p })}
                        title="Retirer du stock"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose/40 text-sm font-bold text-rose transition hover:bg-rose/10"
                      >
                        −
                      </button>
                      <button
                        onClick={() => openEdit(p)}
                        title="Modifier le produit"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-xs text-ash transition hover:bg-raise hover:text-amber"
                      >
                        ✎
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={onSaved} product={editing} />
      <StockAdjustModal
        open={Boolean(adjust)}
        mode={adjust?.mode || "add"}
        onClose={() => setAdjust(null)}
        product={adjust?.product}
        warehouses={warehouses}
        onSaved={() => onAdjusted(adjust?.mode)}
      />
    </div>
  );
}
