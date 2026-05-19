import { useEffect, useState } from "react";
import type { Dataset } from "../types";

export function useInnerprintData(url = "/data/innerprint_daily.json") {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: Dataset) => setData(j))
      .catch((e) => setError(String(e)));
  }, [url]);

  return { data, error };
}
