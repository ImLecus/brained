import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AppConfig } from "../../shared/types";
import { getConfig, updateConfig } from "../api/client";

interface ConfigContextValue {
  config: AppConfig | null;
  update: (config: AppConfig) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getConfig().then((loaded) => {
      if (!cancelled) {
        setConfig(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (config) {
      document.documentElement.dataset.theme = config.theme;
    }
  }, [config]);

  const value = useMemo<ConfigContextValue>(
    () => ({
      config,
      update: async (next) => {
        const saved = await updateConfig(next);
        setConfig(saved);
      },
    }),
    [config],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within ConfigProvider");
  }
  return context;
}