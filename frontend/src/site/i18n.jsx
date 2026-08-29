import { createContext, useContext, useState } from "react";

const LangContext = createContext(null);

export function SiteLangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem("koudi_site_lang") || "fr";
    } catch {
      return "fr";
    }
  });

  const setLanguage = (l) => {
    setLang(l);
    try {
      localStorage.setItem("koudi_site_lang", l);
    } catch (_) {}
  };

  return (
    <LangContext.Provider value={{ lang, setLanguage }}>{children}</LangContext.Provider>
  );
}

export function useSiteLang() {
  return useContext(LangContext);
}

const DICT = {
  fr: {
    brand: "KOUDI WOOD",
    tagline: "Vente de bois massifs &amp; panneaux — découpe sur mesure",
    nav: {
      accueil: "Accueil",
      produits: "Nos Produits",
      boutiques: "Boutique",
      devis: "Devis &amp; Devis rapide",
      contact: "Contact",
      espacePro: "Espace Pro",
    },
    hero: {
      eyebrow: "Depuis Casablanca — bois massifs, panneaux &amp; dérivés",
      title1: "Le bois de qualité,",
      title2: "au bon prix et sur mesure.",
      subtitle:
        "Bois rouges et blancs, essences exotiques et nobles, panneaux et coffrage. Découpe sur mesure et livraison sur tout le Maroc.",
      ctaProducts: "Découvrir nos produits",
      ctaDevis: "Demander un devis",
    },
    common: {
      perM3: "par m³",
      outOfStock: "Rupture",
      lowStock: "Stock limité",
      inStock: "En stock",
      from: "À partir de",
      mad: "MAD",
      categories: "Nos gammes",
      allCategories: "Toutes les gammes",
      loading: "Chargement…",
      footerTagline: "Grossiste et distributeur de bois massifs et panneaux depuis Casablanca.",
    },
  },
  en: {
    brand: "KOUDI WOOD",
    tagline: "Solid wood &amp; panels — custom cutting",
    nav: {
      accueil: "Home",
      produits: "Our Products",
      boutiques: "Shop",
      devis: "Quote",
      contact: "Contact",
      espacePro: "Business Area",
    },
    hero: {
      eyebrow: "From Casablanca — solid wood, panels &amp; derivatives",
      title1: "Quality timber,",
      title2: "at the right price, cut to order.",
      subtitle:
        "Nordic red and white woods, exotic and noble species, panels and formwork. Custom cutting and delivery across Morocco.",
      ctaProducts: "Explore our products",
      ctaDevis: "Request a quote",
    },
    common: {
      perM3: "per m³",
      outOfStock: "Out of stock",
      lowStock: "Low stock",
      inStock: "In stock",
      from: "From",
      mad: "MAD",
      categories: "Our ranges",
      allCategories: "All ranges",
      loading: "Loading…",
      footerTagline:
        "Wholesale supplier of solid wood and panels from Casablanca.",
    },
  },
};

export function useT() {
  const { lang } = useSiteLang();
  return DICT[lang] || DICT.fr;
}
