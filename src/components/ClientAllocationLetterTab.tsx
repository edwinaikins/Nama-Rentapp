import React, { useState } from "react";
import { Application, PortalUser, Category, AllocationLetterSetting, GlobalSignatureSetting } from "../types";
import { 
  FileText, Printer, CheckCircle2, AlertCircle, 
  Lock, ShieldAlert, ArrowRight, Calendar, User, Building, MapPin, Save,
  Upload, Trash2, Eye, PenTool
} from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import SignaturePad from "./SignaturePad";

interface ClientAllocationLetterTabProps {
  application: Application;
  category: Category | null;
  assignedAssetsList: any[];
  currentUser: PortalUser | null;
  isUpdating: boolean;
  onUpdate: () => void;
  setShowAllocationLetterModal: (val: boolean) => void;
  setAllocationLetterProps: (props: {
    refNo: string;
    date: string;
    signee: string;
    title: string;
    signatureImg?: string;
  }) => void;
  allocationLetterTemplate?: AllocationLetterSetting | null;
  globalSignature?: GlobalSignatureSetting | null;
}

export default function ClientAllocationLetterTab({
  application,
  category,
  assignedAssetsList,
  currentUser,
  isUpdating,
  onUpdate,
  setShowAllocationLetterModal,
  setAllocationLetterProps,
  allocationLetterTemplate,
  globalSignature
}: ClientAllocationLetterTabProps) {
  // Input fields for customizing the Allocation Letter
  const [refNo, setRefNo] = useState(
    application.allocationLetterRef || 
    `NAMA/AL/${application.id}/${new Date().getFullYear()}`
  );
  const [letterDate, setLetterDate] = useState(
    application.allocationLetterDate || 
    new Date().toISOString().split("T")[0]
  );
  const [signee, setSignee] = useState(
    application.allocationLetterSignee || 
    globalSignature?.signeeName ||
    "Mr. Jasper Adenyo"
  );
  const [signeeTitle, setSigneeTitle] = useState(
    application.allocationLetterSigneeTitle || 
    globalSignature?.signeeTitle ||
    "Municipal Coordinating Director"
  );
  const [signatureImg, setSignatureImg] = useState<string | null>(
    globalSignature?.signatureImg || null
  );
  const [signManually, setSignManually] = useState(
    application.signAllocationManually || false
  );

  React.useEffect(() => {
    if (globalSignature) {
      setSignee(application.allocationLetterSignee || globalSignature.signeeName || "Mr. Jasper Adenyo");
      setSigneeTitle(application.allocationLetterSigneeTitle || globalSignature.signeeTitle || "Municipal Coordinating Director");
      setSignatureImg(globalSignature.signatureImg || null);
    }
    setSignManually(application.signAllocationManually || false);
  }, [globalSignature, application.allocationLetterSignee, application.allocationLetterSigneeTitle, application.signAllocationManually]);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localSaving, setLocalSaving] = useState(false);

  // If application is still pending allocation, block the letter compilation
  const hasAssets = assignedAssetsList.length > 0 || !!application.assetCode;
  const isPendingAllocation = application.status === "PENDING_ALLOCATION" || !hasAssets;

  const handleSaveLetterDetails = async () => {
    if (!refNo.trim()) {
      setLocalError("Reference Number is required.");
      return;
    }
    if (!letterDate.trim()) {
      setLocalError("Letter Date is required.");
      return;
    }
    if (!signee.trim()) {
      setLocalError("Signatory Name is required.");
      return;
    }
    if (!signeeTitle.trim()) {
      setLocalError("Signatory Title is required.");
      return;
    }

    setLocalError("");
    setLocalSaving(true);
    setSaveSuccess(false);

    try {
      const appDocRef = doc(db, "applications", application.id);
      await updateDoc(appDocRef, {
        allocationLetterRef: refNo.trim(),
        allocationLetterDate: letterDate.trim(),
        allocationLetterSignee: signee.trim(),
        allocationLetterSigneeTitle: signeeTitle.trim(),
        allocationLetterIssuedAt: new Date().toISOString(),
        signAllocationManually: signManually,
        updatedAt: new Date().toISOString()
      });

      setLocalSaving(false);
      setSaveSuccess(true);
      onUpdate();

      // Clear success indicator after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setLocalSaving(false);
      handleFirestoreError(err, OperationType.UPDATE, `applications/${application.id}`);
    }
  };

  const handlePrintTrigger = () => {
    // Sync props upward so modal renders the latest state
    setAllocationLetterProps({
      refNo: refNo.trim(),
      date: letterDate.trim(),
      signee: signee.trim(),
      title: signeeTitle.trim(),
      signatureImg: signManually ? "" : (signatureImg || "")
    });
    setShowAllocationLetterModal(true);
  };

  // Scanned Copy of Allocation Letter States and Handlers
  const [scannedLetterUploading, setScannedLetterUploading] = useState(false);
  const [scannedLetterUploadError, setScannedLetterUploadError] = useState("");
  const [showScannedLetterModal, setShowScannedLetterModal] = useState(false);

  const handleScannedLetterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Firestore caps a whole document at ~1MB, and this base64-encoded
    // image lives inline on the application document. Base64 inflates raw
    // size by ~33%, so the old 3MB limit would silently fail to save
    // around 700KB in — this cap keeps the encoded upload comfortably
    // under that ceiling.
    if (file.size > 650 * 1024) {
      setScannedLetterUploadError("File size exceeds 650KB. This document is stored inline on the application record, which has a hard ~1MB Firestore limit — please compress your scanned image or PDF screenshot and try again.");
      return;
    }

    setScannedLetterUploading(true);
    setScannedLetterUploadError("");

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;
        const appDocRef = doc(db, "applications", application.id);
        await updateDoc(appDocRef, {
          scannedAllocationLetterUrl: base64,
          scannedAllocationLetterUploadedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        setScannedLetterUploading(false);
        onUpdate();
      } catch (err: any) {
        console.error("Scanned allocation letter upload error:", err);
        setScannedLetterUploading(false);
        setScannedLetterUploadError("Failed to save scanned letter. Try a smaller file.");
      }
    };
    reader.onerror = () => {
      setScannedLetterUploading(false);
      setScannedLetterUploadError("Error reading the scanned document file.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveScannedLetter = async () => {
    const canDelete = currentUser?.role && ["REGISTRAR", "LEASING_OFFICER", "SUPER_USER"].includes(currentUser.role);
    if (!canDelete) return;
    if (!window.confirm("Are you sure you want to remove the uploaded scanned allocation letter?")) return;
    setLocalSaving(true);
    try {
      const appDocRef = doc(db, "applications", application.id);
      await updateDoc(appDocRef, {
        scannedAllocationLetterUrl: null,
        scannedAllocationLetterUploadedAt: null,
        updatedAt: new Date().toISOString()
      });
      setLocalSaving(false);
      onUpdate();
    } catch (err) {
      setLocalSaving(false);
      console.error("Error removing scanned allocation letter:", err);
    }
  };

  if (isPendingAllocation) {
    return (
      <div className="p-8 text-left animate-fade-in" id="allocation-letter-tab-pending">
        <div className="max-w-xl mx-auto bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto border border-amber-100 text-amber-600">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">Allocation Letter Locked</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-normal">
              An Allocation Letter cannot be compiled until you complete **Stage 2: Linked Assets**. Please match this applicant with an active physical space code first.
            </p>
          </div>
          <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-4 text-left flex gap-3 text-xs text-amber-850">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Prerequisite Step Needed</span>
              <p className="leading-normal text-slate-600">
                Go to the **Linked Assets** tab and select an available vacant space. Once the space is reserved, the official letter compilation will unlock here automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active compiled state
  const assetCodeToDisplay = assignedAssetsList.length > 0 
    ? assignedAssetsList.map(a => a.id).join(", ") 
    : (application.assetCode || "N/A");

  const assetDetails = assignedAssetsList.length > 0 
    ? assignedAssetsList[0] 
    : null;

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 text-left animate-fade-in" id="client-allocation-letter-tab">
      {/* Allocation Letter Form Input Column */}
      <div className="md:col-span-5 space-y-4">
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <FileText className="w-4 h-4 text-indigo-900" /> Compile Letter Settings
          </h4>

          {localError && (
            <p className="text-[11px] text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {localError}
            </p>
          )}

          {saveSuccess && (
            <p className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Letter settings saved & issued successfully.
            </p>
          )}

          <div className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase text-[9px] tracking-wider block">Official Letter Reference</label>
              <input
                type="text"
                value={refNo}
                onChange={e => setRefNo(e.target.value)}
                placeholder="NAMA/AL/..."
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-xs text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase text-[9px] tracking-wider block">Letter Date</label>
              <input
                type="date"
                value={letterDate}
                onChange={e => setLetterDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-800"
              />
            </div>

            <div className="flex items-center gap-2 py-1 select-none">
              <input
                type="checkbox"
                id="sign-manually-chk"
                checked={signManually}
                onChange={e => setSignManually(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-900 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="sign-manually-chk" className="font-bold text-slate-700 text-xs cursor-pointer">
                Sign Manually (Leave blank for physical signature)
              </label>
            </div>

            {/* Global Authorized Signatory info */}
            <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1.5 text-xs text-indigo-950">
              <span className="font-bold uppercase tracking-wider text-[9px] text-indigo-800 flex items-center gap-1">✍️ Global Authorized Signatory</span>
              <p className="text-[10px] text-indigo-700 leading-normal">
                {signManually 
                  ? "Manual signature active: the digital signature image will be excluded on print-out so this document can be physically signed with a pen."
                  : "This document inherits its authority identity, designation title, and digital signature from the central Global Signature settings."}
              </p>
              <div className="mt-2 p-2 bg-white rounded-lg border border-indigo-100 flex items-center gap-3">
                {signatureImg && !signManually ? (
                  <img src={signatureImg} alt="Signature" className="h-8 max-w-[80px] object-contain border-r pr-2 border-slate-150" />
                ) : (
                  <div className="h-8 px-2 bg-slate-50 border border-dashed border-slate-200 rounded flex items-center justify-center text-[8px] text-slate-400 font-mono">
                    {signManually ? "OMITTED FOR MANUAL" : "NO SIGNATURE"}
                  </div>
                )}
                <div>
                  <div className="font-bold font-serif italic text-slate-800 text-[11px]">{signee}</div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-tight">{signeeTitle}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="button"
              disabled={localSaving || isUpdating}
              onClick={handleSaveLetterDetails}
              className="w-full py-2 bg-indigo-900 hover:bg-indigo-850 text-white text-xs font-bold rounded-xl transition-all shadow active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{localSaving ? "Saving..." : "Save & Issue Letter"}</span>
            </button>

            <button
              type="button"
              disabled={localSaving || isUpdating}
              onClick={async () => {
                try {
                  const newPrinted = !application.allocationLetterPrinted;
                  const appDocRef = doc(db, "applications", application.id);
                  await updateDoc(appDocRef, {
                    allocationLetterPrinted: newPrinted,
                    allocationLetterPrintedAt: newPrinted ? new Date().toISOString() : null,
                    updatedAt: new Date().toISOString()
                  });
                  onUpdate();
                } catch (err) {
                  console.error("Error toggling allocation letter printed state:", err);
                }
              }}
              className={`w-full py-2.5 text-xs font-extrabold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                application.allocationLetterPrinted
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{application.allocationLetterPrinted ? "Allocation Letter Printed ✓" : "Confirm Allocation Letter Printed"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintTrigger}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>View & Print Formal Letter</span>
            </button>
          </div>
        </div>

        {/* Scanned Copy of Allocation Letter Upload */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Upload className="w-4 h-4 text-indigo-900" /> Scanned Allocation Letter
          </h4>

          <div className="space-y-1.5 font-sans text-left">
            <span className="text-[10px] text-slate-400 block font-bold uppercase">Status</span>
            {application.scannedAllocationLetterUrl ? (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-100 p-2 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Scanned Letter Uploaded Successfully</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowScannedLetterModal(true)}
                    className="flex items-center gap-1 px-3 py-2 bg-indigo-900 hover:bg-indigo-850 text-white font-bold text-xs rounded-xl transition-all shadow active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Scanned Copy
                  </button>
                  {currentUser?.role && ["REGISTRAR", "LEASING_OFFICER", "SUPER_USER"].includes(currentUser.role) && (
                    <button
                      type="button"
                      disabled={localSaving || isUpdating}
                      onClick={handleRemoveScannedLetter}
                      className="p-2 hover:bg-red-50 text-red-500 border border-slate-200 hover:border-red-100 rounded-xl transition-all active:scale-95 shadow-sm"
                      title="Delete scanned copy"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {application.scannedAllocationLetterUploadedAt && (
                  <span className="text-[9px] text-slate-400 block font-mono">
                    Uploaded on: {new Date(application.scannedAllocationLetterUploadedAt).toLocaleString("en-GB")}
                  </span>
                )}
              </div>
            ) : (
              (() => {
                const canUpload = currentUser?.role && ["REGISTRAR", "LEASING_OFFICER", "SUPER_USER"].includes(currentUser.role);
                if (!canUpload) {
                  return (
                    <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-150 block w-fit">
                      🔒 Locked for Leasing / Registrar Officers
                    </span>
                  );
                }

                return (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500 leading-normal font-sans">
                      Once the client signs and returns their allocation letter, upload a scanned PDF or image copy to the registry archive.
                    </p>
                    <div className="relative">
                      <label className="flex items-center gap-1.5 px-3 py-2 bg-indigo-900 hover:bg-indigo-850 text-white font-bold text-xs rounded-xl cursor-pointer transition-all w-fit active:scale-95 shadow-sm">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{scannedLetterUploading ? "Uploading..." : "Upload Scanned Document"}</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleScannedLetterUpload}
                          disabled={scannedLetterUploading || localSaving || isUpdating}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {scannedLetterUploadError && (
                      <p className="text-[10px] text-red-600 font-bold mt-1 bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{scannedLetterUploadError}</span>
                      </p>
                    )}
                    <span className="text-[9px] text-slate-400 block font-mono">Accepts JPEG, PNG or PDF under 3MB.</span>
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* Informational Guidance */}
        <div className="bg-indigo-50/25 border border-indigo-100/60 rounded-2xl p-4 text-xs text-slate-500 space-y-2">
          <div className="flex gap-2 text-indigo-900 font-bold">
            <Calendar className="w-4 h-4 text-indigo-700 shrink-0" />
            <span>Workflow Progression</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-normal">
            After issuing the Allocation Letter, print and hand over a formal copy to the tenant. Then, click the <strong className="text-slate-700">Lease Agreement</strong> tab next to draft and lock down the tenancy indenture.
          </p>
          <div className="flex items-center gap-1 text-indigo-900 font-bold text-[10px] uppercase tracking-wider pt-1">
            <span>Next step: Lease Agreement</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Dynamic Letter Preview Column */}
      <div className="md:col-span-7">
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-inner max-h-[640px] overflow-y-auto">
          <div className="bg-white border border-slate-300 rounded-xl p-8 shadow-md relative text-slate-800 text-[11px] leading-relaxed font-sans max-w-[210mm] mx-auto min-h-[297mm]">
            
            {/* Header / Letterhead */}
            <div className="text-center space-y-1.5 pb-4 border-b-2 border-double border-slate-900/85">
              <div className="flex justify-center mb-1">
                {allocationLetterTemplate?.logoUrl ? (
                  <img
                    src={allocationLetterTemplate.logoUrl}
                    alt="Custom Emblem"
                    className="h-14 w-auto object-contain mb-1"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  /* Simulated National Emblem / Logo */
                  <svg className="w-14 h-14 text-slate-800" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="54" stroke="#1e3a8a" strokeWidth="2.5" fill="#ffffff" />
                    <circle cx="60" cy="60" r="48" stroke="#d97706" strokeWidth="1" strokeDasharray="2 1" />
                    <circle cx="60" cy="60" r="42" stroke="#1e3a8a" strokeWidth="1" />
                    <path d="M 45,45 H 75 V 63 C 75,72 60,82 60,82 C 60,82 45,72 45,63 V 45 Z" fill="#fef08a" stroke="#1e3a8a" strokeWidth="1.2" />
                    <line x1="60" y1="45" x2="60" y2="81" stroke="#1e3a8a" strokeWidth="1" />
                    <line x1="45" y1="60" x2="75" y2="60" stroke="#1e3a8a" strokeWidth="1" />
                    <circle cx="60" cy="60" r="8" fill="#ef4444" stroke="#1e3a8a" strokeWidth="1" />
                  </svg>
                )}
              </div>
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-indigo-950">
                {allocationLetterTemplate?.title || "Nsawam Adoagyiri Municipal Assembly"}
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {allocationLetterTemplate?.subTitle || "Office of the Municipal Assembly"}
              </p>
              <p className="text-[9px] text-slate-400 font-mono">
                {allocationLetterTemplate?.boxAddress || "P.O. Box 86, Nsawam, Eastern Region, Ghana | Tel: +233 342 022 084"}
              </p>
            </div>

            {/* Letter Meta Details */}
            <div className="flex justify-between items-start pt-4 font-mono text-[9px] text-slate-600">
              <div className="space-y-1">
                <div>
                  <span className="font-bold">OUR REF:</span> {refNo || "N/A"}
                </div>
                <div>
                  <span className="font-bold">APPLICANT ID:</span> {application.id}
                </div>
              </div>
              <div>
                <span className="font-bold">DATE:</span> {letterDate ? new Date(letterDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "N/A"}
              </div>
            </div>

            {/* Address & Photo */}
            <div className="pt-6 flex justify-between items-start">
              <div className="text-left space-y-1 text-slate-800">
                <p className="font-bold text-[10px]">{application.firstName.toUpperCase()} {application.surname.toUpperCase()}</p>
                <p className="text-slate-600">{application.address || "Residential Address Not Specified"}</p>
                <p className="text-slate-600">Nsawam, Eastern Region, Ghana</p>
                <p className="text-slate-600 font-mono text-[9px]">{application.contactNumber}</p>
              </div>

              {/* Applicant Photo Stamp if exists */}
              {application.photo ? (
                <div className="border-2 border-slate-200 rounded-lg p-1 shrink-0 bg-slate-50 shadow-sm print:border print:shadow-none">
                  <img
                    src={application.photo}
                    alt="Applicant Passport"
                    className="w-16 h-20 object-cover rounded"
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-[7px] text-slate-400 block text-center uppercase tracking-wide font-bold mt-1">Applicant Photo</span>
                </div>
              ) : (
                <div className="w-16 h-20 border border-dashed border-slate-300 rounded flex flex-col items-center justify-center bg-slate-50/50 shrink-0">
                  <User className="w-6 h-6 text-slate-300" />
                  <span className="text-[7px] text-slate-400 block text-center uppercase font-bold mt-1">Photo Seal</span>
                </div>
              )}
            </div>

            {/* Title / Subject */}
            <div className="pt-6 text-center">
              <h3 className="font-extrabold text-indigo-955 uppercase tracking-wide border-b border-slate-800 pb-1.5 text-xs inline-block">
                {allocationLetterTemplate?.letterSubject || "OFFICIAL ALLOCATION OF MUNICIPAL PROPERTY"}: {assetCodeToDisplay}
              </h3>
            </div>

            {/* Letter Body */}
            <div className="pt-6 space-y-4 text-left leading-relaxed text-slate-700">
              <p>{allocationLetterTemplate?.salutation || "Dear Sir/Madam,"}</p>
              
              <p>
                {allocationLetterTemplate?.introduction || "We are pleased to inform you that your application to secure a municipal physical asset has been approved by the management of the Nsawam Adoagyiri Municipal Assembly (NAMA)."}
              </p>

              <p>
                {allocationLetterTemplate?.detailsIntro || "Consequently, you have been allocated the municipal space specified below under the jurisdiction of the Assembly:"}
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 my-2 grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] font-medium text-slate-700">
                <div className="border-r border-slate-200 pr-2 pb-1 col-span-1">
                  <span className="text-slate-400 block text-[8px] uppercase font-bold tracking-wider">Allocated Asset Code</span>
                  <span className="font-bold text-slate-900 font-mono text-xs">{assetCodeToDisplay}</span>
                </div>
                <div className="pl-2 pb-1 col-span-1">
                  <span className="text-slate-400 block text-[8px] uppercase font-bold tracking-wider">Space Variant</span>
                  <span className="font-bold text-slate-900">{application.subType || "Standard"}</span>
                </div>
              </div>

              <p>
                {allocationLetterTemplate?.conditionsIntro || "Please be advised that this allocation is strictly subject to the following regulatory terms and covenants:"}
              </p>

              <ul className="list-decimal pl-4 space-y-1 text-[10px]">
                {allocationLetterTemplate?.conditionsList && allocationLetterTemplate.conditionsList.length > 0 ? (
                  allocationLetterTemplate.conditionsList.map((cond, idx) => (
                    <li key={idx}>{cond}</li>
                  ))
                ) : (
                  <>
                    <li>You are required to complete the execution of a formal Lease Agreement with the Assembly within fourteen (14) days from the date of this letter.</li>
                    <li>All applicable rent rates, installment configurations, and payment parameters shall be specified and regulated under the formal Lease Agreement.</li>
                    <li>No structural changes or subletting of this allocated property is permitted without written authorization from the Municipal Coordinating Director.</li>
                  </>
                )}
              </ul>

              <p>
                {allocationLetterTemplate?.instructions || "Please present this original allocation document to the Estate Unit at the Municipal Assembly building to proceed to Stage 3: signing of the Tenancy Lease Indenture."}
              </p>

              <p>{allocationLetterTemplate?.concludingRemarks || "We congratulate you on your allocation and look forward to a successful partnership."}</p>
            </div>

            {/* Closing / Sign-off */}
            <div className="pt-10 flex justify-between items-end">
              <div className="text-left space-y-3">
                <p className="font-medium text-slate-700 text-xs">Yours faithfully,</p>
                <div className="space-y-2">
                  {signatureImg ? (
                    <div className="h-28 w-80 flex items-center justify-start py-2">
                      <img src={signatureImg} alt="Authorized Signature" className="max-h-28 max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="h-32 w-80 my-4 border-b-2 border-dashed border-slate-300 flex items-end pb-2">
                      <span className="text-[10px] text-slate-400 font-mono italic">Signature / Stamp Here</span>
                    </div>
                  )}
                  <p className="font-bold text-slate-800 font-serif italic text-base">
                    {signee}
                  </p>
                  <div className="text-[11px] text-slate-600 font-medium space-y-0.5">
                    <p className="font-bold uppercase text-[10px] tracking-wider text-slate-800">{signeeTitle.toUpperCase()}</p>
                    <p>For: MUNICIPAL CHIEF EXECUTIVE</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scanned Allocation Letter Viewer Modal */}
      {showScannedLetterModal && application.scannedAllocationLetterUrl && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" id="scanned-letter-viewer-modal">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-left">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Scanned Copy of Allocation Letter</h3>
                <p className="text-[9px] text-slate-400">Uploaded on {application.scannedAllocationLetterUploadedAt ? new Date(application.scannedAllocationLetterUploadedAt).toLocaleString() : "N/A"}</p>
              </div>
              <div className="flex gap-1.5">
                <a
                  href={application.scannedAllocationLetterUrl}
                  download={`scanned-allocation-letter-${application.firstName.toLowerCase()}-${application.surname.toLowerCase()}.jpg`}
                  className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs rounded-lg active:scale-95 transition-all shadow-sm"
                >
                  Download File
                </a>
                <button
                  type="button"
                  onClick={() => setShowScannedLetterModal(false)}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="border border-slate-150 rounded-2xl overflow-hidden bg-slate-50 max-h-[75vh] flex items-center justify-center p-2">
              {application.scannedAllocationLetterUrl.startsWith("data:application/pdf") ? (
                <iframe
                  src={application.scannedAllocationLetterUrl}
                  className="w-full h-[60vh] rounded-xl border border-slate-200"
                  title="PDF Document Viewer"
                />
              ) : (
                <img
                  src={application.scannedAllocationLetterUrl}
                  referrerPolicy="no-referrer"
                  alt="Scanned Allocation Letter copy"
                  className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-sm border border-white"
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
