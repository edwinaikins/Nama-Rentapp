import { useState, useEffect } from "react";

let globalLogoUrl = "";
const listeners = new Set<(url: string) => void>();

export const getGlobalLogoUrl = () => globalLogoUrl;

export const setGlobalLogoUrl = (url: string) => {
  globalLogoUrl = url;
  listeners.forEach((l) => l(url));
};

export const useGlobalLogoUrl = () => {
  const [url, setUrl] = useState(globalLogoUrl);

  useEffect(() => {
    const listener = (newUrl: string) => setUrl(newUrl);
    listeners.add(listener);
    // Sync initial state
    setUrl(globalLogoUrl);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return url;
};
