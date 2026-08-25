import { useEffect } from "react";

export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · KOUDI STOCK` : "KOUDI STOCK — Vente & Gestion de Stock du Bois";
  }, [title]);
}
