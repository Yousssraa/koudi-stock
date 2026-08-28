import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import { useApp } from "../context/AppContext.jsx";
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

const CLIENT_EMPTY = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  tax_id: "",
  payment_terms: "Paiement à 30 jours",
  payment_terms_days: 30,
  credit_limit: "",
  is_blocked: false,
  is_active: true,
};

const SUPPLIER_EMPTY = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  tax_id: "",
  payment_terms: "",
  is_active: true,
};

export default function Contacts() {
  const { refreshKey } = useApp();
  const toast = useToast();
  useDocumentTitle("Clients & Fournisseurs");

  const [tab, setTab] = useState("client");
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { mode: "create" | "edit", item }
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // item to delete

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get("/clients/", { params: { page_size: 300 } }),
      api.get("/suppliers/", { params: { page_size: 300 } }),
    ])
      .then(([cRes, sRes]) => {
        setClients(cRes.data.results || cRes.data || []);
        setSuppliers(sRes.data.results || sRes.data || []);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message || "Impossible de charger les contacts.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const openCreate = () => {
    setForm(tab === "client" ? { ...CLIENT_EMPTY } : { ...SUPPLIER_EMPTY });
    setModal({ mode: "create", item: null });
  };

  const openEdit = (item) => {
    setForm(
      tab === "client"
        ? {
            company_name: item.company_name || "",
            contact_name: item.contact_name || "",
            email: item.email || "",
            phone: item.phone || "",
            address: item.address || "",
            tax_id: item.tax_id || "",
            payment_terms: item.payment_terms || "",
            payment_terms_days: item.payment_terms_days ?? 30,
            credit_limit: item.credit_limit ?? "",
            is_blocked: item.is_blocked,
            is_active: item.is_active,
          }
        : {
            company_name: item.company_name || "",
            contact_name: item.contact_name || "",
            email: item.email || "",
            phone: item.phone || "",
            address: item.address || "",
            tax_id: item.tax_id || "",
            payment_terms: item.payment_terms || "",
            is_active: item.is_active,
          }
    );
    setModal({ mode: "edit", item });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isClient = tab === "client";
      const payload = { ...form };
      if (isClient) {
        payload.credit_limit = payload.credit_limit === "" ? 0 : payload.credit_limit;
        payload.payment_terms_days = Number(payload.payment_terms_days) || undefined;
      }
      if (modal.mode === "edit") {
        await api.patch(`/${isClient ? "clients" : "suppliers"}/${modal.item.id}/`, payload);
        toast.success(`${isClient ? "Client" : "Fournisseur"} mis à jour.`);
      } else {
        await api.post(`/${isClient ? "clients" : "suppliers"}/`, payload);
        toast.success(`${isClient ? "Client" : "Fournisseur"} créé.`);
      }
      setModal(null);
      load();
    } catch (err) {
      const d = err.response?.data;
      toast.error((d && (d.detail || Object.values(d).flat().join(" "))) || "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      const isClient = tab === "client";
      await api.delete(`/${isClient ? "clients" : "suppliers"}/${confirmDelete.id}/`);
      toast.success(`${isClient ? "Client" : "Fournisseur"} supprimé.`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Impossible de supprimer ce contact.");
      setConfirmDelete(null);
    }
  };

  const rows = tab === "client" ? clients : suppliers;
  const isClient = tab === "client";

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-frost">Clients &amp; Fournisseurs</h1>
          <p className="text-sm text-ash">Gérez vos partenaires : coordonnées, plafond de crédit et conditions de paiement.</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-gradient-to-r from-amber to-copper px-4 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110"
        >
          + Nouveau {isClient ? "Client" : "Fournisseur"}
        </button>
      </header>

      <div className="mb-5 flex gap-2">
        {[
          { key: "client", label: `Clients (${clients.length})` },
          { key: "supplier", label: `Fournisseurs (${suppliers.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? "bg-gradient-to-r from-amber to-copper text-ink shadow-lg shadow-amber/20"
                : "bg-panel text-ash ring-1 ring-line hover:bg-raise hover:text-frost"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose/10 p-4 text-sm text-rose ring-1 ring-rose/30">{error}</div>
      )}

      {loading ? (
        <Skeleton className="h-48" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={isClient ? "%" : "↓"}
          title={isClient ? "Aucun client" : "Aucun fournisseur"}
          message={isClient ? "Créez vos clients pour facturer vos ventes." : "Créez vos fournisseurs pour vos commandes d'achat."}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-panel shadow-lg shadow-black/20 ring-1 ring-line">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-line text-dim">
                <th className="px-4 py-2.5 font-medium">Code</th>
                <th className="px-4 py-2.5 font-medium">Raison sociale</th>
                <th className="px-4 py-2.5 font-medium">Contact</th>
                <th className="px-4 py-2.5 font-medium">Email / Tél</th>
                {isClient && <th className="px-4 py-2.5 text-right font-medium">Plafond MAD</th>}
                {isClient && <th className="px-4 py-2.5 text-right font-medium">Impayé MAD</th>}
                <th className="px-4 py-2.5 text-center font-medium">Statut</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-raise/40">
                  <td className="px-4 py-2.5 font-mono text-dim">{r.code}</td>
                  <td className="px-4 py-2.5 font-medium text-frost">{r.company_name}</td>
                  <td className="px-4 py-2.5 text-ash">{r.contact_name || "—"}</td>
                  <td className="px-4 py-2.5 text-ash">
                    <div>{r.email || "—"}</div>
                    <div className="text-dim">{r.phone || ""}</div>
                  </td>
                  {isClient && (
                    <td className="px-4 py-2.5 text-right font-semibold text-frost">
                      {fmt(r.credit_limit || 0, 0)}
                    </td>
                  )}
                  {isClient && (
                    <td className={`px-4 py-2.5 text-right font-semibold ${Number(r.outstanding) > 0 ? "text-rose" : "text-dim"}`}>
                      {fmt(r.outstanding || 0, 0)}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${
                        isClient && r.is_blocked
                          ? "bg-rose/10 text-rose ring-rose/30"
                          : r.is_active
                            ? "bg-jade/10 text-jade ring-jade/30"
                            : "bg-ash/10 text-ash ring-ash/30"
                      }`}
                    >
                      {isClient && r.is_blocked ? "Bloqué" : r.is_active ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(r)}
                        className="rounded-md border border-line px-2.5 py-1 text-[11px] font-semibold text-ash transition hover:border-amber/40 hover:text-amber"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => setConfirmDelete(r)}
                        className="rounded-md border border-line px-2.5 py-1 text-[11px] font-semibold text-dim transition hover:border-rose/40 hover:text-rose"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setModal(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-panel shadow-xl shadow-black/40 ring-1 ring-line"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-line bg-panel px-6 py-4">
              <h2 className="font-display text-lg font-bold text-frost">
                {modal.mode === "edit" ? "Modifier" : "Nouveau"} {isClient ? "Client" : "Fournisseur"}
              </h2>
              <button onClick={() => setModal(null)} className="text-dim transition hover:text-frost" aria-label="Fermer">
                ✕
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4 px-6 py-6">
              <div>
                <label className={label}>Raison sociale *</label>
                <input
                  required
                  value={form.company_name || ""}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  className={input}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Personne de contact</label>
                  <input
                    value={form.contact_name || ""}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Téléphone</label>
                  <input
                    value={form.phone || ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={input}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Email</label>
                  <input
                    type="email"
                    value={form.email || ""}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Identifiant fiscal / ICE</label>
                  <input
                    value={form.tax_id || ""}
                    onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                    className={input}
                  />
                </div>
              </div>
              {isClient && (
                <div>
                  <label className={label}>Plafond de crédit (MAD)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.credit_limit ?? ""}
                    onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                    className={input}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Conditions de paiement</label>
                  <input
                    value={form.payment_terms || ""}
                    onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                    placeholder={isClient ? "Paiement à 30 jours" : ""}
                    className={input}
                  />
                </div>
                {isClient && (
                  <div>
                    <label className={label}>Délai (jours)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.payment_terms_days ?? ""}
                      onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })}
                      className={input}
                    />
                  </div>
                )}
              </div>
              <div>
                <label className={label}>Adresse</label>
                <textarea
                  value={form.address || ""}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  className={input}
                />
              </div>
              <div className="flex items-center gap-5 pt-1">
                <label className="flex items-center gap-2 text-sm text-ash">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="accent-amber"
                  />
                  Actif
                </label>
                {isClient && (
                  <label className="flex items-center gap-2 text-sm text-ash">
                    <input
                      type="checkbox"
                      checked={form.is_blocked}
                      onChange={(e) => setForm({ ...form, is_blocked: e.target.checked })}
                      className="accent-rose"
                    />
                    Bloquer (refuser les ventes)
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-ash transition hover:bg-raise"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-gradient-to-r from-amber to-copper px-5 py-2 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110 disabled:opacity-60"
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-panel shadow-xl shadow-black/40 ring-1 ring-line"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-line bg-raise px-6 py-4">
              <h2 className="font-display text-lg font-bold text-frost">Supprimer le contact</h2>
            </div>
            <div className="px-6 py-5 text-sm text-ash">
              Confirmer la suppression de <strong className="text-frost">{confirmDelete.company_name}</strong> ?
              Cette action est irréversible.
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-ash transition hover:bg-raise"
              >
                Annuler
              </button>
              <button
                onClick={doDelete}
                className="rounded-lg bg-gradient-to-r from-rose to-copper px-5 py-2 text-sm font-semibold text-ink shadow-lg shadow-rose/20 transition hover:brightness-110"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
