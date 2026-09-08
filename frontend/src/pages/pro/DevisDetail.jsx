import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import proApi from "../../api/proClient.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import { fmtDate, fmtMAD, fmtNum, QUOTE_BADGES, QUOTE_LABELS, StatusBadge } from "./helpers.jsx";

export default function ProDevisDetail() {
  useDocumentTitle("Espace Pro — Devis");
  const { id } = useParams();
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(() => {
    setQuote(null);
    setError(null);
    proApi
      .get(`/pro/quotes/${id}/`)
      .then(({ data }) => setQuote(data))
      .catch((err) =>
        setError(err.response?.data?.detail || "Impossible de charger ce devis.")
      );
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async () => {
    if (!window.confirm("Supprimer définitivement ce brouillon ?")) return;
    try {
      await proApi.delete(`/pro/quotes/${id}/`);
      showToast("Devis supprimé.");
      setTimeout(() => (window.location.href = "/pro/devis"), 800);
    } catch (err) {
      setError(err.response?.data?.detail || "Impossible de supprimer ce devis.");
    }
  };

  if (error) {
    return (
      <div className="rounded-2xl bg-rose/10 px-5 py-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>
    );
  }

  if (!quote) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const totalVolume = quote.items.reduce((s, i) => s + (i.volume_m3 || 0), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/pro/devis" className="text-sm font-medium text-amber hover:underline">
            ← Tous mes devis
          </Link>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-frost">
            {quote.quote_number}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={quote.status} map={QUOTE_BADGES} labels={QUOTE_LABELS} />
          {quote.status === "draft" && (
            <button
              onClick={handleDelete}
              className="rounded-lg border border-rose/40 px-3 py-1.5 text-xs font-semibold text-rose transition hover:bg-rose/10"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="rounded-lg bg-jade/10 px-4 py-3 text-sm text-jade ring-1 ring-jade/30">
          {toast}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-dim">Créé le</p>
            <p className="text-sm font-semibold text-frost">{fmtDate(quote.created_at)}</p>
          </div>
          {quote.valid_until && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-dim">Valable jusqu'au</p>
              <p className="text-sm font-semibold text-frost">{fmtDate(quote.valid_until)}</p>
            </div>
          )}
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-dim">Total m³</p>
            <p className="text-sm font-semibold text-frost">{fmtNum(totalVolume)} m³</p>
          </div>
        </div>

        <div className="divide-y divide-line">
          {quote.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate font-semibold text-frost">{item.product}</p>
                <p className="text-xs text-dim">
                  {item.sku} · {fmtNum(item.quantity)} unité{item.quantity > 1 ? "s" : ""}
                  {item.volume_m3 ? ` · ${fmtNum(item.volume_m3)} m³` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-dim">{fmtMAD(item.unit_price)} / m³</p>
                <p className="text-sm font-bold text-frost">{fmtMAD(item.line_total)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-line px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ash">Total</span>
            <span className="font-display text-2xl font-bold text-frost">{fmtMAD(quote.total_amount)}</span>
          </div>
        </div>
      </div>

      {quote.notes && (
        <div className="rounded-2xl bg-panel px-5 py-4 shadow-lg shadow-black/20 ring-1 ring-line">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-dim">Notes</p>
          <p className="text-sm text-frost">{quote.notes}</p>
        </div>
      )}

      {quote.status !== "draft" && (
        <p className="text-center text-sm text-dim">
          Ce devis a été reçu par notre équipe.{" "}
          <Link to="/pro/devis" className="text-amber hover:underline">
            Voir tous mes devis
          </Link>
        </p>
      )}
    </div>
  );
}