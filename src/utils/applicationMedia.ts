import { doc, setDoc, deleteField } from "firebase/firestore";
import { db } from "../firebase";
import { ApplicationMedia } from "../types";

// Writes (merges) heavy base64 fields onto application_media/{applicationId}
// instead of the applications document itself — see ApplicationMedia in
// types.ts for why this collection exists. Callers should follow this up
// with a local state update (e.g. useApplicationMedia's setMediaField)
// rather than waiting on a refetch, since this collection isn't watched by
// a live listener.
export async function saveApplicationMedia(applicationId: string, patch: Partial<ApplicationMedia>) {
  await setDoc(
    doc(db, "application_media", applicationId),
    { ...patch, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

// Removes specific fields from an application's media doc (e.g. deleting an
// uploaded scanned document) using Firestore's deleteField() sentinel, so
// the field is actually unset rather than merely set to null/undefined.
export async function clearApplicationMediaFields(applicationId: string, fields: (keyof ApplicationMedia)[]) {
  const patch: Record<string, any> = { updatedAt: new Date().toISOString() };
  fields.forEach((f) => {
    patch[f as string] = deleteField();
  });
  await setDoc(doc(db, "application_media", applicationId), patch, { merge: true });
}
