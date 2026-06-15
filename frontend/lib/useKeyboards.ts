"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createKeyboard as apiCreate,
  deleteKeyboard as apiDelete,
  fetchKeyboards,
  updateKeyboard as apiUpdate,
} from "./api";
import { getUser, subscribe } from "./auth";
import {
  clearKeyboards,
  getKeyboards,
  setKeyboards,
  subscribeKeyboards,
} from "./keyboards";
import type { Keyboard, KeyboardLayout } from "./types";

export function useKeyboards() {
  const [keyboards, setLocal] = useState(getKeyboards);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!getUser()) {
      clearKeyboards();
      setLocal([]);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchKeyboards();
      setKeyboards(list);
      setLocal(list);
    } catch {
      /* keep cached list on transient errors */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => subscribeKeyboards(() => setLocal(getKeyboards())), []);

  useEffect(() => {
    const onAuth = () => {
      if (getUser()) void refresh();
      else {
        clearKeyboards();
        setLocal([]);
      }
    };
    onAuth();
    return subscribe(onAuth);
  }, [refresh]);

  const create = useCallback(
    async (name: string, layout: KeyboardLayout) => {
      const kb = await apiCreate(name, layout);
      await refresh();
      return kb;
    },
    [refresh]
  );

  const update = useCallback(
    async (
      id: string,
      patch: { name?: string; layout?: KeyboardLayout; isActive?: boolean }
    ) => {
      const kb = await apiUpdate(id, patch);
      await refresh();
      return kb;
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await apiDelete(id);
      await refresh();
    },
    [refresh]
  );

  const setActive = useCallback(
    async (id: string) => update(id, { isActive: true }),
    [update]
  );

  return {
    keyboards,
    activeKeyboard: keyboards.find((k) => k.isActive) ?? null,
    loading,
    refresh,
    create,
    update,
    remove,
    setActive,
  };
}

export type { Keyboard };
