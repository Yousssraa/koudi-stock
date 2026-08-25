import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import useDocumentTitle from "../hooks/useDocumentTitle.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Skeleton from "../components/Skeleton.jsx";

const ACTION_META = {
  create: { label: "Création", color: "text-jade bg-jade/10 ring-jade/30" },
  update: { label: "Mise à jour", color: "text-skyx bg-skyx/10 ring-skyx/30" },
  delete: { label: "Suppression", color: "text-rose bg-rose/10 ring-rose/30" },
  price_update: { label: "Prix", color: "text-amber bg-amber/10 ring-amber/30" },
  login: { label: "Connexion", color: "text-jade bg-jade/10 ring-jade/30" },
  logout: { label: "Déconnexion", color: "text-ash bg-raise ring-line" },
  download: { label: "Téléchargement", color: "text-amber bg-amber/10 ring-amber/30" },
  reorder: { label: "Réappro", color: "text-amber bg-amber/10 ring-amber/30" },
  transfer: { label: "Transfert", color: "text-skyx bg-skyx/10 ring-skyx/30" },
  close_month: { label: "Clôture mois", color: "text-rose bg-rose/10 ring-rose/30" },
  payment: { label: "Encaissement", color: "text-jade bg-jade/10 ring-jade/30" },
  credit_warning: { label: "Alerte crédit", color: "text-rose bg-rose/10 ring-rose/30" },
};

const ACTIONS = Object.keys(ACTION_META);
const ENTITIES = ["auth", "product", "inventory", "stock_movement", "sales_order", "purchase_order", "transfer", "product_label", "archive", "payment", "drying_batch", "price_tier"];
const TYPE_LABELS = {
  auth: "Authentification",
  product: "Produit",
  inventory: "Inventaire",
  stock_movement: "Mouvement",
  sales_order: "Vente",
  purchase_order: "Achat",
  transfer: "Transfert",
  product_label: "Étiquette produit",
  archive: "Archive mensuelle",
  payment: "Encaissement",
  drying_batch: "Lot de séchage",
  price_tier: "Barème remise",
};

export default function Audit() {
  useDocumentTitle("Journal d'Audit");
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [prev, setPrev] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [user, setUser] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    api
      .get("/auth/me/")
      .then((r) => setMe(r.data))
      .catch(() => setMe({ is_staff: false }));
  }, []);

  const load = useCallback(
    (pageUrl) => {
      setLoading(true);
      setError(null);
      const url = new URL(pageUrl || "/audit/", window.location.origin);
      const params = url.searchParams;
      params.set("page_size", 50);
      if (action) params.set("action", action);
      else params.delete("action");
      if (entity) params.set("entity_type", entity);
      else params.delete("entity_type");
      if (user) params.set("user", user);
      else params.delete("user");
      if (search) params.set("search", search);
      else params.delete("search");
      if (from) params.set("from", from);
      else params.delete("from");
      if (to) params.set("to", to);
      else params.delete("to");

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
    [action, entity, user, search, from, to]
  );

  useEffect(() => {
    if (me?.is_staff) load(null);
  }, [me, load]);

  const select =
    "rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium text-frost outline-none transition focus:border-amber/60";
  const input = `${select} w-full`;

  const applyFilters = (e) => {
    e.preventDefault();
    load(null);
  };

  if (me && !me.is_staff) {
    return (
      <div>
        <h1 className="mb-2 font-display text-2xl font-bold tracking-tight text-frost">Journal d'Audit</h1>
        <div className="rounded-xl bg-rose/10 p-5 text-sm text-rose ring-1 ring-rose/30">
          Accès réservé aux administrateurs. Contactez un responsable pour consulter la traçabilité des opérations.
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-frost">Journal d'Audit</h1>
          <p className="text-sm text-ash">
            Traçabilité complète : connexions, produits, mouvements, documents et réapprovisionnements.
          </p>
        </div>
        <span className="rounded-full bg-panel px-3 py-1.5 text-xs font-semibold text-ash ring-1 ring-line">
          {count} enregistrement(s)
        </span>
      </header>

      <form onSubmit={applyFilters} className="mb-5 grid grid-cols-1 gap-3 rounded-2xl bg-panel p-4 shadow-lg shadow-black/5 ring-1 ring-line sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <label className="mb-1 block text-xs font-semibold text-dim">Action</label>
          <select className={select} value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Toutes</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_META[a].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-dim">Entité</label>
          <select className={select} value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">Toutes</option>
            {ENTITIES.map((ent) => (
              <option key={ent} value={ent}>{TYPE_LABELS[ent] || ent}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-dim">Utilisateur</label>
          <input className={input} value={user} onChange={(e) => setUser(e.target.value)} placeholder="demo" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-dim">Recherche (réf./détails)</label>
          <input className={input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU, numéro…" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-dim">Du</label>
          <input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button type="submit" className="w-full rounded-lg bg-gradient-to-r from-amber to-copper px-4 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110">
            Filtrer
          </button>
        </div>
      </form>

      {error && <div className="mb-4 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon="✍" title="Aucun enregistrement" message="Aucune activité ne correspond à ces filtres." />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-panel shadow-lg shadow-black/5 ring-1 ring-line">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-dim">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Utilisateur</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Entité</th>
                <th className="px-4 py-3 font-semibold">Référence</th>
                <th className="px-4 py-3 font-semibold">Détails</th>
                <th className="px-4 py-3 text-right font-semibold">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {rows.map((r) => {
                const meta = ACTION_META[r.action] || { label: r.action, color: "text-ash bg-raise ring-line" };
                const details = r.details || null;
                return (
                  <tr key={r.id} className="align-top transition hover:bg-raise/40">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-ash">{r.created_at}</td>
                    <td className="px-4 py-3 font-medium text-frost">{r.user || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ash">{TYPE_LABELS[r.entity_type] || r.entity_type}</td>
                    <td className="px-4 py-3 font-mono text-xs text-amber">{r.entity_ref || "—"}</td>
                    <td className="max-w-[280px] px-4 py-3 text-xs text-dim">
                      {details ? <pre className="whitespace-pre-wrap font-sans">{JSON.stringify(details)}</pre> : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs text-dim">{r.ip_address || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(next || prev) && (
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-panel px-4 py-3 shadow-lg shadow-black/5 ring-1 ring-line">
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
    </div>
  );
}