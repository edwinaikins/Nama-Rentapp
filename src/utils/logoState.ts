import { useState, useEffect } from "react";

let globalLogoUrl = "";
// Whether the app has received its first response (a real uploaded logo,
// or a confirmed "none set yet") from the global_logo Firestore listener.
// Starts false so callers can show a loading state instead of flashing
// the fallback seal for a moment before a real uploaded logo pops in.
let globalLogoLoaded = false;

const urlListeners = new Set<(url: string) => void>();
const loadedListeners = new Set<(loaded: boolean) => void>();

export const getGlobalLogoUrl = () => globalLogoUrl;

export const setGlobalLogoUrl = (url: string) => {
  globalLogoUrl = url;
  urlListeners.forEach((l) => l(url));
  if (!globalLogoLoaded) {
    globalLogoLoaded = true;
    loadedListeners.forEach((l) => l(true));
  }
};

export const useGlobalLogoUrl = () => {
  const [url, setUrl] = useState(globalLogoUrl);

  useEffect(() => {
    const listener = (newUrl: string) => setUrl(newUrl);
    urlListeners.add(listener);
    // Sync initial state
    setUrl(globalLogoUrl);
    return () => {
      urlListeners.delete(listener);
    };
  }, []);

  return url;
};

export const useGlobalLogoLoaded = () => {
  const [loaded, setLoaded] = useState(globalLogoLoaded);

  useEffect(() => {
    const listener = (isLoaded: boolean) => setLoaded(isLoaded);
    loadedListeners.add(listener);
    setLoaded(globalLogoLoaded);
    return () => {
      loadedListeners.delete(listener);
    };
  }, []);

  return loaded;
};
