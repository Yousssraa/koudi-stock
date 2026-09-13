import { useEffect } from "react";

export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · KOUDI WOOD` : "KOUDI WOOD — Vente & Gestion de Stock du Bois";
  }, [title]);
}
