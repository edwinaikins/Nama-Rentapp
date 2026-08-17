import React, { useState, useEffect } from "react";
import { Application, PortalUser, GlobalSignatureSetting } from "../types";
import { FileText, Printer, Eye, Trash2, Upload, Lock, ShieldAlert, PenTool, ArrowRight, Calendar, AlertCircle } from "lucide-react";
import SignaturePad from "./SignaturePad";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

interface ClientAgreementTabProps {
  application: Application;
  currentUser: PortalUser | null;
  leaseDuration: string;
  setLeaseDuration: (val: string) => void;
  baseRent: number;
  setBaseRent: (val: number) => void;
  signatureName: string;
  setSignatureName: (val: string) => void;
  signatureConfirmed: boolean;
  setSignatureConfirmed: (val: boolean) => void;
  agreementError: string;
  setAgreementError: (val: string) => void;
  isUpdating: boolean;
  handleSignAgreement: () => void;
  setShowLeaseAgreementModal: (val: boolean) => void;
  scannedFileUploading: boolean;
  scannedFileUploadError: string;
  handleScannedUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveScannedAgreement: () => void;
  setShowScannedAgreementModal: (val: boolean) => void;
  setShowRenewalModal: (val: boolean) => void;
  yearlyRent: number;
  currentLeaseYear: number;
  globalSignature?: GlobalSignatureSetting | null;
  signLeaseManually: boolean;
  setSignLeaseManually: (val: boolean) => void;
  onUpdate: () => void;
}

export default function ClientAgreementTab({
  application,
  currentUser,
  leaseDuration,
  setLeaseDuration,
  baseRent,
  setBaseRent,
  signatureName,
  setSignatureName,
  signatureConfirmed,
  setSignatureConfirmed,
  agreementError,
  setAgreementError,
  isUpdating,
  handleSignAgreement,
  setShowLeaseAgreementModal,
  scannedFileUploading,
  scannedFileUploadError,
  handleScannedUpload,
  handleRemoveScannedAgreement,
  setShowScannedAgreementModal,
  setShowRenewalModal,
  yearlyRent,
  currentLeaseYear,
  globalSignature,
  signLeaseManually,
  setSignLeaseManually,
  onUpdate,
}: ClientAgreementTabProps) {
  const [signatureImg, setSignatureImg] = useState<string | null>(
    globalSignature?.signatureImg || null
  );

  useEffect(() => {
    if (globalSignature) {
      setSignatureImg(globalSignature.signatureImg || null);
    }
  }, [globalSignature]);

  const handleToggleSignManually = async (checked: boolean) => {
    setSignLeaseManually(checked);
    try {
      const appDocRef = doc(db, "applications", application.id);
      await updateDoc(appDocRef, {
        signLeaseManually: checked,
        updatedAt: new Date().toISOString()
      });
      onUpdate();
    } catch (err) {
      console.error("Failed to update signLeaseManually:", err);
    }
  };

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 text-left animate-fade-in" id="client-agreement-tab">
      {/* Lease Details Panel Column */}
      <div className="md:col-span-7 space-y-4">
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <FileText className="w-4 h-4 text-indigo-650" /> Contract & Duration Ledger
          </h4>

          <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs space-y-3 text-slate-700 font-mono">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Lease Start Date</span>
                <span className="font-semibold text-slate-800 block mt-0.5">
                  {application.leaseStart ? new Date(application.leaseStart).toLocaleDateString() : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Lease Expiry Date</span>
                <span className="font-semibold text-slate-800 block mt-0.5">
                  {application.leaseEnd ? new Date(application.leaseEnd).toLocaleDateString() : "N/A"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-slate-200/60 pt-3">
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Active Year Cycle</span>
                <span className="font-semibold text-slate-800 block mt-0.5">Year {currentLeaseYear} Tenancy</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Lease Duration Term</span>
                <span className="font-semibold text-slate-800 block mt-0.5">{application.leaseDuration || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Lease Document Center */}
          <div className="border border-indigo-100 bg-indigo-50/20 rounded-xl p-4 text-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-700" />
                Indenture Documents Center
              </span>
              <button
                type="button"
                onClick={() => {
                  if (application.status === "PENDING_ALLOCATION") {
                    setAgreementError("Please allocate a physical asset code before printing the indenture.");
                    return;
                  }
                  setShowLeaseAgreementModal(true);
                }}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-250 rounded-lg text-[10px] font-bold text-slate-700 flex items-center gap-1 active:scale-95 transition-all shadow-sm w-fit"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" /> Print Formal Indenture
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200/60">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Authorized Signatory</span>
                {globalSignature?.signatureImg && !application.signLeaseManually ? (
                  <div className="h-10 w-36 flex items-center justify-start pb-1 mt-1">
                    <img src={globalSignature.signatureImg} alt="Authorized Signature" className="max-h-10 max-w-full object-contain" />
                  </div>
                ) : (
                  <p className="font-semibold text-slate-500 italic font-serif text-xs mt-1.5 border border-dashed border-slate-250 p-1.5 rounded-lg w-fit">
                    ✍️ {application.signLeaseManually ? "Omitted (Manual Pen Sign)" : (globalSignature?.signeeName || "Mr. Jasper Adenyo")}
                  </p>
                )}
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {globalSignature?.signeeName || "Mr. Jasper Adenyo"} • {application.signedAt ? `Locked on ${new Date(application.signedAt).toLocaleDateString()}` : "Not yet signed"}
                </span>

                {/* Manual toggle even after locking */}
                <div className="flex items-center gap-1.5 mt-2 select-none">
                  <input
                    type="checkbox"
                    id="sign-manually-locked-chk"
                    checked={application.signLeaseManually || false}
                    onChange={e => handleToggleSignManually(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-900 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="sign-manually-locked-chk" className="text-[10px] text-slate-600 font-semibold cursor-pointer">
                    Sign Manually (Blank for print out)
                  </label>
                </div>
              </div>

              <div className="space-y-1.5 font-sans text-left">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Scanned Signed Copy</span>
                {application.scannedAgreementUrl ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowScannedAgreementModal(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-900 hover:bg-indigo-850 text-white font-bold text-[10px] rounded-lg transition-all shadow active:scale-95"
                    >
                      <Eye className="w-3 h-3" /> View Scanned Copy
                    </button>
                    {(currentUser?.role === "SUPER_USER" || currentUser?.role === "LEASING_OFFICER") && (
                      <button
                        type="button"
                        onClick={handleRemoveScannedAgreement}
                        className="p-1.5 hover:bg-red-50 text-red-500 border border-slate-200 hover:border-red-100 rounded-lg transition-all active:scale-95 shadow-sm"
                        title="Delete scanned copy"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  (() => {
                    const canUpload = currentUser?.role === "LEASING_OFFICER" || currentUser?.role === "SUPER_USER";
                    if (!canUpload) {
                      return (
                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2.5 py-1.5 rounded border border-amber-150 block w-fit">
                          🔒 Locked for Leasing Officer
                        </span>
                      );
                    }

                    return (
                      <div className="space-y-1">
                        <div className="relative">
                          <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-[10px] rounded-lg cursor-pointer transition-all w-fit active:scale-95 shadow-sm">
                            <Upload className="w-3 h-3" />
                            {scannedFileUploading ? "Uploading..." : "Upload Scanned Copy"}
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={handleScannedUpload}
                              disabled={scannedFileUploading}
                              className="hidden"
                            />
                          </label>
                        </div>
                        {scannedFileUploadError && (
                          <p className="text-[9px] text-red-600 font-bold mt-1 bg-red-50 p-1 rounded border border-red-100">
                            {scannedFileUploadError}
                          </p>
                        )}
                        <p className="text-[9px] text-slate-400 leading-normal">JPEG, PNG or PDF scan (Max 3MB)</p>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lease Workflows Column */}
      <div className="md:col-span-5 space-y-4">
        {application.status === "RESERVED" && (() => {
          const canSign = currentUser?.role === "LEASING_OFFICER" || currentUser?.role === "SUPER_USER";
          if (!canSign) {
            return (
              <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="bg-slate-100 text-slate-500 rounded-xl p-3 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold leading-none">Execute Stage 3: Locked</h4>
                    <p className="text-[10px] text-slate-400 mt-1">Contract agreement reserved for Leasing Officer</p>
                  </div>
                </div>
                <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 flex gap-1.5 leading-normal">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Only registered Leasing Officers have authorization to prepare or sign tenancy leases.</span>
                </div>
              </div>
            );
          }

          return (
            <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="bg-gradient-to-r from-indigo-800 to-indigo-950 text-white rounded-xl p-3 flex items-center gap-2">
                <PenTool className="w-5 h-5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold leading-none">Prepare & Sign Lease</h4>
                  <p className="text-[10px] text-indigo-100 mt-1">Lock rent value & digital terms</p>
                </div>
              </div>

              {agreementError && (
                <p className="text-[11px] text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {agreementError}
                </p>
              )}

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Lease Duration</label>
                    <select
                      value={leaseDuration}
                      onChange={e => setLeaseDuration(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="6 Months">6 Months</option>
                      <option value="1 Year">1 Year</option>
                      <option value="2 Years">2 Years</option>
                      <option value="5 Years">5 Years</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Lease Rent Rate</label>
                    <div className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-extrabold text-xs flex items-center justify-between">
                      <span>{baseRent} GHS</span>
                      <span className="text-[9px] text-slate-400 font-normal">/ mo</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 py-1 select-none">
                  <input
                    type="checkbox"
                    id="sign-lease-manually-chk"
                    checked={signLeaseManually}
                    onChange={e => setSignLeaseManually(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-900 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="sign-lease-manually-chk" className="font-bold text-slate-700 text-xs cursor-pointer">
                    Sign Manually (Leave blank for physical signature)
                  </label>
                </div>

                {/* Global Authorized Signatory info */}
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1.5 text-xs text-indigo-950">
                  <span className="font-bold uppercase tracking-wider text-[9px] text-indigo-800 flex items-center gap-1">✍️ Global Lease Signatory</span>
                  <p className="text-[10px] text-indigo-700 leading-normal">
                    {signLeaseManually 
                      ? "Manual signature active: the digital signature image will be excluded on print-out so this document can be physically signed with a pen."
                      : "This agreement inherits its authority credentials and digital signature from the central Global Signature settings."}
                  </p>
                  <div className="mt-2 p-2 bg-white rounded-lg border border-indigo-100 flex items-center gap-3">
                    {globalSignature?.signatureImg && !signLeaseManually ? (
                      <img src={globalSignature.signatureImg} alt="Signature" className="h-8 max-w-[80px] object-contain border-r pr-2 border-slate-150" />
                    ) : (
                      <div className="h-8 px-2 bg-slate-50 border border-dashed border-slate-200 rounded flex items-center justify-center text-[8px] text-slate-400 font-mono">
                        {signLeaseManually ? "OMITTED FOR MANUAL" : "NO SIGNATURE"}
                      </div>
                    )}
                    <div>
                      <div className="font-bold font-serif italic text-slate-800 text-[11px]">{globalSignature?.signeeName || "Mr. Jasper Adenyo"}</div>
                      <div className="text-[9px] text-slate-500 uppercase tracking-tight">{globalSignature?.signeeTitle || "Municipal Coordinating Director"}</div>
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-2 pt-1 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={signatureConfirmed}
                    onChange={e => setSignatureConfirmed(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-[10px] text-slate-500 leading-snug">
                    I confirm that the applicant agrees to pay rent per the fee fixing guidelines (initially {baseRent} GHS/month, locked in for the 1st year only and subject to annual fee fixing thereafter) for a duration of {leaseDuration} on asset code {application.assetCode}.
                  </span>
                </label>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!signatureName.trim()) {
                      setAgreementError("Please type a signature name to generate the contract preview.");
                      return;
                    }
                    setAgreementError("");
                    setShowLeaseAgreementModal(true);
                  }}
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Generate & Print Agreement <span className="text-[10px] text-slate-400 font-normal">(Draft Preview)</span></span>
                </button>

                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleSignAgreement}
                  className="w-full py-2 bg-indigo-900 hover:bg-indigo-850 text-white text-xs font-bold rounded-xl transition-all shadow active:scale-95 flex items-center justify-center gap-1"
                >
                  Sign & Lock Agreement <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* Active occupancy yearly lease renewal controls */}
        {application.status === "OCCUPIED" && (
          <div className="bg-indigo-50/20 p-5 rounded-2xl border border-indigo-100/40 space-y-3 text-left">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
              <div>
                <h6 className="text-xs font-bold text-slate-800 leading-tight">Yearly Lease Renewal Controls</h6>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                  Is this tenancy entering Year {currentLeaseYear + 1}? Renewing the lease extends the active duration by 12 months and appends another year's rent dues ({yearlyRent} GHS).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowRenewalModal(true)}
              className="w-full py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white font-extrabold text-[11px] rounded-xl transition-all shadow flex items-center justify-center gap-1.5 active:scale-95"
            >
              <span>Renew Tenancy for Year {currentLeaseYear + 1}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Stepper info card */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-slate-500 flex gap-2">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-700 block text-left">Assembly Policy</span>
            <p className="text-[11px] text-slate-400 mt-0.5 text-left">
              Prepare draft indentures and execute signature logging strictly in compliance with municipal statutory rules.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
