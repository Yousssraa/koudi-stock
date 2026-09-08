import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import proApi from "../../api/proClient.js";
import { setProToken } from "../../authPro.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";

export default function ProRegister() {
  useDocumentTitle("Espace Pro — Inscription");
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    address: "",
    username: "",
    password: "",
    password2: "",
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (form.password && form.password !== form.password2) {
      setFieldErrors({ password2: "Les deux mots de passe ne correspondent pas." });
      return;
    }
    setLoading(true);
    try {
      const { data } = await proApi.post("/pro/auth/register/", {
        username: form.username.trim(),
        password: form.password,
        email: form.email.trim(),
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      });
      setProToken(data.token);
      navigate("/pro", { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) {
        setFieldErrors(data.errors);
      } else if (data?.detail) {
        setError(data.detail);
      } else {
        setError("Impossible de créer le compte pour le moment.");
      }
    } finally {
      setLoading(false);
    }
  };

  const input =
    "w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none transition placeholder:text-dim focus:border-amber/60 focus:ring-2 focus:ring-amber/20";
  const label = "mb-1 block text-xs font-semibold text-ash";
  const errText = "mt-1 block text-xs text-rose";

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-panel p-8 shadow-2xl shadow-black/40 ring-1 ring-line">
        <div className="mb-6 text-center">
          <img
            src="/koudi-mark.svg"
            alt="KOUDI"
            className="mx-auto h-14 w-14 rounded-2xl shadow-lg shadow-black/40 ring-1 ring-amber/40"
          />
          <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-frost">
            Créer un compte
          </h1>
          <p className="text-sm text-ash">
            Rejoignez l'Espace Pro : devis, commandes, factures et bien plus.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-rose/10 px-4 py-3 text-sm text-rose ring-1 ring-rose/30">{error}</div>
          )}
          <div>
            <label htmlFor="company_name" className={label}>Société *</label>
            <input
              id="company_name"
              value={form.company_name}
              onChange={set("company_name")}
              required
              autoFocus
              placeholder="Raison sociale"
              className={input}
            />
            {fieldErrors.company_name && <span className={errText}>{fieldErrors.company_name}</span>}
          </div>
          <div>
            <label htmlFor="contact_name" className={label}>Nom du contact</label>
            <input
              id="contact_name"
              value={form.contact_name}
              onChange={set("contact_name")}
              placeholder="Prénom et nom"
              className={input}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className={label}>E-mail *</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={set("email")}
                required
                autoComplete="email"
                placeholder="contact@societe.com"
                className={input}
              />
              {fieldErrors.email && <span className={errText}>{fieldErrors.email}</span>}
            </div>
            <div>
              <label htmlFor="phone" className={label}>Téléphone</label>
              <input
                id="phone"
                value={form.phone}
                onChange={set("phone")}
                placeholder="06 12 34 56 78"
                className={input}
              />
            </div>
          </div>
          <div>
            <label htmlFor="address" className={label}>Adresse</label>
            <input
              id="address"
              value={form.address}
              onChange={set("address")}
              placeholder="Adresse de la société"
              className={input}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="username" className={label}>Identifiant *</label>
              <input
                id="username"
                value={form.username}
                onChange={set("username")}
                required
                autoComplete="username"
                placeholder="Choisissez un identifiant"
                className={input}
              />
              {fieldErrors.username && <span className={errText}>{fieldErrors.username}</span>}
            </div>
            <div>
              <label htmlFor="password" className={label}>Mot de passe *</label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={set("password")}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="8 caractères minimum"
                className={input}
              />
              {fieldErrors.password && <span className={errText}>{fieldErrors.password}</span>}
            </div>
          </div>
          <div>
            <label htmlFor="password2" className={label}>Confirmer le mot de passe *</label>
            <input
              id="password2"
              type="password"
              value={form.password2}
              onChange={set("password2")}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Saisissez à nouveau le mot de passe"
              className={input}
            />
            {fieldErrors.password2 && <span className={errText}>{fieldErrors.password2}</span>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-amber to-copper px-4 py-2.5 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Création du compte…" : "S'inscrire et créer mon compte"}
          </button>
          <p className="text-center text-xs text-dim">
            Vous avez déjà un compte ?{" "}
            <Link to="/pro/login" className="text-amber hover:underline">
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}