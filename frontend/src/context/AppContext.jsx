import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api/client.js";
import { useToast } from "../components/ToastContext.jsx";
import { isAuthenticated, subscribeAuth } from "../auth.js";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [authed, setAuthed] = useState(isAuthenticated());

  useEffect(() => subscribeAuth(() => setAuthed(isAuthenticated())), []);

  useEffect(() => {
    if (!authed) {
      setWarehouses([]);
      setWarehouseId(null);
      return;
    }
    api
      .get("/warehouses/")
      .then((res) => {
        const list = res.data.results || res.data || [];
        setWarehouses(list);
        setWarehouseId((prev) => prev ?? list[0]?.id ?? null);
      })
      .catch(() => {
        setWarehouses([]);
        toast.error("Impossible de charger les dépôts.");
      });
  }, [authed, toast]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <AppContext.Provider
      value={{
        warehouses,
        warehouseId,
        setWarehouseId,
        refresh,
        refreshKey,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
