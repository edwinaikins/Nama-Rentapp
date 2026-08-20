import React, { useState } from "react";
import { collection, getDocs, doc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "../firebase";
import { saveApplicationMedia } from "../utils/applicationMedia";
import { Database, ShieldAlert, CheckCircle2, AlertTriangle, PlayCircle, Loader2 } from "lucide-react";

// The 5 collections the dashboard's realtime listeners subscribe to (see
// App.tsx's "applications-sync" effect). `applications` is the only one the
// current app ever writes to — the other 4 are legacy surfaces that were
// never migrated off but are still downloaded in full by those same
// listeners, so they need the same field-stripping treatment.
const SOURCE_COLLECTIONS = ["applications", "applicants", "occupants", "tenants", "registrations"];

// The heavy base64 fields being moved out. allocationSignatureImg is
// deliberately excluded — it's confirmed dead code (declared in the old
// type, never read or written anywhere in the app), so there's nothing to
// migrate and nothing to gain from touching it.
const MEDIA_FIELDS = [
  "photo",
  "leaseSignatureImg",
  "scannedAgreementUrl",
  "scannedAgreementUploadedAt",
  "scannedAllocationLetterUrl",
  "scannedAllocationLetterUploadedAt"
] as const;

// Some older records in the legacy sibling collections stored the
// passport photo under a different key entirely — App.tsx's normalizeDoc
// has always read `photo || photoUrl || imageUrl`. Both aliases fold into
// application_media's single `photo` field so nothing gets left behind
// (and left un-stripped) on the source document.
const PHOTO_ALIAS_FIELDS = ["photoUrl", "imageUrl"] as const;

interface ScanResult {
  collection: string;
  id: string;
  fields: Partial<Record<(typeof MEDIA_FIELDS)[number], any>>;
  // Source field names to strip from the original doc — separate from
  // `fields`'s keys because a photo alias (photoUrl/imageUrl) is written
  // to application_media under `photo`, but must be deleted from the
  // source doc under its OWN original key.
  sourceFieldsToClear: string[];
}

interface MigrationOutcome {
  scanned: number;
  migrated: number;
  skipped: number;
  failed: { collection: string; id: string; error: string }[];
}

// Runs a pool of async tasks with bounded concurrency so we don't fire 593+
// simultaneous Firestore writes at once.
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) {
  let cursor = 0;
  async function next(): Promise<void> {
    const i = cursor++;
    if (i >= items.length) return;
    await worker(items[i], i);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
}

export default function ApplicationMediaMigrationPanel() {
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[] | null>(null);
  const [scanError, setScanError] = useState("");

  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<MigrationOutcome | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    setScanError("");
    setScanResults(null);
    setOutcome(null);
    setConfirmStep(false);
    try {
      const results: ScanResult[] = [];
      for (const colName of SOURCE_COLLECTIONS) {
        const snap = await getDocs(collection(db, colName));
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          const fields: ScanResult["fields"] = {};
          const sourceFieldsToClear: string[] = [];
          let hasAny = false;
          for (const f of MEDIA_FIELDS) {
            if (data[f] !== undefined && data[f] !== null && data[f] !== "") {
              fields[f] = data[f];
              sourceFieldsToClear.push(f);
              hasAny = true;
            }
          }
          if (!fields.photo) {
            for (const alias of PHOTO_ALIAS_FIELDS) {
              if (data[alias]) {
                fields.photo = data[alias];
                sourceFieldsToClear.push(alias);
                hasAny = true;
                break;
              }
            }
          }
          if (hasAny) {
            results.push({ collection: colName, id: docSnap.id, fields, sourceFieldsToClear });
          }
        });
      }
      setScanResults(results);
    } catch (err: any) {
      console.error("Media migration scan failed:", err);
      setScanError(err?.message || "Failed to scan collections. Check permissions and try again.");
    } finally {
      setScanning(false);
    }
  };

  const handleMigrate = async () => {
    const recordsToMigrate = scanResults;
    if (!recordsToMigrate || recordsToMigrate.length === 0) return;
    setMigrating(true);
    setProgress(0);
    const failed: MigrationOutcome["failed"] = [];
    let migrated = 0;
    let done = 0;

    await runWithConcurrency<ScanResult>(recordsToMigrate, 8, async (record) => {
      try {
        // Write to application_media/{id} FIRST. Only strip the fields off
        // the source doc after that write is confirmed — if anything fails
        // partway through, the worst case is a record that still has its
        // old inline fields (safe, re-runnable), never a record that lost
        // its photo/signature/document with no copy anywhere.
        await saveApplicationMedia(record.id, record.fields as any);

        const clearPayload: Record<string, any> = {};
        for (const f of record.sourceFieldsToClear) {
          clearPayload[f] = deleteField();
        }
        await updateDoc(doc(db, record.collection, record.id), clearPayload);

        migrated++;
      } catch (err: any) {
        console.error(`Migration failed for ${record.collection}/${record.id}:`, err);
        failed.push({ collection: record.collection, id: record.id, error: err?.message || String(err) });
      } finally {
        done++;
        setProgress(done);
      }
    });

    setOutcome({ scanned: recordsToMigrate.length, migrated, skipped: 0, failed });
    setMigrating(false);
    setScanResults(null);
    setConfirmStep(false);
  };

  return (
    <div className="space-y-6 text-left animate-fade-in font-sans" id="application-media-migration-panel">
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
          <Database className="w-4 h-4 text-rose-600" />
          <h3 className="text-sm font-bold text-slate-800">Applicant Media Storage Migration</h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Moves base64 passport photos, lease signatures, and scanned documents off the <code className="font-mono bg-slate-200/60 px-1 rounded">applications</code> record
          (and its 4 legacy sibling collections) into a separate <code className="font-mono bg-slate-200/60 px-1 rounded">application_media</code> collection.
          Those large embedded files were being downloaded in full by every realtime dashboard sync — this is what caused multi-minute load times.
          After migration, that media is only ever fetched when you actually open a specific application's detail view.
        </p>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[11px] text-amber-800 flex gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>This touches every live application record. It's safe to re-run (already-migrated records are skipped automatically), and nothing is deleted from the source record until its copy in <code className="font-mono">application_media</code> is confirmed written.</p>
            <p>Even so: run this during a quiet period, and make sure a recent Firestore export/backup exists before starting on a production dataset.</p>
          </div>
        </div>
      </div>

      {/* Step 1: Scan */}
      <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Step 1 — Scan for Records Needing Migration</h4>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning || migrating}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all shadow active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
          >
            {scanning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning...
              </>
            ) : (
              <>Scan {SOURCE_COLLECTIONS.length} Collections</>
            )}
          </button>
        </div>

        {scanError && (
          <p className="text-[11px] text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {scanError}
          </p>
        )}

        {scanResults && (
          scanResults.length === 0 ? (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Nothing to migrate — no records across any of the 5 collections still have inline media fields.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Found <strong className="text-slate-900">{scanResults.length}</strong> record{scanResults.length === 1 ? "" : "s"} with inline media fields, across{" "}
                {Array.from(new Set(scanResults.map(r => r.collection))).join(", ")}.
              </p>

              {!confirmStep ? (
                <button
                  type="button"
                  onClick={() => setConfirmStep(true)}
                  disabled={migrating}
                  className="w-full py-2.5 bg-indigo-900 hover:bg-indigo-850 text-white text-xs font-bold rounded-xl transition-all shadow active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <PlayCircle className="w-4 h-4" /> Continue to Migration
                </button>
              ) : (
                <div className="bg-rose-50 border border-rose-150 rounded-xl p-4 space-y-3">
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    This will write {scanResults.length} record{scanResults.length === 1 ? "" : "s"} to <code className="font-mono">application_media</code>, then strip the migrated fields from their source documents. Confirm you have a backup and want to proceed now.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmStep(false)}
                      disabled={migrating}
                      className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleMigrate}
                      disabled={migrating}
                      className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      {migrating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Migrating {progress} / {scanResults.length}...
                        </>
                      ) : (
                        <>Confirm & Run Migration Now</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Step 2: Outcome */}
      {outcome && (
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Migration Complete</h4>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="block text-lg font-black text-slate-800">{outcome.scanned}</span>
              <span className="text-[9px] uppercase font-bold text-slate-400">Scanned</span>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <span className="block text-lg font-black text-emerald-700">{outcome.migrated}</span>
              <span className="text-[9px] uppercase font-bold text-emerald-500">Migrated</span>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <span className="block text-lg font-black text-red-700">{outcome.failed.length}</span>
              <span className="text-[9px] uppercase font-bold text-red-500">Failed</span>
            </div>
          </div>
          {outcome.failed.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-[11px] text-red-800 space-y-1 max-h-40 overflow-y-auto">
              <p className="font-bold">Failed records (source data untouched — safe to re-scan and retry):</p>
              {outcome.failed.map((f, i) => (
                <p key={i} className="font-mono">{f.collection}/{f.id}: {f.error}</p>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-400">
            Re-run the scan above any time to confirm everything is clean, or to pick up any records that failed.
          </p>
        </div>
      )}
    </div>
  );
}
