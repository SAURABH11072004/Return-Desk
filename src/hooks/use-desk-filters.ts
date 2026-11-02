"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { ReturnReason, ReturnStatus } from "@/lib/domain";

const SEARCH_DEBOUNCE_MS = 350;

/**
 * The desk's search / filter / sort / page state. The URL query string is the single source of
 * truth: it is shareable, survives reloads, works with Back, and is forwarded as-is to
 * GET /api/returns, which does all the filtering in SQL.
 */
export function useDeskFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const queryString = params.toString();
  const status = (params.get("status") ?? "").split(",").filter(Boolean) as ReturnStatus[];
  const reason = (params.get("reason") ?? "") as ReturnReason | "";
  const sort = params.get("sort") ?? "createdAt";
  const dir = params.get("dir") ?? "desc";
  const urlSearch = params.get("q") ?? "";

  const update = useCallback(
    (changes: Record<string, string | null>, { resetPage = true } = {}) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (resetPage) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  // The search box is typed freely and only pushed to the URL once the user pauses.
  const [search, setSearch] = useState(urlSearch);
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const pushedSearch = useRef(urlSearch);
  useEffect(() => {
    if (debouncedSearch === pushedSearch.current) return;
    pushedSearch.current = debouncedSearch;
    update({ q: debouncedSearch || null });
  }, [debouncedSearch, update]);
  // Back/forward changes the URL under us: mirror it, but never overwrite text typed since our own push.
  useEffect(() => {
    if (urlSearch === pushedSearch.current) return;
    pushedSearch.current = urlSearch;
    setSearch(urlSearch);
  }, [urlSearch]);

  const clearAll = useCallback(() => {
    setSearch("");
    pushedSearch.current = "";
    update({ q: null, status: null, reason: null });
  }, [update]);

  return {
    queryString,
    search,
    setSearch,
    /** True while typed text has not yet been applied to the URL. */
    searchPending: search.trim() !== urlSearch,
    appliedSearch: urlSearch,
    clearSearch: () => {
      setSearch("");
      pushedSearch.current = "";
      update({ q: null });
    },
    status,
    setStatus: (next: ReturnStatus[]) => update({ status: next.join(",") || null }),
    reason,
    setReason: (next: ReturnReason | "") => update({ reason: next || null }),
    sort: `${sort}:${dir}`,
    setSort: (value: string) => {
      const [s, d] = value.split(":");
      update({ sort: s, dir: d });
    },
    setPage: (page: number) => update({ page: page > 1 ? String(page) : null }, { resetPage: false }),
    hasFilters: Boolean(urlSearch || status.length || reason),
    clearAll,
  };
}

export type DeskFilters = ReturnType<typeof useDeskFilters>;
