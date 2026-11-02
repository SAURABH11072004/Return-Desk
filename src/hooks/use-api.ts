"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, isAbort } from "@/lib/api-client";

type Loaded<T> = { key: string; data?: T; error?: unknown };

/**
 * GET a JSON resource from our API. Each (path, reload) pair is one request; a newer request
 * aborts the older one, so a slow response can never overwrite a fresher one.
 *
 * - `data` keeps the last successful value while a new request is in flight (no flashing).
 * - `error` is the current request's error only.
 * - `mutate` swaps in a value the server already returned (e.g. after a POST), with no refetch.
 */
export function useApi<T>(path: string | null) {
  const [reloadCount, setReloadCount] = useState(0);
  const key = path === null ? null : `${path}#${reloadCount}`;
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);

  useEffect(() => {
    if (path === null || key === null) return;
    const controller = new AbortController();
    apiFetch<T>(path, { signal: controller.signal })
      .then((data) => setLoaded({ key, data }))
      .catch((error) => {
        if (!isAbort(error)) setLoaded((prev) => ({ key, data: prev?.data, error }));
      });
    return () => controller.abort();
  }, [path, key]);

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);
  const mutate = useCallback((data: T) => setLoaded((prev) => ({ key: prev?.key ?? key ?? "", data })), [key]);

  return {
    data: loaded?.data,
    error: loaded?.key === key ? loaded?.error : undefined,
    loading: key !== null && loaded?.key !== key,
    reload,
    mutate,
  };
}
