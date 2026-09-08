import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import { useToast } from "../components/ToastContext.jsx";
import useDocumentTitle from "../hooks/useDocumentTitle.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Skeleton from "../components/Skeleton.jsx";

const fmt = (n, d = 2) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const input =
  "w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none transition focus:border-amber/50 focus:ring-2 focus:ring-amber/20";
const label = "mb-1 block text-xs font-semibold text-dim";

const EMPTY = {
  wood_type_id: "",
  category: "",
  piece_type: "",
  treatment: "",
  target: "timber",
  unit_price_mad: "",
  is_active: true,
};

export default function Tarifs() {
  const toast = useToast();
  useDocumentTitle("Tarifs & Prix");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);

  const [catalog, setCatalog] = useState({ categories: [], piece_types: [], treatments: [] });
  const [woodTypes, setWoodTypes] = useState([]);

  const [filters, setFilters] = useState({ wood_type_id: "", category: "", piece_type: "", treatment: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    api
      .get(`/reference-prices/?${params.toString()}`)
      .then((res) => setRows(res.data.results || res.data || []))
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get("/catalog-config/")
      .then((r) => setCatalog((c) => ({ ...c, ...r.data })))
      .catch(() => {});
    api
      .get("/wood-types/")
      .then((r) => setWoodTypes(r.data.results || r.data))
      .catch(() => {});
    api
      .get("/public/products/")
      .then((r) => {
        const list = r.data && Array.isArray(r.data) ? r.data : r.data?.results || [];
        setProducts(list);
      })
      .catch((err) => setProductsError(err.response?.data?.detail || "Erreur de chargement des produits."))
      .finally(() => setProductsLoading(false));
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setModalOpen(true);
  };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      wood_type_id: r.wood_type_id ?? "",
      category: r.category || "",
      piece_type: r.piece_type || "",
      treatment: r.treatment || "",
      target: r.target || "timber",
      unit_price_mad: r.unit_price_mad ?? "",
      is_active: r.is_active,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        wood_type_id: form.wood_type_id ? Number(form.wood_type_id) : null,
        unit_price_mad: form.unit_price_mad === "" ? "0" : form.unit_price_mad,
      };
      if (editing) await api.patch(`/reference-prices/${editing.id}/`, payload);
      else await api.post("/reference-prices/", payload);
      toast.success(editing ? "Tarif mis à jour." : "Tarif ajouté.");
      setModalOpen(false);
      load();
    } catch (err) {
      const d = err.response?.data;
      setFormError((d && (d.detail || Object.values(d).flat().join(" "))) || err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Supprimer ce tarif (${r.wood_type || "générique"} · ${r.category || "—"} · ${r.piece_type || "—"}) ?`)) return;
    try {
      await api.delete(`/reference-prices/${r.id}/`);
      toast.success("Tarif supprimé.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de la suppression.");
    }
  };

  const activeFilters = Object.values(filters).some(Boolean);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-frost">Tarifs &amp; Prix</h1>
          <p className="text-sm text-ash">
            Grille de prix de référence au m³ / m² par essence — la base de travail de l'équipe commerciale.
          </p>
        </div>
        <button
          onClick={openNew}
          className="rounded-lg bg-gradient-to-r from-amber to-copper px-4 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110"
        >
          + Nouveau Tarif
        </button>
      </header>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={filters.wood_type_id}
          onChange={(e) => setFilters((f) => ({ ...f, wood_type_id: e.target.value }))}
          className={input}
        >
          <option value="">Toutes essences</option>
          {woodTypes.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select
          value={filters.category}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          className={input}
        >
          <option value="">Toutes catégories</option>
          {catalog.categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select
          value={filters.piece_type}
          onChange={(e) => setFilters((f) => ({ ...f, piece_type: e.target.value }))}
          className={input}
        >
          <option value="">Tous types de pièce</option>
          {catalog.piece_types.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <select
          value={filters.treatment}
          onChange={(e) => setFilters((f) => ({ ...f, treatment: e.target.value }))}
          className={input}
        >
          <option value="">Tous traitements</option>
          {catalog.treatments.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {error && <div className="mb-4 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="◈"
          title={activeFilters ? "Aucun tarif pour ces filtres" : "Aucun tarif"}
          message="Ajoutez un tarif de référence ou modifiez les filtres pour commencer."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-raise">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Essence</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Catégorie</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Type de pièce</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Traitement</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Cible</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">Prix</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Statut</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line/50 transition hover:bg-raise/40">
                  <td className="px-4 py-3 font-semibold text-frost">{r.wood_type || "— générique —"}</td>
                  <td className="px-4 py-3 text-xs text-ash">{r.category || "—"}</td>
                  <td className="px-4 py-3 text-xs text-ash">{r.piece_type || "—"}</td>
                  <td className="px-4 py-3 text-xs text-ash">{r.treatment || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${r.target === "panel" ? "bg-skyx/15 text-skyx" : "bg-amber/15 text-amber"}`}>
                      {r.target === "panel" ? "Panneau" : "Bois massif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-frost">
                    {fmt(r.unit_price_mad, 0)} <span className="text-[11px] text-dim">MAD/{r.target === "panel" ? "unité" : "m³"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {r.is_active ? (
                      <span className="rounded-md bg-jade/15 px-2 py-0.5 text-[11px] font-semibold text-jade">Actif</span>
                    ) : (
                      <span className="rounded-md bg-ash/15 px-2 py-0.5 text-[11px] font-semibold text-ash">Inactif</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEdit(r)}
                        title="Modifier"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-xs text-ash transition hover:bg-raise hover:text-amber"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => remove(r)}
                        title="Supprimer"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose/40 text-xs text-rose transition hover:bg-rose/10"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PRODUITS RÉELS (boutique / page d'accueil) */}
      <section className="mt-8">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-frost">Produits &amp; prix réels</h2>
            <p className="text-sm text-ash">
              Prix d'affichage réel de chaque produit en stock, tels qu'affichés sur la boutique et la page d'accueil.
            </p>
          </div>
          <span className="rounded-full bg-amber/15 px-3 py-1 text-xs font-semibold text-amber">
            {products.length} produits
          </span>
        </header>

        {productsError && (
          <div className="mb-4 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{productsError}</div>
        )}

        {productsLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : products.length === 0 ? (
          <EmptyState icon="◈" title="Aucun produit" message="Aucun produit disponible pour le moment." />
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-raise">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Produit</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Catégorie</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Dimensions</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">Volume</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">Prix réel</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Unité</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Stock</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-line/50 transition hover:bg-raise/40">
                    <td className="px-4 py-3 font-semibold text-frost">{p.name}</td>
                    <td className="px-4 py-3 text-xs text-ash">{p.category || "—"}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-ash">{p.dimensions_display || "—"}</td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums text-ash">
                      {p.is_panel ? "—" : `${fmt(p.volume_cubic_m, 4)} m³`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber">
                      {fmt(p.sale_price, 0)} <span className="text-[11px] font-normal text-dim">MAD</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ash">
                      {p.is_panel ? "unité" : "m³"}
                    </td>
                    <td className="px-4 py-3">
                      {p.stock_status === "out_of_stock" ? (
                        <span className="rounded-md bg-rose/15 px-2 py-0.5 text-[11px] font-semibold text-rose">Rupture</span>
                      ) : (
                        <span className="rounded-md bg-jade/15 px-2 py-0.5 text-[11px] font-semibold text-jade">En stock</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-panel shadow-xl shadow-black/40 ring-1 ring-line"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-line bg-panel px-6 py-4">
              <h2 className="font-display text-lg font-bold text-frost">
                {editing ? "Modifier le Tarif" : "Nouveau Tarif de Référence"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-dim transition hover:text-frost" aria-label="Close">
                ✕
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4 px-6 py-6">
              {formError && (
                <div className="rounded-lg bg-rose/10 px-4 py-3 text-sm text-rose ring-1 ring-rose/30">{formError}</div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={label}>Essence (facultatif)</label>
                  <select className={input} value={form.wood_type_id} onChange={set("wood_type_id")}>
                    <option value="">— générique —</option>
                    {woodTypes.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Cible *</label>
                  <select className={input} value={form.target} onChange={set("target")}>
                    <option value="timber">Bois massif (au m³)</option>
                    <option value="panel">Panneau / dérivés (à l'unité)</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Catégorie</label>
                  <select className={input} value={form.category} onChange={set("category")}>
                    <option value="">Toutes catégories</option>
                    {catalog.categories.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Type de pièce</label>
                  <select className={input} value={form.piece_type} onChange={set("piece_type")}>
                    <option value="">Toutes pièces</option>
                    {catalog.piece_types.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Traitement</label>
                  <select className={input} value={form.treatment} onChange={set("treatment")}>
                    <option value="">Tous traitements</option>
                    {catalog.treatments.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Prix / {form.target === "panel" ? "unité" : "m³"} (MAD) *</label>
                  <input type="number" min="0" step="0.01" className={input} value={form.unit_price_mad} onChange={set("unit_price_mad")} required placeholder="ex. 4500" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-frost">
                <input type="checkbox" checked={form.is_active} onChange={set("is_active")} className="h-4 w-4 accent-amber" />
                Tarif actif
              </label>

              <div className="flex justify-end gap-3 border-t border-line pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-ash transition hover:bg-raise">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-gradient-to-r from-amber to-copper px-5 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110 disabled:opacity-50">
                  {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
