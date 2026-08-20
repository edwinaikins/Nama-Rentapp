import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { ApplicationMedia } from "../types";

// Fetches the heavy base64 image/document blobs for a single application
// from the application_media/{applicationId} collection. Deliberately a
// one-shot getDoc, not a live onSnapshot listener: this data is opened by
// one staff member at a time (a detail view), doesn't need realtime sync
// across sessions, and a listener here would recreate exactly the payload
// problem this collection split was meant to solve if a caller ever
// mounted it somewhere broad (a list, a table). Fetch on demand, once,
// when a detail view opens for a specific application.
export function useApplicationMedia(applicationId: string | null | undefined) {
  const [media, setMedia] = useState<ApplicationMedia | null>(null);
  const [loading, setLoading] = useState(!!applicationId);

  useEffect(() => {
    if (!applicationId) {
      setMedia(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getDoc(doc(db, "application_media", applicationId))
      .then((snap) => {
        if (cancelled) return;
        setMedia(snap.exists() ? (snap.data() as ApplicationMedia) : null);
      })
      .catch((error) => {
        console.warn(`Failed to fetch application_media/${applicationId}:`, error);
        if (!cancelled) setMedia(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  // Lets a caller that just wrote new media locally patch the cached
  // state immediately instead of waiting on a refetch.
  const setMediaField = (patch: Partial<ApplicationMedia>) => {
    setMedia((prev) => ({ ...(prev || { updatedAt: new Date().toISOString() }), ...patch }));
  };

  return { media, loading, setMediaField };
}
