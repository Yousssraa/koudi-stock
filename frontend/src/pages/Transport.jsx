import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import { downloadPdf } from "../api/download.js";
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "../components/ToastContext.jsx";
import useDocumentTitle from "../hooks/useDocumentTitle.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Skeleton from "../components/Skeleton.jsx";
import ShipmentModal from "../components/ShipmentModal.jsx";
import ClientModal from "../components/ClientModal.jsx";

const fmt = (n, d = 2) =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const STATUS_BADGE = {
  preparation: "bg-amber/10 text-amber ring-amber/30",
  in_transit: "bg-skyx/10 text-skyx ring-skyx/30",
  delivered: "bg-jade/10 text-jade ring-jade/30",
};
const STATUS_ORDER = ["preparation", "in_transit", "delivered"];
const STATUS_NEXT = { preparation: "in_transit", in_transit: "delivered" };

function StatusPill({ status }) {
  const label = { preparation: "En préparation", in_transit: "En cours", delivered: "Livré" }[status] || status;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_BADGE[status] || STATUS_BADGE.preparation}`}>
      {label}
    </span>
  );
}

export default function Transport() {
  const { warehouses, warehouseId, refresh } = useApp();
  const toast = useToast();
  useDocumentTitle("Transport & Logistique");

  const [tab, setTab] = useState("livraisons");
  const [bls, setBls] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [shipOpen, setShipOpen] = useState(false);
  const [clientModal, setClientModal] = useState(null); // null | {client?}
  const [acting, setActing] = useState(null);

  const loadBls = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get(statusFilter ? `/delivery-notes/?status=${statusFilter}` : "/delivery-notes/")
      .then((r) => setBls(r.data.results || r.data || []))
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const loadClients = useCallback(() => {
    api
      .get("/clients/", { params: { page_size: 200 } })
      .then((r) => setClients(r.data.results || r.data || []))
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    loadBls();
  }, [loadBls]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const onShipSaved = (bl) => {
    toast.success(`Bon de livraison ${bl.bl_number} créé.`);
    refresh();
    loadBls();
  };
  const onClientSaved = (kind) => {
    toast.success(`Client ${kind}.`);
    loadClients();
  };

  const advance = async (bl, next) => {
    setActing(bl.id);
    try {
      const { data } = await api.post(`/delivery-notes/${bl.id}/status/`, { status: next });
      toast.success(`BL ${data.bl_number} → ${data.status_label}.`);
      loadBls();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec du changement de statut.");
    } finally {
      setActing(null);
    }
  };

  const printBl = async (bl) => {
    try {
      await downloadPdf(`/delivery-notes/${bl.id}/pdf/`, `${bl.bl_number}_BON_DE_LIVRAISON.pdf`);
      toast.success("PDF généré.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de la génération du PDF.");
    }
  };

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-frost">Transport &amp; Logistique</h1>
          <p className="text-sm text-ash">Bons de livraison, expéditions et gestion des clients.</p>
        </div>
        <button
          onClick={() => setShipOpen(true)}
          className="rounded-lg bg-gradient-to-r from-amber to-copper px-4 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110"
        >
          + Nouvelle livraison
        </button>
      </header>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-panel p-1 ring-1 ring-line">
        {[
          { key: "livraisons", label: "Livraisons" },
          { key: "clients", label: "Clients" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.key ? "bg-gradient-to-r from-amber to-copper text-ink" : "text-ash hover:text-frost"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "livraisons" ? (
        <>
          {/* Status filter */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {[
              { key: "", label: "Tous" },
              { key: "preparation", label: "En préparation" },
              { key: "in_transit", label: "En cours" },
              { key: "delivered", label: "Livré" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ${
                  statusFilter === s.key
                    ? "bg-gradient-to-r from-amber to-copper text-ink ring-transparent"
                    : "bg-panel text-ash ring-line hover:bg-raise"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {error && <div className="mb-4 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>}

          {loading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : bls.length === 0 ? (
            <EmptyState
              icon="🚚"
              title="Aucune livraison"
              message="Créez une nouvelle livraison pour générer un bon de livraison."
            />
          ) : (
            <div className="space-y-3">
              {bls.map((bl) => (
                <article key={bl.id} className="rounded-2xl bg-panel p-5 shadow-lg shadow-black/20 ring-1 ring-line">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-display text-base font-bold text-frost">{bl.bl_number}</h3>
                        <StatusPill status={bl.status} />
                      </div>
                      <p className="mt-0.5 text-sm text-ash">
                        {bl.client} · {bl.warehouse} · {new Date(bl.order_date).toLocaleDateString("fr-FR")}
                      </p>
                      <p className="mt-0.5 text-xs text-dim">
                        Chauffeur : {bl.driver_name || "—"} · Véhicule : {bl.truck_plate || "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-dim">Volume</p>
                      <p className="font-display text-xl font-bold text-amber">{fmt(bl.total_volume_m3, 3)} m³</p>
                      <p className="text-xs text-dim">Total {fmt(bl.total_amount, 0)} MAD</p>
                    </div>
                  </div>

                  {bl.items.length > 0 && (
                    <div className="mt-4 space-y-1 rounded-xl bg-raise/50 p-3 ring-1 ring-line">
                      {bl.items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between text-sm">
                          <span className="text-ash">
                            <span className="font-mono text-xs text-dim">{it.sku}</span> · {it.product}
                          </span>
                          <span className="text-xs text-dim">
                            {fmt(it.quantity)} · {fmt(it.volume_m3, 3)} m³
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => printBl(bl)}
                      className="rounded-lg bg-gradient-to-r from-amber to-copper px-4 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110"
                    >
                      🖨 Générer le PDF
                    </button>
                    {STATUS_NEXT[bl.status] && (
                      <button
                        onClick={() => advance(bl, STATUS_NEXT[bl.status])}
                        disabled={acting === bl.id}
                        className="rounded-lg border border-line bg-panel px-4 py-2 text-sm font-semibold text-ash transition hover:bg-raise hover:text-frost disabled:opacity-50"
                      >
                        {acting === bl.id ? "…" : bl.status === "preparation" ? "→ Expédier (En cours)" : "→ Marquer Livré"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-dim">{clients.length} client(s) destinataire(s)</p>
            <button
              onClick={() => setClientModal({ client: null })}
              className="rounded-lg border border-amber/40 bg-panel px-4 py-2 text-sm font-semibold text-amber transition hover:bg-amber/10"
            >
              + Nouveau client
            </button>
          </div>
          {clients.length === 0 ? (
            <EmptyState icon="✉" title="Aucun client" message="Ajoutez un client pour pouvoir lui expédier des livraisons." />
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-raise">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Nom</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Contact</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Tél</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Adresse</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-dim">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b border-line/50 transition hover:bg-raise/40">
                      <td className="px-4 py-3 font-semibold text-frost">{c.company_name}</td>
                      <td className="px-4 py-3 text-ash">{c.contact_name || "—"}</td>
                      <td className="px-4 py-3 text-ash">{c.phone || "—"}</td>
                      <td className="px-4 py-3 text-ash">{c.address || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setClientModal({ client: c })}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ash transition hover:bg-raise hover:text-amber"
                        >
                          Modifier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ShipmentModal
        open={shipOpen}
        onClose={() => setShipOpen(false)}
        clients={clients}
        warehouses={warehouses}
        defaultWarehouseId={warehouseId}
        onSaved={onShipSaved}
      />
      <ClientModal
        open={Boolean(clientModal)}
        onClose={() => setClientModal(null)}
        client={clientModal?.client}
        onSaved={onClientSaved}
      />
    </div>
  );
}
