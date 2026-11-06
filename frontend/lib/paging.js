"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { API_URL } from "@/lib/api";

// The current page number, kept in the URL so reloading or coming back from a detail page
// lands on the same page. useSearchParams needs a Suspense boundary in a client page.
export function usePageParam(name = "page") {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const page = Math.max(1, Math.floor(Number(params.get(name))) || 1);

  const setPage = useCallback(
    (next) => {
      const search = new URLSearchParams(window.location.search);
      if (next > 1) search.set(name, String(next));
      else search.delete(name);
      const query = search.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [name, pathname, router]
  );

  return [page, setPage];
}

// One page of a list endpoint that answers { [key]: rows, pagination }. The current rows stay
// on screen while the next page loads, so the list doesn't flash.
export function usePagedList(path, key, { page = 1, pageSize, params = {} } = {}) {
  const [state, setState] = useState({ items: null, pagination: null, error: "" });
  const [version, setVersion] = useState(0);

  const search = new URLSearchParams();
  search.set("page", String(page));
  if (pageSize) search.set("pageSize", String(pageSize));
  for (const [name, value] of Object.entries(params)) {
    if (value) search.set(name, value);
  }
  const url = `${API_URL}${path}?${search}`;

  useEffect(() => {
    let stale = false;
    fetch(url, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        if (!stale) setState({ items: data[key], pagination: data.pagination, error: "" });
      })
      .catch((err) => {
        if (stale) return;
        const error = err instanceof TypeError ? "This list couldn't load. Check your connection and try again." : err.message;
        setState((s) => ({ ...s, items: s.items ?? [], error }));
      });
    return () => {
      stale = true;
    };
  }, [url, key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, loading: state.items === null, reload };
}
