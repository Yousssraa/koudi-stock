import { Link } from "react-router-dom";
import useDocumentTitle from "../hooks/useDocumentTitle.jsx";

export default function NotFound() {
  useDocumentTitle("Page introuvable");
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="font-display bg-gradient-to-r from-amber to-copper bg-clip-text text-7xl font-bold text-transparent">
        404
      </p>
      <h1 className="font-display mt-3 text-xl font-bold text-frost">Page introuvable</h1>
      <p className="mt-1 text-sm text-ash">La page que vous cherchez n'existe pas ou a été déplacée.</p>
      <Link
        to="/"
        className="mt-6 rounded-lg bg-gradient-to-r from-amber to-copper px-5 py-2.5 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:brightness-110"
      >
        ← Retour au Tableau de bord
      </Link>
    </div>
  );
}
