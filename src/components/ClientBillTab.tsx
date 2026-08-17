import React, { useState, useEffect } from "react";
import { Application, PortalUser, Category, RentRatesSetting, RentBillTemplateSetting, GlobalSignatureSetting } from "../types";
import { 
  Printer, CheckCircle2, AlertCircle, Save, 
  ShieldAlert, Info
} from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { getCentralRentRate } from "../utils/rentUtils";
import MunicipalLogo from "./MunicipalLogo";

interface ClientBillTabProps {
  application: Application;
  category: Category | null;
  assignedAssetsList: any[];
  currentUser: PortalUser | null;
  rentBillTemplate: RentBillTemplateSetting | null;
  rentRates?: RentRatesSetting | null;
  globalSignature?: GlobalSignatureSetting | null;
  onUpdate: () => void;
}

export default function ClientBillTab({
  application,
  category,
  assignedAssetsList,
  currentUser,
  rentBillTemplate,
  rentRates,
  globalSignature,
  onUpdate,
}: ClientBillTabProps) {
  const getThirtyDaysAfter = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
      d.setDate(d.getDate() + 30);
      return d.toISOString().split("T")[0];
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  };

  const [billNo, setBillNo] = useState(
    application.rentBillNo || 
    `NB-${application.id.substring(0, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [billDate, setBillDate] = useState(
    application.rentBillDate || 
    new Date().toISOString().split("T")[0]
  );
  const [billDueDate, setBillDueDate] = useState(
    application.rentBillDueDate || 
    getThirtyDaysAfter(application.rentBillDate || new Date().toISOString().split("T")[0])
  );
  const [signManually, setSignManually] = useState(
    application.signBillManually || false
  );

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localSaving, setLocalSaving] = useState(false);

  useEffect(() => {
    setBillNo(application.rentBillNo || `NB-${application.id.substring(0, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`);
    const bDate = application.rentBillDate || new Date().toISOString().split("T")[0];
    setBillDate(bDate);
    setBillDueDate(application.rentBillDueDate || getThirtyDaysAfter(bDate));
    setSignManually(application.signBillManually || false);
  }, [application]);

  // If application is still pending allocation, block the bill generation
  const hasAssets = assignedAssetsList.length > 0 || !!application.assetCode;
  const isPendingAllocation = application.status === "PENDING_ALLOCATION" || !hasAssets;

  const handleSaveBillDetails = async () => {
    if (!billNo.trim()) {
      setLocalError("Bill Number is required.");
      return;
    }
    if (!billDate.trim()) {
      setLocalError("Bill Date is required.");
      return;
    }
    if (!billDueDate.trim()) {
      setLocalError("Due Date is required.");
      return;
    }

    setLocalSaving(true);
    setLocalError("");
    setSaveSuccess(false);

    try {
      const appDocRef = doc(db, "applications", application.id);
      await updateDoc(appDocRef, {
        rentBillNo: billNo.trim(),
        rentBillDate: billDate,
        rentBillDueDate: billDueDate,
        signBillManually: signManually,
        updatedAt: new Date().toISOString()
      });

      setLocalSaving(false);
      setSaveSuccess(true);
      onUpdate();

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setLocalSaving(false);
      handleFirestoreError(err, OperationType.UPDATE, `applications/${application.id}/bill`);
    }
  };

  const handleOpenPrintPreview = () => {
    setShowPrintModal(true);
  };

  if (isPendingAllocation) {
    return (
      <div className="p-12 text-center max-w-xl mx-auto space-y-4 animate-fade-in" id="client-bill-pending-alert">
        <div className="w-14 h-14 bg-amber-50 border border-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Asset Code Required</h3>
          <p className="text-xs text-slate-500 leading-relaxed font-sans">
            You cannot generate a Rent Bill & Demand Notice for this application yet. Please allocate a physical space code in the <strong className="font-semibold text-indigo-900">Linked Assets</strong> tab first to establish the rent dues parameters.
          </p>
        </div>
      </div>
    );
  }

  // Rent Calculation
  const monthlyRate = application.subType ? getCentralRentRate(application.subType, rentRates) : 150;
  const yearlyRent = monthlyRate * 12;

  // Signatures to display
  const estateOfficerSig = (typeof window !== "undefined" ? localStorage.getItem("signature_estate_officer") : null) || globalSignature?.signatureImg || null;
  const financeDirectorSig = (typeof window !== "undefined" ? localStorage.getItem("signature_finance_director") : null) || globalSignature?.signatureImg || null;

  // Format date display
  const formattedBillDate = billDate 
    ? new Date(billDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const formattedDueDate = billDueDate
    ? new Date(billDueDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 text-left animate-fade-in" id="client-bill-tab">
      {/* Configuration Panel */}
      <div className="md:col-span-5 space-y-4 print:hidden">
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Printer className="w-4 h-4 text-indigo-650" /> Bill Parameters & Controls
          </h4>

          {localError && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-950 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{localError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-950 rounded-xl text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Bill parameters saved successfully to registry!</span>
            </div>
          )}

          <div className="space-y-3 font-sans">
            <div>
              <label htmlFor="bill-no-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Demand Notice Bill No.
              </label>
              <input
                type="text"
                id="bill-no-input"
                value={billNo}
                onChange={e => setBillNo(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. NB-A87F9C-1024"
              />
            </div>

            <div>
              <label htmlFor="bill-date-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Billing Issue Date
              </label>
              <input
                type="date"
                id="bill-date-input"
                value={billDate}
                onChange={e => {
                  const newDate = e.target.value;
                  setBillDate(newDate);
                  setBillDueDate(getThirtyDaysAfter(newDate));
                }}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="bill-duedate-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Billing Due Date
              </label>
              <input
                type="date"
                id="bill-duedate-input"
                value={billDueDate}
                onChange={e => setBillDueDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 py-1 select-none">
              <input
                type="checkbox"
                id="sign-bill-manually-chk"
                checked={signManually}
                onChange={e => setSignManually(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-900 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="sign-bill-manually-chk" className="font-bold text-slate-700 text-xs cursor-pointer">
                Sign Manually (Blank for Pen Signature)
              </label>
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={handleSaveBillDetails}
              disabled={localSaving}
              className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 border border-indigo-150 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{localSaving ? "Saving..." : "Save Config"}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPrintPreview}
              className="flex-1 bg-indigo-900 hover:bg-indigo-850 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Preview</span>
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-950 space-y-2 font-sans">
          <span className="font-bold uppercase tracking-wider text-[9px] text-indigo-800 flex items-center gap-1">📋 Workflow Context</span>
          <p className="leading-relaxed text-slate-600">
            This Rent Bill serves as the formal demand notice issued to the tenant. The tenant is expected to clear this balance or log payments in the **Asset Payments** section before their active tenancy status is finalized.
          </p>
        </div>
      </div>

      {/* On-Screen Preview Panel */}
      <div className="md:col-span-7 bg-slate-100 p-4 md:p-6 rounded-2xl overflow-x-auto print:hidden">
        <div className="max-w-[100%] mx-auto bg-white shadow-md rounded-xl p-6 overflow-hidden md:overflow-visible">
          {/* On-screen Document Container */}
          <div 
            className="p-8 border border-slate-300 rounded-xl bg-white space-y-6 relative text-slate-800 text-[10px] leading-relaxed"
          >
            {/* Header section with logo and details */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b-2 border-double border-slate-900/80">
              <div className="flex flex-col items-center text-center shrink-0">
                {rentBillTemplate?.logoUrl ? (
                  <img src={rentBillTemplate.logoUrl} alt="Municipal Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <>
                    <MunicipalLogo size={64} />
                    <span className="text-[7px] text-slate-500 font-bold mt-1 uppercase tracking-wider font-mono">NSAWAM MUNICIPAL</span>
                  </>
                )}
              </div>

              <div className="text-center flex-1 py-1">
                <h4 className="text-[11px] font-extrabold tracking-tight text-slate-950 font-sans uppercase">
                  {rentBillTemplate?.title || "Nsawam Adoagyiri Municipal Assembly"}
                </h4>
                <p className="text-[8px] uppercase font-bold text-slate-600 mt-0.5 tracking-wider">
                  {rentBillTemplate?.subTitle || "Finance & Estate Management Department"}
                </p>
                <p className="text-[8px] text-slate-500 font-medium font-mono">
                  {rentBillTemplate?.boxAddress || "P.O. BOX 45, NSAWAM, EASTERN REGION, GHANA"}
                </p>
                <h5 className="text-[10px] font-extrabold text-indigo-950 mt-3 uppercase underline tracking-widest font-serif">
                  OFFICIAL RENT BILL & DEMAND NOTICE
                </h5>
                <p className="text-[7px] font-mono text-indigo-900 font-bold mt-0.5 uppercase">
                  BILLING CYCLE REF: NAMA-RENT-{application.currentLeaseYear || 1}-{application.id.substring(0, 6).toUpperCase()}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="border border-slate-200 p-2 rounded bg-slate-50/50 text-[7px] font-mono text-slate-600 space-y-0.5">
                  <div><strong>BILL NO:</strong> {billNo}</div>
                  <div><strong>DATE:</strong> {formattedBillDate}</div>
                  <div><strong>DUE DATE:</strong> {formattedDueDate}</div>
                </div>
              </div>
            </div>

            {/* Tenant Details Grid */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1 bg-slate-50/60 border border-slate-150 p-3 rounded-xl text-left">
                <span className="text-slate-400 block text-[7px] uppercase font-bold tracking-wider">Tenant Profile</span>
                <div className="text-xs font-black text-slate-900">
                  {application.firstName} {application.surname}
                </div>
                <div className="text-[9px] text-slate-600 font-medium">
                  Phone: {application.contactNumber || "N/A"}
                </div>
                <div className="text-[9px] text-slate-600 font-medium">
                  National ID: {application.ghanaCardNumber || "N/A"}
                </div>
              </div>

              <div className="space-y-1 bg-slate-50/60 border border-slate-150 p-3 rounded-xl text-left">
                <span className="text-slate-400 block text-[7px] uppercase font-bold tracking-wider">Space Location Details</span>
                <div className="text-xs font-black text-slate-900">
                  Asset Code: {application.assetCode || "PENDING"}
                </div>
                <div className="text-[9px] text-slate-600 font-medium">
                  Type / Class: <span className="uppercase font-bold text-indigo-950">{application.subType || "Store"}</span>
                </div>
                <div className="text-[9px] text-slate-600 font-medium">
                  Track: {category?.name || "Market Space Directory"}
                </div>
              </div>
            </div>

            {/* Invoice Fee Table */}
            <div className="pt-2">
              <table className="w-full border-collapse border border-slate-300 text-left text-[9px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="p-2 font-bold text-slate-700">BILL ITEM DESCRIPTION</th>
                    <th className="p-2 font-bold text-slate-700 text-center">CYCLE</th>
                    <th className="p-2 font-bold text-slate-700 text-right">RATE / MONTH</th>
                    <th className="p-2 font-bold text-slate-700 text-right">TOTAL AMOUNT (GHS)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 text-left">
                      <strong className="block text-slate-900 font-bold uppercase text-[9px]">
                        ANNUAL RENT
                      </strong>
                      <span className="text-slate-500 text-[8px]">
                        Year {application.currentLeaseYear || 1} lease covenant for space {application.assetCode || "N/A"} ({application.subType || "store"})
                      </span>
                    </td>
                    <td className="p-2 text-center text-slate-600">12 Months</td>
                    <td className="p-2 text-right font-mono text-slate-600">
                      {monthlyRate.toLocaleString()} GHS
                    </td>
                    <td className="p-2 text-right font-mono text-slate-900 font-extrabold">
                      {yearlyRent.toLocaleString()}.00
                    </td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td colSpan={3} className="p-2 text-right font-bold text-slate-700 uppercase">Total Rent Demand</td>
                    <td className="p-2 text-right font-mono text-xs font-black text-indigo-950">
                      {yearlyRent.toLocaleString()}.00 GHS
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payment Instructions Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left">
              <span className="text-[7px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">IMPORTANT PAYMENT GUIDELINES</span>
              <p className="text-[8px] text-slate-600 leading-normal whitespace-pre-wrap font-sans">
                {rentBillTemplate?.paymentGuidelines || `1. Payments are due and payable within thirty (30) days of service of this notice.\n2. All payments must be made to the Nsawam Municipal Assembly Finance Office at the treasury cashier desks, or via official banker's draft.\n3. Please present this bill demand notice at the time of payment to ensure correct credit allocation to your file.\n4. Unsettled rent beyond the 30-day grace period may attract standard administrative surcharges or result in lease review.`}
              </p>
            </div>

            {/* Signature Blocks - Streamlined to one authorized signatory block & official stamp box */}
            <div className="grid grid-cols-2 gap-12 pt-6 items-end">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 border border-dashed border-slate-300 rounded-full flex items-center justify-center text-slate-350 text-[7px] font-bold uppercase tracking-wider">
                  Stamp Here
                </div>
                <span className="text-[7px] text-slate-400 block mt-1 uppercase">Official Stamp Box</span>
              </div>
              
              <div className="flex flex-col items-center justify-end text-center">
                {(estateOfficerSig || financeDirectorSig) && !signManually ? (
                  <img src={estateOfficerSig || financeDirectorSig || undefined} alt="Authorized Signature" className="max-h-12 max-w-[120px] object-contain mb-1" />
                ) : (
                  <div className="h-12" />
                )}
                <div className="border-t border-slate-300 pt-1.5 w-full">
                  <span className="text-[8px] font-bold text-slate-500 block">
                    {globalSignature?.signeeName || "Municipal Coordinating Director"}
                  </span>
                  <span className="text-[7px] text-slate-400 block mt-0.5 uppercase">
                    {globalSignature?.signeeTitle || "AUTHORIZED SIGNATORY"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Fullscreen Print Preview Modal - Handles window.print() flawlessly */}
      {showPrintModal && (
        <div 
          className="fixed inset-0 z-[130] flex items-start justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" 
          id="rent-bill-print-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPrintModal(false);
            }
          }}
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-left print:p-0 print:shadow-none print:border-none print:rounded-none my-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 print:hidden">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Printer className="w-4 h-4 text-indigo-650" /> Rent Bill Demand Notice Printer
              </h3>
              <button 
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-slate-600 font-sans text-xs font-bold bg-slate-50 hover:bg-slate-100 py-1.5 px-3 rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-950 px-3.5 py-2.5 rounded-xl text-[10px] leading-normal font-sans flex items-start gap-2 shadow-sm print:hidden">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Embedded Preview Environment Notice</p>
                <p>If your browser security blocks printing or nothing happens when you click "Print Bill", please click the <strong>Open in New Tab</strong> button in the top-right of your screen and run the action there.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 print:hidden">
              <button 
                type="button"
                onClick={() => { window.focus(); window.print(); }}
                className="bg-indigo-900 hover:bg-indigo-850 text-white font-sans text-xs font-bold py-2.5 px-5 rounded-xl transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Bill</span>
              </button>
            </div>

            <div 
              id="printable-rent-bill-document" 
              className="p-8 border border-slate-300 rounded-2xl bg-white space-y-6 relative print:border-none print:p-0 text-slate-800 text-[11px] leading-relaxed"
            >
              {/* Header section with logo and details */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b-2 border-double border-slate-900/80">
                <div className="flex flex-col items-center text-center shrink-0">
                  {rentBillTemplate?.logoUrl ? (
                    <img src={rentBillTemplate.logoUrl} alt="Municipal Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <>
                      <MunicipalLogo size={64} className="print:w-14 print:h-14" />
                      <span className="text-[7px] text-slate-500 font-bold mt-1 uppercase tracking-wider font-mono">NSAWAM MUNICIPAL</span>
                    </>
                  )}
                </div>

                <div className="text-center flex-1 py-1">
                  <h4 className="text-[11px] font-extrabold tracking-tight text-slate-950 font-sans uppercase">
                    {rentBillTemplate?.title || "Nsawam Adoagyiri Municipal Assembly"}
                  </h4>
                  <p className="text-[8px] uppercase font-bold text-slate-600 mt-0.5 tracking-wider">
                    {rentBillTemplate?.subTitle || "Finance & Estate Management Department"}
                  </p>
                  <p className="text-[8px] text-slate-500 font-medium font-mono">
                    {rentBillTemplate?.boxAddress || "P.O. BOX 45, NSAWAM, EASTERN REGION, GHANA"}
                  </p>
                  <h5 className="text-[10px] font-extrabold text-indigo-950 mt-3 uppercase underline tracking-widest font-serif">
                    OFFICIAL RENT BILL & DEMAND NOTICE
                  </h5>
                  <p className="text-[7px] font-mono text-indigo-900 font-bold mt-0.5 uppercase">
                    BILLING CYCLE REF: NAMA-RENT-{application.currentLeaseYear || 1}-{application.id.substring(0, 6).toUpperCase()}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="border border-slate-200 p-2 rounded bg-slate-50/50 text-[7px] font-mono text-slate-600 space-y-0.5">
                    <div><strong>BILL NO:</strong> {billNo}</div>
                    <div><strong>DATE:</strong> {formattedBillDate}</div>
                    <div><strong>DUE DATE:</strong> {formattedDueDate}</div>
                  </div>
                </div>
              </div>

              {/* Tenant Details Grid */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1 bg-slate-50/60 border border-slate-150 p-3 rounded-xl text-left">
                  <span className="text-slate-400 block text-[7px] uppercase font-bold tracking-wider">Tenant Profile</span>
                  <div className="text-xs font-black text-slate-900">
                    {application.firstName} {application.surname}
                  </div>
                  <div className="text-[9px] text-slate-600 font-medium">
                    Phone: {application.contactNumber || "N/A"}
                  </div>
                  <div className="text-[9px] text-slate-600 font-medium">
                    National ID: {application.ghanaCardNumber || "N/A"}
                  </div>
                </div>

                <div className="space-y-1 bg-slate-50/60 border border-slate-150 p-3 rounded-xl text-left">
                  <span className="text-slate-400 block text-[7px] uppercase font-bold tracking-wider">Space Location Details</span>
                  <div className="text-xs font-black text-slate-900">
                    Asset Code: {application.assetCode || "PENDING"}
                  </div>
                  <div className="text-[9px] text-slate-600 font-medium">
                    Type / Class: <span className="uppercase font-bold text-indigo-950">{application.subType || "Store"}</span>
                  </div>
                  <div className="text-[9px] text-slate-600 font-medium">
                    Track: {category?.name || "Market Space Directory"}
                  </div>
                </div>
              </div>

              {/* Invoice Fee Table */}
              <div className="pt-2">
                <table className="w-full border-collapse border border-slate-300 text-left text-[9px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="p-2 font-bold text-slate-700">BILL ITEM DESCRIPTION</th>
                      <th className="p-2 font-bold text-slate-700 text-center">CYCLE</th>
                      <th className="p-2 font-bold text-slate-700 text-right">RATE / MONTH</th>
                      <th className="p-2 font-bold text-slate-700 text-right">TOTAL AMOUNT (GHS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 text-left">
                        <strong className="block text-slate-900 font-bold uppercase text-[9px]">
                          ANNUAL RENT
                        </strong>
                        <span className="text-slate-500 text-[8px]">
                          Year {application.currentLeaseYear || 1} lease covenant for space {application.assetCode || "N/A"} ({application.subType || "store"})
                        </span>
                      </td>
                      <td className="p-2 text-center text-slate-600">12 Months</td>
                      <td className="p-2 text-right font-mono text-slate-600">
                        {monthlyRate.toLocaleString()} GHS
                      </td>
                      <td className="p-2 text-right font-mono text-slate-900 font-extrabold">
                        {yearlyRent.toLocaleString()}.00
                      </td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td colSpan={3} className="p-2 text-right font-bold text-slate-700 uppercase">Total Rent Demand</td>
                      <td className="p-2 text-right font-mono text-xs font-black text-indigo-950">
                        {yearlyRent.toLocaleString()}.00 GHS
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Instructions Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left">
                <span className="text-[7px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">IMPORTANT PAYMENT GUIDELINES</span>
                <p className="text-[8px] text-slate-600 leading-normal whitespace-pre-wrap font-sans">
                  {rentBillTemplate?.paymentGuidelines || `1. Payments are due and payable within thirty (30) days of service of this notice.\n2. All payments must be made to the Nsawam Municipal Assembly Finance Office at the treasury cashier desks, or via official banker's draft.\n3. Please present this bill demand notice at the time of payment to ensure correct credit allocation to your file.\n4. Unsettled rent beyond the 30-day grace period may attract standard administrative surcharges or result in lease review.`}
                </p>
              </div>

              {/* Signature Blocks - Streamlined to one authorized signatory block & official stamp box */}
              <div className="grid grid-cols-2 gap-12 pt-8 items-end">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center text-slate-350 text-[8px] font-bold uppercase tracking-wider bg-slate-50/50">
                    Stamp Here
                  </div>
                  <span className="text-[8px] text-slate-400 block mt-1 uppercase font-semibold">Official Assembly Stamp</span>
                </div>
                
                <div className="flex flex-col items-center justify-end text-center">
                  {(estateOfficerSig || financeDirectorSig) && !signManually ? (
                    <div className="h-20 w-48 flex items-center justify-center pb-1">
                      <img src={estateOfficerSig || financeDirectorSig || undefined} alt="Authorized Signature" className="max-h-20 max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="h-20 w-48 border-b-2 border-dashed border-slate-300 flex items-end justify-center pb-1 mb-1">
                      <span className="text-[8px] text-slate-300 font-mono italic">Sign / Stamp</span>
                    </div>
                  )}
                  <div className="border-t border-slate-300 pt-1.5 w-full">
                    <span className="text-[9px] font-bold text-slate-700 block font-serif italic">
                      {globalSignature?.signeeName || "Municipal Coordinating Director"}
                    </span>
                    <span className="text-[8px] text-slate-400 block mt-0.5 uppercase font-medium">
                      {globalSignature?.signeeTitle || "AUTHORIZED SIGNATORY"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
