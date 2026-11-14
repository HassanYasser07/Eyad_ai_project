import React from "react";
import { fetchIconLibrary } from "@/services/iconLibraryService";

/** Loads the icon library (categories + icons) once; `reload` retries after an error. */
export default function useIconLibrary(enabled = true) {
  const [state, setState] = React.useState({ categories: [], loading: enabled, error: null });

  const load = React.useCallback((force = false) => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    fetchIconLibrary({ force })
      .then((categories) => { if (!cancelled) setState({ categories, loading: false, error: null }); })
      .catch((error) => { if (!cancelled) setState({ categories: [], loading: false, error }); });
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => (enabled ? load(false) : undefined), [enabled, load]);

  return { ...state, reload: () => load(true) };
}
