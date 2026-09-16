import { useCallback, useEffect, useState } from "react";
import type { BrainStatus } from "../../shared/types";
import { closeBrain, createBrain, getBrainStatus, openBrain } from "../api/client";

export function useBrain() {
  const [status, setStatus] = useState<BrainStatus | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await getBrainStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async (name: string, password: string): Promise<void> => {
    setStatus(await createBrain(name, password));
  };

  const open = async (path: string, password: string): Promise<void> => {
    setStatus(await openBrain(path, password));
  };

  const close = async (): Promise<void> => {
    try {
      setStatus(await closeBrain());
    } catch {
      await refresh();
    }
  };

  return { status, refresh, create, open, close };
}