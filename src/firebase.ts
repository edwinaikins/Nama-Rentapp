import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, setLogLevel } from "firebase/firestore";
import firebaseConfigBase from "../firebase-applet-config.json";

// The API key is intentionally NOT stored in firebase-applet-config.json.
// It's injected at build time from VITE_FIREBASE_API_KEY (see .env.example)
// so it never lives in source control. Firebase web API keys aren't secret
// in the sense of granting access on their own (access is enforced by
// Firestore security rules), but keeping it out of git avoids unrestricted,
// unrotated keys sitting in history indefinitely.
const firebaseConfig = {
  ...firebaseConfigBase,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigBase.apiKey,
};

if (!firebaseConfig.apiKey) {
  console.error(
    "VITE_FIREBASE_API_KEY is not set. Firebase will fail to initialize. See .env.example."
  );
}

// Suppress verbose background connection warnings in sandbox environment
setLogLevel("silent");

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with auto-detected long polling for sandbox stability
export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId || "(default)"
);

export const auth = getAuth(app);

// Firestore error details helper mapping
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn("Firestore Operation Notice: ", JSON.stringify(errInfo));
  return errInfo;
}



