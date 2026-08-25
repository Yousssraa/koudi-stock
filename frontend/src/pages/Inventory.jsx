import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client.js";
import { downloadPdf } from "../api/download.js";
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "../components/ToastContext.jsx";
import useDocumentTitle from "../hooks/useDocumentTitle.jsx";
import StockBadge from "../components/StockBadge.jsx";
import MoistureBadge from "../components/MoistureBadge.jsx";
import ProductModal from "../components/ProductModal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Skeleton from "../components/Skeleton.jsx";

const fmt = (n, d = 2) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const MOISTURE_OPTIONS = [
  { value: "", label: "Humidité : Tous" },
  { value: "kd", label: "Sec Séchoir (≤12%)" },
  { value: "air_dried", label: "Séché à l'air (12–18%)" },
  { value: "green", label: "Vert (>18%)" },
];

const GRADE_OPTIONS = ["", "FAS", "Cabinet grade", "Select", "Standard", "Construction"];

// Real photos of each wood species / finish (Wikimedia Commons, CC), shipped
// locally in frontend/public/wood so the demo stays fully offline.
const WOOD_PHOTO = {
  "Pin sylvestre": "/wood/pin-sylvestre.jpg",
  "Épicéa": "/wood/epicea.jpg",
  "Sapelli": "/wood/sapelli.jpg",
  "Kossipo": "/wood/kossipo.jpg",
  "Dabema": "/wood/dabema.jpg",
  "Dibétou": "/wood/dibetou.jpg",
  "Iroko": "/wood/iroko.jpg",
  "Chêne": "/wood/chene.jpg",
  "Noyer": "/wood/noyer.jpg",
  "Okoumé": "/wood/okoume.jpg",
  Panneaux: "/wood/panneaux.jpg",
  Coffrage: "/wood/coffrage.jpg",
  _default: "/wood/pin-sylvestre.jpg",
};

const woodPhoto = (p) =>
  p.wood_type?.name
    ? WOOD_PHOTO[p.wood_type.name] || WOOD_PHOTO._default
    : WOOD_PHOTO[p.category] || WOOD_PHOTO._default;

const warehouseShort = (name) => (name || "").replace(/^Dépôt\s+/i, "") || name || "—";

export default function Inventory() {
  const { warehouseId, refreshKey } = useApp();
  const toast = useToast();
  useDocumentTitle("Inventaire");
  const [searchParams, setSearchParams] = useSearchParams();

  const [woodTypes, setWoodTypes] = useState([]);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [prev, setPrev] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [species, setSpecies] = useState("");
  const [moisture, setMoisture] = useState("");
  const [grade, setGrade] = useState("");
  const [warehouseScope, setWarehouseScope] = useState("all");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [query, setQuery] = useState(searchParams.get("search") || "");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    api
      .get("/wood-types/")
      .then((r) => setWoodTypes(r.data.results || r.data))
      .catch(() => {
        setWoodTypes([]);
        toast.error("Impossible de charger les essences.");
      });
  }, [toast]);

  useEffect(() => {
    const q = searchParams.get("search") || "";
    setQuery(q);
    setSearch(q);
  }, [searchParams]);

  const load = useCallback(
    (pageUrl) => {
      setLoading(true);
      setError(null);
      const url = new URL(pageUrl || "/products/", window.location.origin);
      const params = url.searchParams;
      params.delete("page_size");
      if (warehouseScope !== "all" && warehouseId) params.set("warehouse", warehouseId);
      else params.delete("warehouse");
      if (species) params.set("species", species);
      else params.delete("species");
      if (grade) params.set("grade", grade);
      else params.delete("grade");
      if (moisture === "kd") params.set("moisture_max", 12);
      if (moisture === "air_dried") {
        params.set("moisture_min", 12);
        params.set("moisture_max", 18);
      }
      if (moisture === "green") params.set("moisture_min", 18);
      if (moisture !== "kd" && moisture !== "air_dried" && moisture !== "green") {
        params.delete("moisture_min");
        params.delete("moisture_max");
      }
      if (query) params.set("search", query);
      else params.delete("search");

      api
        .get(`${url.pathname}?${params.toString()}`)
        .then((res) => {
          setRows(res.data.results || res.data || []);
          setCount(res.data.count ?? (res.data || []).length);
          setNext(res.data.next);
          setPrev(res.data.previous);
        })
        .catch((err) => setError(err.response?.data?.detail || err.message))
        .finally(() => setLoading(false));
    },
    [warehouseScope, warehouseId, species, grade, moisture, query]
  );

  useEffect(() => {
    load(null);
  }, [load, refreshKey]);

  const runSearch = (e) => {
    e.preventDefault();
    setQuery(search);
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
    load(null);
  };

  const printLabels = async (p) => {
    const defaultQty = p.total_stock_qty || 1;
    const input = window.prompt(
      `Imprimer les QR étiquettes pour « ${p.name} »\nNombre d'étiquettes (1-100) :`,
      String(defaultQty)
    );
    if (input === null) return;
    const qty = Math.max(1, Math.min(100, parseInt(input, 10) || 1));
    try {
      await downloadPdf(`/products/${p.id}/label/`, `label-${p.sku}.pdf`, { qty, warehouse: warehouseId || undefined });
      toast.success(`${qty} QR étiquette(s) générée(s).`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de la génération des étiquettes.");
    }
  };

  const pill = (active, label, onClick) => (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ${
        active
          ? "bg-gradient-to-r from-amber to-copper text-ink ring-transparent shadow-lg shadow-amber/20"
          : "bg-panel text-ash ring-line hover:bg-raise hover:text-frost"
      }`}
    >
      {label}
    </button>
  );

  const exportCsv = async () => {
    toast.info("Préparation de l'export…");
    try {
      const { data } = await api.get("/products/", { params: { page_size: 500 } });
      const list = data.results || data || [];
      const headers = ["SKU", "Produit", "Essence", "Catégorie", "Dimensions (mm)", "Volume unitaire m3", "Humidité %", "Statut humidité", "Grade", "Qté totale", "Volume total m3", "Dépôts", "Statut", "Prix coût MAD/m3", "Prix vente MAD/m3"];
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = list.map((p) => [
        p.sku,
        p.name,
        p.wood_type?.name || "",
        p.category || "",
        p.dimensions_display || "",
        p.volume_cubic_m ?? "",
        p.moisture_content ?? "",
        p.moisture_status || "",
        p.grade || "",
        p.total_stock_qty ?? "",
        p.total_stock_volume_m3 ?? "",
        (p.stock_by_warehouse || []).map((w) => `${w.warehouse_name}:${w.quantity}`).join(" | "),
        p.stock_status || "",
        p.cost_price ?? "",
        p.sale_price ?? "",
      ].map(esc).join(";"));
      const csv = [headers.map(esc).join(";"), ...lines].join("\r\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `koudi-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Export CSV généré (${list.length} produits).`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de l'export CSV.");
    }
  };

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-frost">Inventaire</h1>
          <p className="text-sm text-ash">Catalogue des bois — filtres par essence, humidité, qualité et dépôt.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="rounded-lg border border-line bg-panel px-4 py-2 text-sm font-semibold text-ash transition hover:border-amber/40 hover:text-amber"
          >
            ⭳ Export CSV
          </button>
          <button
            onClick={openNew}
            className="rounded-lg bg-gradient-to-r from-amber to-copper px-4 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110"
          >
            + Nouveau Produit
          </button>
        </div>
      </header>

      {/* Filter pills */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {woodTypes.map((w) => (
          <span key={w.id}>
            {pill(species === w.name, w.name, () => setSpecies(species === w.name ? "" : w.name))}
          </span>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {MOISTURE_OPTIONS.map((o) => (
          <span key={o.value}>
            {pill(moisture === o.value, o.label, () => setMoisture(o.value))}
          </span>
        ))}
        <span className="mx-2 hidden h-5 w-px bg-line sm:block" />
        {GRADE_OPTIONS.map((g) => (
          <span key={g || "all"}>
            {pill(grade === g, g || "Qualité : Tous", () => setGrade(g))}
          </span>
        ))}
        <span className="mx-2 hidden h-5 w-px bg-line sm:block" />
        <span>
          {pill(warehouseScope === "all", "Tous dépôts", () => setWarehouseScope("all"))}
        </span>
        <span>
          {pill(warehouseScope === "selected", warehouseId ? "Dépôt sélectionné" : "—", () => setWarehouseScope("selected"))}
        </span>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <form onSubmit={runSearch} className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 transition focus-within:border-amber/50">
          <span className="text-sm text-dim">⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche nom ou SKU…"
            className="w-full bg-transparent text-sm text-frost outline-none placeholder:text-dim"
          />
          <button type="submit" className="text-xs font-semibold text-amber">OK</button>
        </form>
        <span className="text-sm text-dim">{loading ? "Chargement…" : `${count} produit(s)`}</span>
      </div>

      {error && <div className="mb-4 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading && (
          [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
              <Skeleton className="h-24 rounded-none" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-12" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-9" />
              </div>
            </div>
          ))
        )}

        {!loading && rows.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon="▧"
              title="Aucun produit trouvé"
              message="Ajustez vos filtres ou créez un nouveau produit pour démarrer l'inventaire."
            />
          </div>
        )}

        {rows.map((p) => (
          <article
            key={p.id}
            className="group flex flex-col overflow-hidden rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/25 hover:ring-amber/40"
          >
            {/* Vitrine bois — photo réelle de l'essence */}
            <div className="relative h-24 shrink-0 overflow-hidden">
              <img
                src={woodPhoto(p)}
                alt={p.wood_type?.name || p.category || "Bois"}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(180deg, rgba(10,6,2,0.30), transparent 45%, rgba(10,6,2,0.45))" }}
              />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-2.5 py-0.5 text-xs font-bold text-copper ring-1 ring-black/5">
                <span className="h-1.5 w-1.5 rounded-full bg-copper" />
                {p.wood_type?.name || p.category || "—"}
              </span>
              <span className="absolute bottom-3 left-3 rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
                {p.category || "—"}
              </span>
              <span className="absolute right-3 top-3 rounded-full bg-ink/85 px-2.5 py-0.5 text-xs font-semibold text-frost ring-1 ring-black/5">
                {fmt(p.total_stock_qty)} pcs
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <h3 className="font-display text-[15px] font-bold leading-snug text-frost">{p.name}</h3>
                <p className="mt-0.5 font-mono text-[11px] text-dim">{p.sku}</p>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-raise/60 px-3 py-2 text-xs">
                <span className="text-dim">{p.dimensions_display || "—"}</span>
                <span className="font-semibold text-ash">{fmt(p.volume_cubic_m, 6)} m³</span>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-dim">Prix vente</p>
                  <p className="font-display text-xl font-bold text-amber">
                    {fmt(p.sale_price, 0)} <span className="text-xs font-semibold text-ash">MAD/m³</span>
                  </p>
                </div>
                <p className="text-right text-[11px] leading-tight text-dim">
                  Coût
                  <br />
                  <span className="font-semibold text-ash">{fmt(p.cost_price, 0)}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <StockBadge status={p.stock_status} />
                <MoistureBadge status={p.moisture_status} />
                {p.grade && (
                  <span className="rounded-full bg-amberl/25 px-2.5 py-0.5 text-xs font-semibold text-copper ring-1 ring-amberl/40">
                    {p.grade}
                  </span>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
                <div className="flex flex-col gap-0.5 text-xs">
                  {(p.stock_by_warehouse || []).map((w) => (
                    <span key={w.warehouse_id} className="text-ash">
                      {warehouseShort(w.warehouse_name)} : <strong className="text-frost">{fmt(w.quantity)}</strong>
                    </span>
                  ))}
                  {(!p.stock_by_warehouse || p.stock_by_warehouse.length === 0) && (
                    <span className="text-dim">Aucun stock</span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-dim">Vol. total</p>
                  <p className="font-semibold text-copper">
                    {p.total_stock_volume_m3 === null ? "—" : `${fmt(p.total_stock_volume_m3, 3)} m³`}
                  </p>
                </div>
              </div>

              <div className="mt-auto flex items-center gap-2 pt-3">
                <button
                  onClick={() => printLabels(p)}
                  title="Générer les QR étiquettes de lot"
                  className="flex-1 rounded-lg border border-line bg-panel py-2 text-xs font-semibold text-ash transition hover:border-amber/40 hover:bg-raise hover:text-amber"
                >
                  ◫ QR Étiquettes
                </button>
                <button
                  onClick={() => openEdit(p)}
                  className="flex-1 rounded-lg border border-line bg-panel py-2 text-xs font-semibold text-ash transition hover:border-amber/40 hover:bg-raise hover:text-amber"
                >
                  Modifier
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {(next || prev) && (
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-panel px-4 py-3 shadow-lg shadow-black/20 ring-1 ring-line">
          <button
            onClick={() => prev && load(prev)}
            disabled={!prev}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ash ring-1 ring-line transition hover:bg-raise disabled:opacity-40"
          >
            ← Précédent
          </button>
          <span className="text-xs text-dim">{count} résultats</span>
          <button
            onClick={() => next && load(next)}
            disabled={!next}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ash ring-1 ring-line transition hover:bg-raise disabled:opacity-40"
          >
            Suivant →
          </button>
        </div>
      )}

      <ProductModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={onSaved} product={editing} />
    </div>
  );
}
