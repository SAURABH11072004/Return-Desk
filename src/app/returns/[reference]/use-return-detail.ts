"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, isAbort } from "@/lib/api-client";
import type { ReturnDetail } from "@/lib/api-types";

type Loaded = { key: string; data?: ReturnDetail; error?: unknown };

/**
 * Loads one request. After a mutation the API returns the updated request, which is swapped in
 * with `replace` (no extra round trip). `reload` refetches, e.g. after a 409 shows our copy is stale.
 */
export function useReturnDetail(reference: string) {
  const [reloadCount, setReloadCount] = useState(0);
  const key = `${reference}#${reloadCount}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<{ data: ReturnDetail }>(`/api/returns/${encodeURIComponent(reference)}`, { signal: controller.signal })
      .then(({ data }) => setLoaded({ key, data }))
      .catch((error) => {
        if (!isAbort(error)) setLoaded({ key, error });
      });
    return () => controller.abort();
  }, [reference, key]);

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);
  const replace = useCallback((data: ReturnDetail) => setLoaded((prev) => ({ key: prev?.key ?? key, data })), [key]);

  return {
    data: loaded?.data,
    error: loaded?.key === key ? loaded.error : undefined,
    loading: loaded?.key !== key,
    reload,
    replace,
  };
}
