import { useCallback, useEffect, useState } from "react";
import proApi from "../../api/proClient.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import { fmtDate, fmtMAD, fmtNum, QUOTE_BADGES, QUOTE_LABELS, StatusBadge } from "./helpers.jsx";

export default function ProDevis() {
  useDocumentTitle("Espace Pro — Devis");
  const [quotes, setQuotes] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback((status = "") => {
    setQuotes(null);
    setError(null);
    proApi
      .get("/pro/quotes/", { params: status ? { status } : {} })
      .then(({ data }) => setQuotes(data))
      .catch((err) =>
        setError(err.response?.data?.detail || "Impossible de charger vos devis.")
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-frost">Devis</h1>
          <p className="mt-1 text-sm text-ash">
            Demandez un devis en un clic à partir du catalogue, et suivez son statut.
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="rounded-lg bg-gradient-to-r from-amber to-copper px-4 py-2.5 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110"
        >
          + Nouveau devis
        </button>
      </div>

      {toast && (
        <div className="rounded-lg bg-jade/10 px-4 py-3 text-sm text-jade ring-1 ring-jade/30">
          {toast}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          ["", "Tous"],
          ["draft", "Brouillons"],
          ["sent", "Envoyés"],
          ["accepted", "Acceptés"],
          ["rejected", "Refusés"],
          ["expired", "Expirés"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setFilter(key);
              load(key);
            }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ${
              filter === key
                ? "bg-gradient-to-r from-amber to-copper text-ink ring-transparent"
                : "bg-panel text-ash ring-line hover:text-frost"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl bg-rose/10 px-5 py-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>
      )}

      {!quotes && !error && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}

      {quotes && quotes.length === 0 && (
        <EmptyState
          icon="📄"
          title="Aucun devis"
          message="Créez votre premier devis à partir des produits du catalogue."
          action={
            <button
              onClick={() => setModal(true)}
              className="mt-4 rounded-lg bg-gradient-to-r from-amber to-copper px-4 py-2 text-sm font-semibold text-ink"
            >
              + Créer un devis
            </button>
          }
        />
      )}

      {quotes && quotes.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
          <div className="divide-y divide-line">
            {quotes.map((q) => (
              <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-raise/50">
                <div className="min-w-0">
                  <p className="font-semibold text-frost">
                    {q.quote_number}
                    {q.valid_until && q.status === "sent" && (
                      <span className="ml-2 text-xs font-normal text-amber">
                        valable jusqu'au {fmtDate(q.valid_until)}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-dim">
                    {fmtDate(q.created_at)} · {q.items.length} article{q.items.length > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-frost">{fmtMAD(q.total_amount)}</span>
                  <StatusBadge status={q.status} map={QUOTE_BADGES} labels={QUOTE_LABELS} />
                  <a
                    href={`/pro/devis/${q.id}`}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ash transition hover:bg-raise hover:text-frost"
                  >
                    Détails →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal && (
        <QuoteModal
          onClose={() => setModal(false)}
          onCreated={() => {
            setModal(false);
            showToast("Devis créé avec succès.");
            load(filter);
          }}
        />
      )}
    </div>
  );
}

function QuoteModal({ onClose, onCreated }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState([]);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    proApi
      .get("/pro/catalog/")
      .then(({ data }) => setProducts(data))
      .catch(() => {});
  }, []);

  const filtered = products.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const addLine = (product) => {
    const existing = lines.find((l) => l.product_id === product.id);
    if (existing) {
      setLines(
        lines.map((l) =>
          l.product_id === product.id ? { ...l, quantity: Number(l.quantity) + 1 } : l
        )
      );
    } else {
      setLines([
        ...lines,
        {
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          price: Number(product.sale_price || 0),
          quantity: 1,
        },
      ]);
    }
  };

  const updateQty = (productId, quantity) => {
    setLines(lines.map((l) => (l.product_id === productId ? { ...l, quantity: Math.max(0.0001, Number(quantity)) } : l)));
  };

  const removeLine = (productId) =>
    setLines(lines.filter((l) => l.product_id !== productId));

  const total = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  const submit = async (e) => {
    e.preventDefault();
    if (lines.length === 0) {
      setError("Ajoutez au moins un produit.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await proApi.post("/pro/quotes/create/", {
        notes: notes || undefined,
        valid_until: validUntil || undefined,
        items: lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.price,
        })),
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.detail || "Impossible de créer le devis.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-panel shadow-2xl ring-1 ring-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-xl font-bold text-frost">Nouveau devis</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-ash hover:bg-raise hover:text-frost">
            ✕
          </button>
        </div>

        <div className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-2">
          {/* Product picker */}
          <div className="flex flex-col border-r border-line">
            <div className="border-b border-line p-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un produit (nom ou SKU)…"
                className="w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none placeholder:text-dim focus:border-amber/60"
              />
            </div>
            <div className="flex-1 divide-y divide-line overflow-y-auto">
              {filtered.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-frost">{p.name}</p>
                    <p className="text-xs text-dim">
                      {p.sku} · {fmtNum(p.volume_cubic_m)} m³/unité
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold text-ash">{fmtMAD(p.sale_price)}</span>
                    <button
                      onClick={() => addLine(p)}
                      className="rounded-lg bg-gradient-to-r from-amber to-copper px-2.5 py-1.5 text-xs font-bold text-ink"
                    >
                      + Ajouter
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-dim">Aucun produit trouvé.</p>
              )}
            </div>
          </div>

          {/* Lines + submit */}
          <div className="flex flex-col">
            <div className="flex-1 divide-y divide-line overflow-y-auto">
              {lines.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-dim">
                  Sélectionnez des produits pour composer votre devis.
                </p>
              ) : (
                lines.map((l) => (
                  <div key={l.product_id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-frost">{l.name}</p>
                      <p className="text-xs text-dim">{l.sku}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        value={l.quantity}
                        onChange={(e) => updateQty(l.product_id, e.target.value)}
                        className="w-20 rounded-lg border border-line bg-raise px-2 py-1 text-right text-sm text-frost outline-none focus:border-amber/60"
                      />
                      <span className="text-xs text-dim">× {fmtMAD(l.price)}</span>
                      <button
                        onClick={() => removeLine(l.product_id)}
                        className="rounded-lg px-2 py-1 text-xs text-rose hover:bg-rose/10"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-line p-4">
              {error && (
                <div className="mb-3 rounded-lg bg-rose/10 px-3 py-2 text-xs text-rose ring-1 ring-rose/30">
                  {error}
                </div>
              )}
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ash">Notes</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Référence projet, livraison…"
                    className="w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none placeholder:text-dim focus:border-amber/60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ash">Valable jusqu'au</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none focus:border-amber/60"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-dim">Total estimé</p>
                  <p className="font-display text-xl font-bold text-frost">{fmtMAD(total)}</p>
                </div>
                <button
                  onClick={submit}
                  disabled={saving || lines.length === 0}
                  className="rounded-lg bg-gradient-to-r from-amber to-copper px-5 py-2.5 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110 disabled:opacity-50"
                >
                  {saving ? "Création…" : "Envoyer la demande"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}