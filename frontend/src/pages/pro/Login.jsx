import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import proApi from "../../api/proClient.js";
import { setProToken } from "../../authPro.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.jsx";

export default function ProLogin() {
  useDocumentTitle("Espace Pro — Connexion");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await proApi.post("/pro/auth/login/", {
        username: username.trim(),
        password: password.trim(),
      });
      setProToken(data.token);
      navigate("/pro", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.response?.data?.non_field_errors?.[0] ||
          "Impossible de se connecter au serveur."
      );
    } finally {
      setLoading(false);
    }
  };

  const input =
    "w-full rounded-lg border border-line bg-raise px-3 py-2 text-sm text-frost outline-none transition placeholder:text-dim focus:border-amber/60 focus:ring-2 focus:ring-amber/20";
  const label = "mb-1 block text-xs font-semibold text-ash";

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm rounded-2xl bg-panel p-8 shadow-2xl shadow-black/40 ring-1 ring-line">
        <div className="mb-6 text-center">
          <img
            src="/koudi-mark.svg"
            alt="KOUDI"
            className="mx-auto h-14 w-14 rounded-2xl shadow-lg shadow-black/40 ring-1 ring-amber/40"
          />
          <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-frost">
            Espace Pro
          </h1>
          <p className="text-sm text-ash">Espace réservé aux clients professionnels</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-rose/10 px-4 py-3 text-sm text-rose ring-1 ring-rose/30">{error}</div>
          )}
          <div>
            <label className={label}>Identifiant</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={input}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-amber to-copper px-4 py-2.5 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Connexion…" : "Accéder à mon espace"}
          </button>
          <p className="text-center text-xs text-dim">
            Vous n'avez pas de compte ?{" "}
            <Link to="/contact" className="text-amber hover:underline">
              Contactez-nous
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}