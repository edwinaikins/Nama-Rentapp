import React, { useState, useRef, useEffect } from "react";
import { Application, ApplicationMedia, Category, ApplicationStatus, Asset, PortalUser, Setting, SmsTemplatesSetting, AllocationLetterSetting, RentRatesSetting, GlobalSignatureSetting } from "../types";
import {
  Building, CheckCircle2, ShieldCheck, CreditCard,
  User, MapPin, Calendar, DollarSign, PenTool,
  Trash2, FileText, Smartphone, ArrowRight, Printer, AlertCircle,
  Upload, Paperclip, Eye, ShieldAlert, Lock
} from "lucide-react";
import { doc, updateDoc, deleteDoc, runTransaction, arrayUnion } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { sendSMSAndLog, formatAllocationSms, formatPaymentSms } from "../services/smsService";
import { DEFAULT_SMS_TEMPLATES, DEFAULT_ALLOCATION_LETTER_TEMPLATE } from "../data";
import { useApplicationMedia } from "../hooks/useApplicationMedia";
import { saveApplicationMedia, clearApplicationMediaFields } from "../utils/applicationMedia";
import ClientBioTab from "./ClientBioTab";
import ClientAssetsTab from "./ClientAssetsTab";
import ClientAllocationLetterTab from "./ClientAllocationLetterTab";
import MunicipalLogo from "./MunicipalLogo";
import ClientAgreementTab from "./ClientAgreementTab";
import ClientPaymentsTab from "./ClientPaymentsTab";
import ClientBillTab from "./ClientBillTab";
import { RentBillTemplateSetting } from "../types";

interface ApplicationDetailsProps {
  application: Application;
  categories: Category[];
  assets: Asset[];
  onClose: () => void;
  onUpdate: () => void;
  currentUser: PortalUser | null;
  agreementTemplate?: Setting | null;
  smsTemplates?: SmsTemplatesSetting | null;
  allocationLetterTemplate?: AllocationLetterSetting | null;
  rentRates?: RentRatesSetting | null;
  globalSignature?: GlobalSignatureSetting | null;
  rentBillTemplate?: RentBillTemplateSetting | null;
}

export default function ApplicationDetails({ 
  application, 
  categories, 
  assets, 
  onClose, 
  onUpdate, 
  currentUser, 
  agreementTemplate, 
  smsTemplates,
  allocationLetterTemplate,
  rentRates,
  globalSignature,
  rentBillTemplate
}: ApplicationDetailsProps) {
  const [activeDetailsTab, setActiveDetailsTab] = useState<"BIO" | "ASSETS" | "ALLOCATION" | "BILL" | "AGREEMENT" | "PAYMENTS">("BIO");

  // Heavy base64 image/document fields (photo, signatures, scanned copies)
  // live in application_media/{id} — a separate collection, fetched once
  // on demand here rather than embedded on the applications doc that every
  // realtime dashboard listener downloads in full. See ApplicationMedia in
  // types.ts for why. Fetched once per detail-view open and shared with
  // every child tab below via props, so opening one application only ever
  // costs one media read, not one per tab.
  const { media, setMediaField } = useApplicationMedia(application.id);

  // Stage 2 variables (Allocation)
  const [assetCode, setAssetCode] = useState(application.assetCode || "");
  const [allocationError, setAllocationError] = useState("");
  const [useManualCode, setUseManualCode] = useState(false);

  // Stage 3 variables (Agreement)
  const [leaseDuration, setLeaseDuration] = useState(application.leaseDuration || "1 Year");
  const [baseRent, setBaseRent] = useState<number>(application.baseRent || 150);
  const [signatureName, setSignatureName] = useState("");
  const [signatureConfirmed, setSignatureConfirmed] = useState(false);
  const [signLeaseManually, setSignLeaseManually] = useState(application.signLeaseManually || false);
  const [agreementError, setAgreementError] = useState("");

  useEffect(() => {
    setSignLeaseManually(application.signLeaseManually || false);
  }, [application.signLeaseManually]);

  // Stage 4 variables (Payment & Installments)
  const [paymentMode, setPaymentMode] = useState<"Mobile Money" | "Bank Deposit" | "Salary Deduction" | "Cash">("Cash");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentError, setPaymentError] = useState("");

  // Installments Logger States
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [installmentReceiptNo, setInstallmentReceiptNo] = useState("");
  const [installmentMode, setInstallmentMode] = useState<"Mobile Money" | "Bank Deposit" | "Salary Deduction" | "Cash">("Cash");
  const [installmentDate, setInstallmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [installmentNotes, setInstallmentNotes] = useState("");

  // Print/Receipt & Renewal Overlays
  const [selectedReceiptToPrint, setSelectedReceiptToPrint] = useState<any | null>(null);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  
  // Lease Agreement & Document Management States
  const [showLeaseAgreementModal, setShowLeaseAgreementModal] = useState(false);
  const [scannedFileUploading, setScannedFileUploading] = useState(false);
  const [scannedFileUploadError, setScannedFileUploadError] = useState("");
  const [showScannedAgreementModal, setShowScannedAgreementModal] = useState(false);

  // Allocation Letter States
  const [showAllocationLetterModal, setShowAllocationLetterModal] = useState(false);
  const [allocationLetterProps, setAllocationLetterProps] = useState<{
    refNo: string;
    date: string;
    signee: string;
    title: string;
    signatureImg?: string;
  }>({
    refNo: application.allocationLetterRef || `NAMA/AL/${application.id}/${new Date().getFullYear()}`,
    date: application.allocationLetterDate || new Date().toISOString().split("T")[0],
    signee: application.allocationLetterSignee || "Mr. Jasper Adenyo",
    title: application.allocationLetterSigneeTitle || "Municipal Coordinating Director",
    signatureImg: typeof window !== "undefined" ? (localStorage.getItem("signature_allocation_letter") || "") : ""
  });

  // Synchronize global signatory settings to state when fetched/updated
  useEffect(() => {
    if (globalSignature) {
      setAllocationLetterProps(prev => ({
        ...prev,
        signee: globalSignature.signeeName || prev.signee,
        title: globalSignature.signeeTitle || prev.title,
        signatureImg: globalSignature.signatureImg || prev.signatureImg
      }));
      setSignatureName(globalSignature.signeeName || "Mr. Jasper Adenyo");
    }
  }, [globalSignature]);

  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Clear errors when app transitions
  useEffect(() => {
    setAllocationError("");
    setAgreementError("");
    setPaymentError("");
  }, [application.status]);

  const category = categories.find(c => c.id === application.categoryId);

  // List of all physical assets allocated to this applicant
  const assignedAssetsList = assets.filter(
    a => a.assignedApplicationId === application.id || (application.assetCode && a.id.toUpperCase() === application.assetCode.toUpperCase())
  );

  // Stepper Stage Progress List
  const stages: { label: string; status: ApplicationStatus; desc: string }[] = [
    { label: "Registration", status: "PENDING_ALLOCATION", desc: "Bio-credentials & photo captured" },
    { label: "Allocation", status: "RESERVED", desc: "Matched to verified physical code" },
    { label: "Tenancy Agreement", status: "AWAITING_PAYMENT", desc: "Rates locked & contract signed" },
    { label: "Payment & Activation", status: "OCCUPIED", desc: "Logged transaction & active tenancy" }
  ];

  const getStageIndex = (status: ApplicationStatus) => {
    if (status === "PENDING_ALLOCATION") return 0;
    if (status === "RESERVED") return 1;
    if (status === "AWAITING_PAYMENT") return 2;
    return 3;
  };

  const currentStageIndex = getStageIndex(application.status);

  // Execute stage changes & update Firestore document
  const handleUpdateStatus = async (newStatus: ApplicationStatus, payload: Partial<Application> & { leaseSignatureImg?: string }) => {
    setIsUpdating(true);
    const appDocRef = doc(db, "applications", application.id);
    // leaseSignatureImg is a base64 blob and doesn't belong on the
    // applications doc — route it to application_media instead (see
    // ApplicationMedia in types.ts).
    const { leaseSignatureImg, ...restPayload } = payload;
    const updatedData = {
      ...restPayload,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(appDocRef, updatedData);
      if (leaseSignatureImg !== undefined) {
        await saveApplicationMedia(application.id, { leaseSignatureImg });
        setMediaField({ leaseSignatureImg });
      }

      // Synchronize all assigned physical assets' statuses to OCCUPIED if moving to active occupancy
      if (newStatus === "OCCUPIED") {
        for (const asset of assignedAssetsList) {
          await updateDoc(doc(db, "assets", asset.id.replace(/\//g, "-")), {
            status: "OCCUPIED",
            updatedAt: new Date().toISOString()
          });
        }
      }

      setIsUpdating(false);
      onUpdate();
    } catch (err) {
      setIsUpdating(false);
      handleFirestoreError(err, OperationType.UPDATE, `applications/${application.id}`);
    }
  };

  // Stage 1 -> Stage 2: Allocation
  const handleAllocate = async () => {
    if (!assetCode.trim()) {
      setAllocationError("Asset code cannot be blank.");
      return;
    }
    const cleanCode = assetCode.trim().toUpperCase();
    const safeDocId = cleanCode.replace(/\//g, "-");

    setIsUpdating(true);
    setAllocationError("");

    const matchingAsset = assets.find(a =>
      a.id.toUpperCase() === cleanCode ||
      a.id.toUpperCase() === safeDocId ||
      (a.assetCode && a.assetCode.toUpperCase() === cleanCode)
    );

    try {
      const appDocRef = doc(db, "applications", application.id);

      // A Firestore transaction guarantees the asset is re-checked and
      // reserved atomically: if two staff try to allocate the same asset
      // around the same time, the second transaction re-reads the asset,
      // sees it's no longer VACANT, and aborts cleanly instead of both
      // succeeding and double-booking the same physical asset.
      await runTransaction(db, async (tx) => {
        let assetRef = null;
        if (matchingAsset) {
          const targetDocId = matchingAsset.id.replace(/\//g, "-");
          assetRef = doc(db, "assets", targetDocId);
          const assetSnap = await tx.get(assetRef);
          if (!assetSnap.exists()) {
            throw new Error(`Asset "${cleanCode}" was not found in the registry.`);
          }
          const assetData = assetSnap.data() as Asset;
          if (assetData.status !== "VACANT") {
            throw new Error(`Asset "${cleanCode}" is no longer vacant (currently ${assetData.status}). It may have just been allocated to someone else — please refresh and try again.`);
          }
        }

        const appSnap = await tx.get(appDocRef);
        const appData = (appSnap.data() as Application | undefined) || application;
        const existingAssigned = appData.assignedAssets || [];
        const updatedAssigned = matchingAsset
          ? Array.from(new Set([...existingAssigned, matchingAsset.id]))
          : existingAssigned;

        tx.update(appDocRef, {
          status: "RESERVED",
          assetCode: cleanCode,
          assignedAssets: updatedAssigned,
          updatedAt: new Date().toISOString()
        });

        if (assetRef) {
          tx.update(assetRef, {
            status: "RESERVED",
            assignedApplicationId: application.id,
            assignedOccupantName: `${application.firstName} ${application.surname}`,
            updatedAt: new Date().toISOString()
          });
        }
      });

      // Asynchronously trigger Wigal SMS notification to the client upon space allocation (non-blocking)
      try {
        const template = smsTemplates?.allocation || DEFAULT_SMS_TEMPLATES.allocation;
        const smsMessage = formatAllocationSms(template, {
          firstName: application.firstName,
          assetCode: cleanCode
        });
        sendSMSAndLog(application.contactNumber, smsMessage, application.categoryId)
          .then(log => console.log("[Allocation SMS Logged]", log))
          .catch(err => console.error("[Allocation SMS Error]", err));
      } catch (smsErr) {
        console.error("SMS notification send trigger failed:", smsErr);
      }

      setIsUpdating(false);
      onUpdate();
    } catch (err: any) {
      setIsUpdating(false);
      if (err instanceof Error && /no longer vacant|was not found in the registry/.test(err.message)) {
        setAllocationError(err.message);
        return;
      }
      handleFirestoreError(err, OperationType.UPDATE, `applications/${application.id}`);
    }
  };

  // Stage 2 -> Stage 3: Agreement
  const handleSignAgreement = () => {
    const finalSigName = (globalSignature?.signeeName || signatureName || "Mr. Jasper Adenyo").trim();
    if (!signatureConfirmed) {
      setAgreementError("You must confirm and check the digital authorization box.");
      return;
    }
    if (baseRent <= 0) {
      setAgreementError("Base rent rate must be a positive GHS amount.");
      return;
    }

    const calculatedYearlyRent = baseRent * 12;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(startDate.getFullYear() + 1);

    const leaseSig = signLeaseManually ? "" : (globalSignature?.signatureImg || "");

    handleUpdateStatus("AWAITING_PAYMENT", {
      leaseDuration,
      baseRent,
      yearlyRent: calculatedYearlyRent,
      leaseStart: startDate.toISOString(),
      leaseEnd: endDate.toISOString(),
      currentLeaseYear: application.currentLeaseYear || 1,
      payments: application.payments || [],
      signedAt: new Date().toISOString(),
      signatureName: finalSigName,
      leaseSignatureImg: leaseSig,
      signLeaseManually: signLeaseManually
    });
  };

  const handleScannedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Firestore caps a whole document at ~1MB, and this base64-encoded
    // image lives inline on the application document alongside its other
    // fields. Base64 inflates raw size by ~33%, so a 3MB file (the old
    // limit) would silently fail to save around 700KB in — this cap keeps
    // the encoded upload comfortably under that ceiling.
    if (file.size > 650 * 1024) {
      setScannedFileUploadError("File size exceeds 650KB. This document is stored inline on the application record, which has a hard ~1MB Firestore limit — please compress your scanned image or PDF screenshot and try again.");
      return;
    }

    setScannedFileUploading(true);
    setScannedFileUploadError("");

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;
        const uploadedAt = new Date().toISOString();
        await saveApplicationMedia(application.id, {
          scannedAgreementUrl: base64,
          scannedAgreementUploadedAt: uploadedAt
        });
        setMediaField({ scannedAgreementUrl: base64, scannedAgreementUploadedAt: uploadedAt });
        setScannedFileUploading(false);
        onUpdate();
      } catch (err: any) {
        console.error("Scanned agreement upload error:", err);
        setScannedFileUploading(false);
        setScannedFileUploadError("Failed to save scanned agreement. Try a smaller file.");
      }
    };
    reader.onerror = () => {
      setScannedFileUploading(false);
      setScannedFileUploadError("Error reading the scanned document file.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveScannedAgreement = async () => {
    const canDelete = currentUser?.role === "SUPER_USER" || currentUser?.role === "LEASING_OFFICER";
    if (!canDelete) return;
    if (!window.confirm("Are you sure you want to remove the uploaded scanned lease agreement?")) return;
    setIsUpdating(true);
    try {
      await clearApplicationMediaFields(application.id, ["scannedAgreementUrl", "scannedAgreementUploadedAt"]);
      setMediaField({ scannedAgreementUrl: undefined, scannedAgreementUploadedAt: undefined });
      setIsUpdating(false);
      onUpdate();
    } catch (err) {
      setIsUpdating(false);
      console.error("Error removing scanned agreement:", err);
    }
  };

  // Stage 3 -> Stage 4: Installment Payment & Activation
  const handleAddInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    // Number("some text") is NaN, and `NaN <= 0` is always false — so a
    // non-numeric entry used to slip straight past this check and get
    // stored as amountPaid: NaN, silently corrupting every total that
    // sums payments afterward. isNaN() closes that gap explicitly.
    const numericAmount = Number(installmentAmount);
    if (!installmentAmount || isNaN(numericAmount) || numericAmount <= 0) {
      setPaymentError("Please enter a valid numeric payment amount.");
      return;
    }
    if (!installmentReceiptNo.trim()) {
      setPaymentError("Manual Receipt Number is required.");
      return;
    }

    setIsUpdating(true);
    setPaymentError("");

    const newPayment = {
      id: "PAY-" + Math.random().toString(36).substring(2, 11).toUpperCase(),
      amountPaid: numericAmount,
      manualReceiptNo: installmentReceiptNo.trim().toUpperCase(),
      paymentDate: installmentDate || new Date().toISOString().split("T")[0],
      paymentMode: installmentMode,
      notes: installmentNotes.trim()
    };

    // Transition to OCCUPIED on logging first payment
    const nextStatus = "OCCUPIED";

    // Append via arrayUnion rather than a local read-modify-write: if two
    // staff log a payment for the same tenant close together, a plain
    // array overwrite can silently drop one of them. arrayUnion is an
    // atomic server-side field transform, so both payments always survive
    // regardless of write ordering.
    const payload = {
      payments: arrayUnion(newPayment),
      paymentMode: installmentMode,
      paymentRef: installmentReceiptNo.trim().toUpperCase(),
      paymentLoggedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const appDocRef = doc(db, "applications", application.id);
      await updateDoc(appDocRef, {
        ...payload,
        status: nextStatus
      });

      // Synchronize all assigned physical assets' statuses to OCCUPIED
      for (const asset of assignedAssetsList) {
        await updateDoc(doc(db, "assets", asset.id.replace(/\//g, "-")), {
          status: "OCCUPIED",
          updatedAt: new Date().toISOString()
        });
      }

      // Asynchronously trigger Wigal SMS notification to the client upon payment
      try {
        const activePayments = [...(application.payments || []), newPayment];
        const newTotalPaid = activePayments.reduce((sum, p) => sum + p.amountPaid, 0);
        const activeBaseRent = assignedAssetsList.length > 0
          ? assignedAssetsList.reduce((sum, a) => sum + (a.baseRent || 150), 0)
          : (application.status === "PENDING_ALLOCATION" || application.status === "RESERVED" ? 0 : (application.baseRent || 0));
        const currentLeaseYear = application.currentLeaseYear || 1;
        const yearlyRent = activeBaseRent * 12;
        const totalRentDue = yearlyRent * currentLeaseYear;
        const remainingBalance = Math.max(0, totalRentDue - newTotalPaid);

        const assetCodeText = application.assetCode || (assignedAssetsList.length > 0 ? assignedAssetsList[0].id : "N/A");
        const template = smsTemplates?.payment || DEFAULT_SMS_TEMPLATES.payment;
        const smsMessage = formatPaymentSms(template, {
          firstName: application.firstName,
          amountPaid: newPayment.amountPaid,
          manualReceiptNo: newPayment.manualReceiptNo,
          assetCode: assetCodeText,
          remainingBalance: remainingBalance
        });
        
        sendSMSAndLog(application.contactNumber, smsMessage, application.categoryId)
          .then(log => console.log("[Payment SMS Logged]", log))
          .catch(err => console.error("[Payment SMS Error]", err));
      } catch (smsErr) {
        console.error("SMS notification send trigger failed:", smsErr);
      }

      setInstallmentAmount("");
      setInstallmentReceiptNo("");
      setInstallmentNotes("");
      setIsUpdating(false);
      onUpdate();
    } catch (err) {
      setIsUpdating(false);
      setPaymentError("Failed to record installment payment.");
      handleFirestoreError(err, OperationType.UPDATE, `applications/${application.id}`);
    }
  };

  // Yearly Tenancy Renewal Action
  const handleRenewLease = async () => {
    setIsUpdating(true);
    const currentEnd = application.leaseEnd ? new Date(application.leaseEnd) : new Date();
    const nextEnd = new Date(currentEnd);
    nextEnd.setFullYear(nextEnd.getFullYear() + 1);

    const nextYear = (application.currentLeaseYear || 1) + 1;

    try {
      const appDocRef = doc(db, "applications", application.id);
      await updateDoc(appDocRef, {
        currentLeaseYear: nextYear,
        leaseEnd: nextEnd.toISOString(),
        updatedAt: new Date().toISOString()
      });
      setIsUpdating(false);
      setShowRenewalModal(false);
      onUpdate();
    } catch (err) {
      setIsUpdating(false);
      setPaymentError("Failed to renew lease.");
      handleFirestoreError(err, OperationType.UPDATE, `applications/${application.id}`);
    }
  };

  // Administrative Delete (Trigger dialog)
  const handleDeleteApplication = () => {
    setShowDeleteModal(true);
  };

  // Perform administrative deletion and release assigned asset back to vacant status
  const executeDeleteApplication = async () => {
    setIsDeleting(true);
    try {
      // Release all assigned assets back to VACANT status
      for (const asset of assignedAssetsList) {
        const safeDocId = asset.id.replace(/\//g, "-");
        await updateDoc(doc(db, "assets", safeDocId), {
          status: "VACANT",
          assignedApplicationId: null,
          assignedOccupantName: null,
          updatedAt: new Date().toISOString()
        });
      }
      // Also release asset by assetCode if present
      if (application.assetCode) {
        const matchingByCode = assets.filter(a => (a.assetCode || a.id).toUpperCase() === application.assetCode?.toUpperCase());
        for (const ast of matchingByCode) {
          const safeDocId = ast.id.replace(/\//g, "-");
          await updateDoc(doc(db, "assets", safeDocId), {
            status: "VACANT",
            assignedApplicationId: null,
            assignedOccupantName: null,
            updatedAt: new Date().toISOString()
          });
        }
      }
      await deleteDoc(doc(db, "applications", application.id));
      setIsDeleting(false);
      setShowDeleteModal(false);
      onClose();
      onUpdate();
    } catch (err) {
      setIsDeleting(false);
      setShowDeleteModal(false);
      handleFirestoreError(err, OperationType.DELETE, `applications/${application.id}`);
    }
  };

  // Unlink/Release an asset from this application
  const handleUnlinkAsset = async (assetToUnlink?: Asset) => {
    const codeToUnlink = assetToUnlink ? (assetToUnlink.assetCode || assetToUnlink.id) : application.assetCode;
    if (!codeToUnlink && assignedAssetsList.length === 0) return;

    if (!window.confirm(`Are you sure you want to unlink physical store/asset "${codeToUnlink || 'allocated asset'}" from ${application.firstName} ${application.surname}? This will release the store back to VACANT status in the database.`)) {
      return;
    }

    setIsUpdating(true);
    try {
      const targetAssets = assetToUnlink
        ? [assetToUnlink]
        : (assignedAssetsList.length > 0 ? assignedAssetsList : assets.filter(a => (a.assetCode || a.id).toUpperCase() === (codeToUnlink || "").toUpperCase()));

      const appDocRef = doc(db, "applications", application.id);
      const targetAssetRefs = targetAssets.map(ast => doc(db, "assets", ast.id.replace(/\//g, "-")));

      // Release the asset(s) and update the application atomically, so a
      // dropped connection between the two can't leave them disagreeing.
      // "Remaining" is computed as (everything currently assigned) minus
      // (what's being unlinked right now) — NOT filtered against a
      // possibly-undefined single asset id, which previously meant
      // "unlink all" left the full list untouched and the application
      // stuck showing a stale allocation.
      await runTransaction(db, async (tx) => {
        const appSnap = await tx.get(appDocRef);
        const appData = (appSnap.data() as Application | undefined) || application;
        const targetIds = new Set(targetAssets.map(a => a.id));
        const currentAssigned = appData.assignedAssets && appData.assignedAssets.length > 0
          ? appData.assignedAssets
          : assignedAssetsList.map(a => a.id); // fallback for docs never populated by an older allocation flow
        const remainingIds = currentAssigned.filter(id => !targetIds.has(id));
        const isNowEmpty = remainingIds.length === 0;
        const remainingFirstAsset = assets.find(a => a.id === remainingIds[0]);

        tx.update(appDocRef, {
          assetCode: isNowEmpty ? "" : (remainingFirstAsset?.assetCode || remainingIds[0]),
          assignedAssets: remainingIds,
          status: isNowEmpty && (application.status === "RESERVED" || application.status === "AWAITING_PAYMENT") ? "PENDING_ALLOCATION" : application.status,
          updatedAt: new Date().toISOString()
        });

        for (const ref of targetAssetRefs) {
          tx.update(ref, {
            status: "VACANT",
            assignedApplicationId: null,
            assignedOccupantName: null,
            updatedAt: new Date().toISOString()
          });
        }
      });

      setIsUpdating(false);
      setAssetCode("");
      onUpdate();
    } catch (err) {
      setIsUpdating(false);
      console.error("Unlink asset error:", err);
      handleFirestoreError(err, OperationType.UPDATE, `applications/${application.id}`);
    }
  };

  const getPaymentsList = () => {
    const list = [...(application.payments || [])];
    if (list.length === 0 && application.paymentRef) {
      list.push({
        id: "legacy",
        amountPaid: application.yearlyRent || (application.baseRent ? application.baseRent * 12 : 1800),
        manualReceiptNo: application.paymentRef,
        paymentDate: application.paymentLoggedAt || application.signedAt || application.createdAt,
        paymentMode: application.paymentMode || "Bank Deposit",
        notes: "Initial registered payment"
      });
    }
    return list;
  };

  const activePaymentsList = getPaymentsList();
  const totalPaid = activePaymentsList.reduce((sum, p) => sum + p.amountPaid, 0);
  const currentLeaseYear = application.currentLeaseYear || 1;
  const activeBaseRent = assignedAssetsList.length > 0
    ? assignedAssetsList.reduce((sum, a) => sum + (a.baseRent || 150), 0)
    : (application.status === "PENDING_ALLOCATION" || application.status === "RESERVED" ? 0 : (application.baseRent || 0));
  const yearlyRent = activeBaseRent * 12;
  const totalRentDue = yearlyRent * currentLeaseYear;
  const balanceOutstanding = Math.max(0, totalRentDue - totalPaid);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden max-w-4xl mx-auto" id="application-details-panel">
      {/* Detail Header */}
      <div className="bg-slate-900 p-6 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-blue-600 px-2 py-0.5 rounded-full font-mono font-bold text-white tracking-wider">
              {application.id}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Registered on {new Date(application.createdAt).toLocaleDateString()}
            </span>
          </div>
          <h3 className="text-xl font-bold tracking-tight mt-1 text-slate-100">
            {application.firstName} {application.surname}
          </h3>
        </div>
        
        <div className="flex gap-2 shrink-0">
          {currentUser?.role === "SUPER_USER" && (
            <button
              type="button"
              onClick={handleDeleteApplication}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Erase Application"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>

      {/* Visual Lifecycle Stepper Progress bar */}
      <div className="bg-slate-50 border-b border-slate-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {stages.map((st, idx) => {
            const isCompleted = idx < currentStageIndex || application.status === "OCCUPIED";
            const isActive = idx === currentStageIndex;
            return (
              <div 
                key={st.status} 
                className={`relative flex items-start gap-3 p-3 rounded-2xl border transition-all ${
                  isActive 
                    ? "bg-indigo-50/50 border-indigo-200 shadow-sm shadow-indigo-50" 
                    : isCompleted 
                    ? "bg-slate-100/60 border-slate-200" 
                    : "bg-white border-slate-100 opacity-60"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                  isCompleted 
                    ? "bg-emerald-600 text-white" 
                    : isActive 
                    ? "bg-indigo-900 text-white" 
                    : "bg-slate-200 text-slate-500"
                }`}>
                  {isCompleted ? "✓" : idx + 1}
                </div>
                <div className="text-left">
                  <h4 className={`text-xs font-bold leading-tight ${isActive ? "text-indigo-900" : isCompleted ? "text-slate-800" : "text-slate-500"}`}>
                    {st.label}
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-snug mt-0.5">{st.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>      {/* Sub-tab Navigation */}
      <div className="border-b border-slate-100 bg-white px-6 py-2 flex flex-wrap gap-2" id="client-subtab-navigation">
        <button
          type="button"
          onClick={() => setActiveDetailsTab("BIO")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border ${
            activeDetailsTab === "BIO"
              ? "bg-indigo-900 text-white border-indigo-950 shadow-sm"
              : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
          }`}
          id="tab-bio-btn"
        >
          <User className="w-4 h-4" />
          <span>Bio Details</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDetailsTab("ASSETS")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border ${
            activeDetailsTab === "ASSETS"
              ? "bg-indigo-900 text-white border-indigo-950 shadow-sm"
              : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
          }`}
          id="tab-assets-btn"
        >
          <Building className="w-4 h-4" />
          <span>Linked Assets</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeDetailsTab === "ASSETS" ? "bg-indigo-800 text-indigo-100" : "bg-slate-200 text-slate-700"
          }`}>
            {assignedAssetsList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDetailsTab("ALLOCATION")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border ${
            activeDetailsTab === "ALLOCATION"
              ? "bg-indigo-900 text-white border-indigo-950 shadow-sm"
              : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
          }`}
          id="tab-allocation-btn"
        >
          <FileText className="w-4 h-4" />
          <span>Allocation Letter</span>
          {application.allocationLetterIssuedAt && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveDetailsTab("BILL")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border ${
            activeDetailsTab === "BILL"
              ? "bg-indigo-900 text-white border-indigo-950 shadow-sm"
              : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
          }`}
          id="tab-bill-btn"
        >
          <Printer className="w-4 h-4" />
          <span>Rent Bill</span>
          {application.rentBillNo && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveDetailsTab("AGREEMENT")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border ${
            activeDetailsTab === "AGREEMENT"
              ? "bg-indigo-900 text-white border-indigo-950 shadow-sm"
              : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
          }`}
          id="tab-agreement-btn"
        >
          <FileText className="w-4 h-4" />
          <span>Lease Agreement</span>
          {media?.scannedAgreementUrl && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveDetailsTab("PAYMENTS")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border ${
            activeDetailsTab === "PAYMENTS"
              ? "bg-indigo-900 text-white border-indigo-950 shadow-sm"
              : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
          }`}
          id="tab-payments-btn"
        >
          <CreditCard className="w-4 h-4" />
          <span>Asset Payments</span>
          {balanceOutstanding > 0 ? (
            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] rounded font-bold font-mono">
              Due
            </span>
          ) : (
            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] rounded font-bold font-mono">
              Settled
            </span>
          )}
        </button>
      </div>

      {/* Tab Panels */}
      {activeDetailsTab === "BIO" && (
        <ClientBioTab
          application={application}
          category={category}
          currentUser={currentUser}
          media={media}
          onMediaChange={setMediaField}
          onUpdate={onUpdate}
        />
      )}

      {activeDetailsTab === "ASSETS" && (
        <ClientAssetsTab
          application={application}
          assignedAssetsList={assignedAssetsList}
          assets={assets}
          assetCode={assetCode}
          setAssetCode={setAssetCode}
          useManualCode={useManualCode}
          setUseManualCode={setUseManualCode}
          allocationError={allocationError}
          isUpdating={isUpdating}
          handleAllocate={handleAllocate}
          setBaseRent={setBaseRent}
          currentUser={currentUser}
          rentRates={rentRates}
          handleUnlinkAsset={handleUnlinkAsset}
        />
      )}

      {activeDetailsTab === "ALLOCATION" && (
        <ClientAllocationLetterTab
          application={application}
          category={category || null}
          assignedAssetsList={assignedAssetsList}
          media={media}
          onMediaChange={setMediaField}
          currentUser={currentUser}
          isUpdating={isUpdating}
          onUpdate={onUpdate}
          setShowAllocationLetterModal={setShowAllocationLetterModal}
          setAllocationLetterProps={setAllocationLetterProps}
          allocationLetterTemplate={allocationLetterTemplate}
          globalSignature={globalSignature}
        />
      )}

      {activeDetailsTab === "BILL" && (
        <ClientBillTab
          application={application}
          category={category || null}
          assignedAssetsList={assignedAssetsList}
          currentUser={currentUser}
          rentBillTemplate={rentBillTemplate || null}
          rentRates={rentRates}
          globalSignature={globalSignature}
          onUpdate={onUpdate}
        />
      )}

      {activeDetailsTab === "AGREEMENT" && (
        <ClientAgreementTab
          application={application}
          currentUser={currentUser}
          media={media}
          leaseDuration={leaseDuration}
          setLeaseDuration={setLeaseDuration}
          baseRent={baseRent}
          setBaseRent={setBaseRent}
          signatureName={signatureName}
          setSignatureName={setSignatureName}
          signatureConfirmed={signatureConfirmed}
          setSignatureConfirmed={setSignatureConfirmed}
          agreementError={agreementError}
          setAgreementError={setAgreementError}
          isUpdating={isUpdating}
          handleSignAgreement={handleSignAgreement}
          setShowLeaseAgreementModal={setShowLeaseAgreementModal}
          scannedFileUploading={scannedFileUploading}
          scannedFileUploadError={scannedFileUploadError}
          handleScannedUpload={handleScannedUpload}
          handleRemoveScannedAgreement={handleRemoveScannedAgreement}
          setShowScannedAgreementModal={setShowScannedAgreementModal}
          setShowRenewalModal={setShowRenewalModal}
          yearlyRent={yearlyRent}
          currentLeaseYear={currentLeaseYear}
          globalSignature={globalSignature}
          signLeaseManually={signLeaseManually}
          setSignLeaseManually={setSignLeaseManually}
          onUpdate={onUpdate}
        />
      )}

      {activeDetailsTab === "PAYMENTS" && (
        <ClientPaymentsTab
          application={application}
          currentUser={currentUser}
          totalRentDue={totalRentDue}
          totalPaid={totalPaid}
          balanceOutstanding={balanceOutstanding}
          yearlyRent={yearlyRent}
          currentLeaseYear={currentLeaseYear}
          activePaymentsList={activePaymentsList}
          paymentError={paymentError}
          installmentAmount={installmentAmount}
          setInstallmentAmount={setInstallmentAmount}
          installmentReceiptNo={installmentReceiptNo}
          setInstallmentReceiptNo={setInstallmentReceiptNo}
          installmentMode={installmentMode}
          setInstallmentMode={setInstallmentMode}
          installmentDate={installmentDate}
          setInstallmentDate={setInstallmentDate}
          installmentNotes={installmentNotes}
          setInstallmentNotes={setInstallmentNotes}
          isUpdating={isUpdating}
          handleAddInstallment={handleAddInstallment}
          setSelectedReceiptToPrint={setSelectedReceiptToPrint}
          setShowRenewalModal={setShowRenewalModal}
        />
      )}

      {/* Registration Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" id="delete-application-modal">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-left space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-50 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold tracking-tight">Delete Registration?</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete this application for <strong className="text-slate-800 font-semibold">{application.firstName} {application.surname}</strong> (ID: {application.id}) and erase all linked records?
            </p>

            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-[11px] text-red-800 flex gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>This action is completely irreversible. Once deleted, the applicant's photo and active registration files will be erased from the registry permanently.</span>
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeDeleteApplication}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow shadow-red-100 transition-colors"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Installment Receipt Modal */}
      {selectedReceiptToPrint && (
        <div 
          className="fixed inset-0 z-[130] flex items-start justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" 
          id="printable-receipt-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedReceiptToPrint(null);
            }
          }}
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-left print:p-0 print:shadow-none print:border-none my-auto">
            {/* Non-printable buttons toolbar */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 print:hidden">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Official Receipt Duplicate</h3>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { window.focus(); window.print(); }}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow inline-flex items-center gap-1"
                >
                  <Printer className="w-3 h-3" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceiptToPrint(null)}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>

            {typeof window !== "undefined" && window.self !== window.top && (
              <div className="bg-amber-50 border border-amber-200 text-amber-950 px-3.5 py-2.5 rounded-xl text-[10px] leading-normal font-sans flex items-start gap-2 shadow-sm print:hidden">
                <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Embedded Preview Environment:</span> If your browser security blocks printing or nothing happens when you click "Print Receipt", please click the <strong className="font-semibold">Open in New Tab</strong> button in the top right of the screen and run the Print action there.
                </div>
              </div>
            )}

            {/* Official Receipt Printable Card */}
            <div id="printable-receipt-content" className="p-6 border-2 border-slate-900 rounded-2xl bg-white font-mono space-y-4 relative print:border-none print:p-0">
              {/* Duplicate Mark */}
              <div className="absolute top-2 right-2 text-[9px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                Duplicate Record Log
              </div>

              {/* Letterhead */}
              <div className="text-center pb-3 border-b border-dashed border-slate-900/60">
                <h4 className="text-sm font-bold tracking-tight">NSAWAM MUNICIPAL ASSEMBLY</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">OFFICE OF THE MUNICIPAL TREASURER</p>
                <p className="text-[9px] text-slate-400 font-medium">P.O. BOX 45, NSAWAM, GHANA</p>
                <h5 className="text-[11px] font-extrabold text-slate-900 mt-2 uppercase underline tracking-wider">
                  Official Rent Installment Receipt
                </h5>
              </div>

              {/* Receipt Grid */}
              <div className="space-y-2 text-[11px] text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">BOOKLET RECEIPT NO:</span>
                  <span className="font-extrabold text-slate-900 underline decoration-dotted">{selectedReceiptToPrint.manualReceiptNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">PAYMENT DATE:</span>
                  <span className="font-bold text-slate-900">{new Date(selectedReceiptToPrint.paymentDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">RECEIVED FROM:</span>
                  <span className="font-bold text-slate-900">{application.firstName} {application.surname}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">GHANA CARD NO:</span>
                  <span className="font-bold text-slate-900">{application.ghanaCardNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ALLOCATED ASSET CODE:</span>
                  <span className="font-bold text-slate-900">{application.assetCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ASSET TRACK CATEGORY:</span>
                  <span className="font-bold text-slate-900">{category?.name || "Dynamic Track"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ACTIVE LEASE YEAR:</span>
                  <span className="font-bold text-slate-900">Year {currentLeaseYear}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">PAYMENT TRANSACTION MODE:</span>
                  <span className="font-bold text-slate-900">{selectedReceiptToPrint.paymentMode}</span>
                </div>
              </div>

              {/* Amount Log Box */}
              <div className="bg-slate-50 border border-slate-900 rounded-xl p-3 text-center space-y-1">
                <span className="text-[9px] text-slate-500 font-bold block uppercase">AMOUNT PAID</span>
                <span className="text-base font-extrabold text-slate-900 font-mono">
                  {selectedReceiptToPrint.amountPaid} GHS
                </span>
                <span className="text-[9px] text-slate-400 block font-semibold leading-relaxed">
                  Outstanding Balance Due: {balanceOutstanding} GHS
                </span>
              </div>

              {selectedReceiptToPrint.notes && (
                <div className="text-[10px] text-slate-500 leading-relaxed border-t border-dashed border-slate-200 pt-2 text-center">
                  <strong>Staff Note:</strong> "{selectedReceiptToPrint.notes}"
                </div>
              )}

              {/* Signature Blocks */}
              <div className="grid grid-cols-2 gap-4 pt-6 text-[10px] text-center text-slate-500">
                <div className="space-y-4">
                  <div className="border-b border-slate-900/60 pb-1 font-serif italic text-slate-700">
                    {application.firstName[0]}. {application.surname}
                  </div>
                  <span>Tenant Signature</span>
                </div>
                <div className="space-y-4">
                  <div className="border-b border-slate-900/60 pb-1 font-mono font-bold text-slate-800">
                    APPROVED LOG
                  </div>
                  <span>Municipal Treasurer Stamp</span>
                </div>
              </div>

              <div className="text-[8px] text-center text-slate-400 pt-4 leading-normal">
                This digital carbon-copy duplicate serves as administrative validation of manual receipt bookkeeping for Nsawam Municipal Assembly. Thank you for your cooperation.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Yearly Lease Renewal Confirmation Modal */}
      {showRenewalModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" id="renew-lease-modal">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-left space-y-4">
            <div className="flex items-center gap-3 text-indigo-900">
              <div className="p-2 bg-indigo-50 rounded-xl">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold tracking-tight">Renew Tenancy Lease?</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              You are about to renew the tenancy lease for <strong className="text-slate-800 font-semibold">{application.firstName} {application.surname}</strong> (Asset: {application.assetCode}). This initiates the next lease year cycle.
            </p>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 space-y-2 text-xs text-indigo-950 font-mono">
              <div className="flex justify-between">
                <span>Current Tenancy:</span>
                <span className="font-bold">Year {currentLeaseYear}</span>
              </div>
              <div className="flex justify-between">
                <span>Renewing To:</span>
                <span className="font-bold text-indigo-900">Year {currentLeaseYear + 1}</span>
              </div>
              <div className="flex justify-between border-t border-indigo-100 pt-1.5">
                <span>Additional Rent Due:</span>
                <span className="font-bold text-indigo-900">+{yearlyRent} GHS</span>
              </div>
              <div className="flex justify-between">
                <span>New Cumulative Due:</span>
                <span className="font-bold">{yearlyRent * (currentLeaseYear + 1)} GHS</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              The contract duration terms, dynamic attributes, and physical asset assignment remain unchanged. All historical payment logs are safely retained.
            </p>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => setShowRenewalModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={handleRenewLease}
                className="px-4 py-2 bg-indigo-900 hover:bg-indigo-850 text-white font-bold rounded-xl shadow shadow-indigo-100 transition-colors"
              >
                {isUpdating ? "Renewing..." : "Confirm & Apply Renewal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Allocation Letter Modal */}
      {showAllocationLetterModal && (() => {
        const assetCodeToDisplay = assignedAssetsList.length > 0 
          ? assignedAssetsList.map(a => a.id).join(", ") 
          : (application.assetCode || "N/A");

        const assetDetails = assignedAssetsList.length > 0 
          ? assignedAssetsList[0] 
          : null;

        return (
          <div 
            className="fixed inset-0 z-[130] flex items-start justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" 
            id="printable-allocation-letter-modal"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowAllocationLetterModal(false);
              }
            }}
          >
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-left print:p-0 print:shadow-none print:border-none print:rounded-none my-auto">
              {/* Non-printable buttons toolbar */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 print:hidden">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nsawam Allocation Letter</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const newPrinted = !application.allocationLetterPrinted;
                        await updateDoc(doc(db, "applications", application.id), {
                          allocationLetterPrinted: newPrinted,
                          allocationLetterPrintedAt: newPrinted ? new Date().toISOString() : null,
                          updatedAt: new Date().toISOString()
                        });
                        onUpdate();
                      } catch (err) {
                        console.error("Error toggling allocation letter printed state:", err);
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
                      application.allocationLetterPrinted
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{application.allocationLetterPrinted ? "Allocation Letter Printed ✓" : "Confirm Letter Printed"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      // Mark as printed automatically on print trigger if not already marked
                      if (!application.allocationLetterPrinted) {
                        try {
                          await updateDoc(doc(db, "applications", application.id), {
                            allocationLetterPrinted: true,
                            allocationLetterPrintedAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                          });
                          onUpdate();
                        } catch (err) {
                          console.error("Auto mark printed error:", err);
                        }
                      }
                      window.focus(); 
                      window.print(); 
                    }}
                    className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs rounded-lg shadow inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Letter</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAllocationLetterModal(false)}
                    className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-lg active:scale-95 transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

              {typeof window !== "undefined" && window.self !== window.top && (
                <div className="bg-amber-50 border border-amber-200 text-amber-950 px-3.5 py-2.5 rounded-xl text-[10px] leading-normal font-sans flex items-start gap-2 shadow-sm print:hidden">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Embedded Preview Environment:</span> If your browser security blocks printing or nothing happens when you click "Print Letter", please click the <strong className="font-semibold">Open in New Tab</strong> button in the top right of the screen and run the Print action there.
                  </div>
                </div>
              )}

              {/* Physical Document sheet styling for print/screen view */}
              <div id="printable-allocation-letter-content" className="p-8 border border-slate-300 rounded-2xl bg-white space-y-6 relative print:border-none print:p-0 text-slate-800 text-[11px] leading-relaxed font-sans">
                {/* Letterhead */}
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
                  <h2 className="text-xs font-extrabold uppercase tracking-widest text-indigo-950">{allocationLetterTemplate?.title || DEFAULT_ALLOCATION_LETTER_TEMPLATE.title}</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{allocationLetterTemplate?.subTitle || DEFAULT_ALLOCATION_LETTER_TEMPLATE.subTitle}</p>
                  <p className="text-[9px] text-slate-400 font-mono">{allocationLetterTemplate?.boxAddress || DEFAULT_ALLOCATION_LETTER_TEMPLATE.boxAddress}</p>
                </div>

                {/* Letter Meta Details */}
                <div className="flex justify-between items-start pt-2 font-mono text-[9px] text-slate-600">
                  <div className="space-y-1">
                    <div>
                      <span className="font-bold">OUR REF:</span> {allocationLetterProps.refNo}
                    </div>
                    <div>
                      <span className="font-bold">APPLICANT ID:</span> {application.id}
                    </div>
                  </div>
                  <div>
                    <span className="font-bold">DATE:</span> {allocationLetterProps.date ? new Date(allocationLetterProps.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "N/A"}
                  </div>
                </div>

                {/* Address & Photo */}
                <div className="pt-4 flex justify-between items-start">
                  <div className="text-left space-y-1 text-slate-850">
                    <p className="font-bold text-[10px]">{application.firstName.toUpperCase()} {application.surname.toUpperCase()}</p>
                    <p>{application.address || "Residential Address Not Specified"}</p>
                    <p>Nsawam, Eastern Region, Ghana</p>
                    <p className="font-mono text-[9px] text-slate-600">{application.contactNumber}</p>
                  </div>

                  {/* Applicant Photo Stamp if exists */}
                  {media?.photo ? (
                    <div className="border-2 border-slate-200 rounded-lg p-1 shrink-0 bg-slate-50 shadow-sm print:border print:shadow-none">
                      <img
                        src={media.photo}
                        alt="Applicant Passport"
                        className="w-16 h-20 object-cover rounded"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-20 border border-dashed border-slate-300 rounded flex flex-col items-center justify-center bg-slate-50/50 shrink-0">
                      <User className="w-6 h-6 text-slate-300" />
                    </div>
                  )}
                </div>

                {/* Title / Subject */}
                <div className="pt-4 text-center">
                  <h3 className="font-extrabold text-indigo-955 uppercase tracking-wide border-b border-slate-800 pb-1.5 text-xs inline-block">
                    {(allocationLetterTemplate?.letterSubject || DEFAULT_ALLOCATION_LETTER_TEMPLATE.letterSubject).toUpperCase()}: {assetCodeToDisplay}
                  </h3>
                </div>

                {/* Letter Body */}
                <div className="pt-4 space-y-4 text-left leading-relaxed text-slate-700">
                  <p>{allocationLetterTemplate?.salutation || DEFAULT_ALLOCATION_LETTER_TEMPLATE.salutation}</p>
                  
                  <p>
                    {allocationLetterTemplate?.introduction || DEFAULT_ALLOCATION_LETTER_TEMPLATE.introduction}
                  </p>

                  <p>
                    {allocationLetterTemplate?.detailsIntro || DEFAULT_ALLOCATION_LETTER_TEMPLATE.detailsIntro}
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
                    {allocationLetterTemplate?.conditionsIntro || DEFAULT_ALLOCATION_LETTER_TEMPLATE.conditionsIntro}
                  </p>

                  <ul className="list-decimal pl-4 space-y-1 text-[10px]">
                    {(allocationLetterTemplate?.conditionsList || DEFAULT_ALLOCATION_LETTER_TEMPLATE.conditionsList).map((condition, idx) => (
                      <li key={idx}>{condition}</li>
                    ))}
                  </ul>

                  <p>
                    {allocationLetterTemplate?.instructions || DEFAULT_ALLOCATION_LETTER_TEMPLATE.instructions}
                  </p>

                  <p>{allocationLetterTemplate?.concludingRemarks || DEFAULT_ALLOCATION_LETTER_TEMPLATE.concludingRemarks}</p>
                </div>

                {/* Closing / Sign-off */}
                <div className="pt-10 flex justify-between items-end">
                  <div className="text-left space-y-3">
                    <p className="font-medium text-slate-700 text-xs">Yours faithfully,</p>
                    <div className="space-y-2">
                      {allocationLetterProps.signatureImg ? (
                        <div className="h-28 w-80 flex items-center justify-start py-2">
                          <img src={allocationLetterProps.signatureImg} alt="Authorized Signature" className="max-h-28 max-w-full object-contain" />
                        </div>
                      ) : (
                        <div className="h-32 w-80 my-4 border-b-2 border-dashed border-slate-300 flex items-end pb-2">
                          <span className="text-[10px] text-slate-400 font-mono italic">Signature / Stamp Here</span>
                        </div>
                      )}
                      <p className="font-bold text-slate-800 font-serif italic text-base">
                        {allocationLetterProps.signee}
                      </p>
                      <div className="text-[11px] text-slate-600 font-medium space-y-0.5">
                        <p className="font-bold uppercase text-[10px] tracking-wider text-slate-800">{allocationLetterProps.title.toUpperCase()}</p>
                        <p>For: MUNICIPAL CHIEF EXECUTIVE</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Printable Lease Agreement Modal */}
      {showLeaseAgreementModal && (() => {
        // Compute contract values based on state or actual application fields
        const currentRentGhs = application.status === "RESERVED" ? baseRent : (application.baseRent || 150);
        const currentDuration = application.status === "RESERVED" ? leaseDuration : (application.leaseDuration || "1 Year");
        const authorizedSignature = globalSignature?.signeeName || "Mr. Jasper Adenyo";
        const currentSignedDate = application.signedAt ? new Date(application.signedAt).toLocaleDateString() : new Date().toLocaleDateString();
        const leaseSignatureToDisplay = (application.signLeaseManually || signLeaseManually) ? null : (globalSignature?.signatureImg || null);

        // Calculate active rents and spaces list
        const totalRentsPerMonth = assignedAssetsList.length > 0
          ? assignedAssetsList.reduce((sum, a) => sum + (a.baseRent || 150), 0)
          : currentRentGhs;
        const totalYearlyContractRent = totalRentsPerMonth * 12;

        const formatTemplateText = (text: string) => {
          if (!text) return "";
          const startOfLease = application.leaseStart 
            ? new Date(application.leaseStart).toLocaleDateString() 
            : new Date().toLocaleDateString();
          
          let formatted = text;
          
          // Scrub any monetary templates or unneeded billing mentions to ensure no amount is printed in the agreement
          if (
            formatted.includes("[COMBINED_RENT]") || 
            formatted.includes("[YEARLY_RENT]") || 
            formatted.toLowerCase().includes("pay a combined sum") ||
            formatted.toLowerCase().includes("pay rent per the fee fixing")
          ) {
            formatted = "RENT VALUE & PAYMENT COVENANTS: The monthly rent rate under this lease is locked in for the first (1st) year of tenancy only. Thereafter, the rent rate is subject to automatic revision and adjustments each year in accordance with the annual Fee Fixing Resolution guidelines.";
          }
          
          return formatted
            .replace(/\[DURATION\]/g, currentDuration)
            .replace(/\[START_DATE\]/g, startOfLease)
            .replace(/\[CATEGORY\]/g, category?.name || "assigned");
        };

        return (
          <div 
            className="fixed inset-0 z-[130] flex items-start justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" 
            id="printable-lease-agreement-modal"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowLeaseAgreementModal(false);
              }
            }}
          >
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-left print:p-0 print:shadow-none print:border-none print:rounded-none my-auto">
              {/* Non-printable buttons toolbar */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 print:hidden">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Formal Tenancy Lease Indenture</h3>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => { window.focus(); window.print(); }}
                    className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs rounded-lg shadow inline-flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Print Contract</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLeaseAgreementModal(false)}
                    className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-lg active:scale-95 transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>

              {typeof window !== "undefined" && window.self !== window.top && (
                <div className="bg-amber-50 border border-amber-200 text-amber-950 px-3.5 py-2.5 rounded-xl text-[10px] leading-normal font-sans flex items-start gap-2 shadow-sm print:hidden">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Embedded Preview Environment:</span> If your browser security blocks printing or nothing happens when you click "Print Contract", please click the <strong className="font-semibold">Open in New Tab</strong> button in the top right of the screen and run the Print action there.
                  </div>
                </div>
              )}

              {/* Legal Lease Document Container */}
              <div id="printable-lease-agreement-content" className="p-8 border border-slate-300 rounded-2xl bg-white space-y-6 relative print:border-none print:p-0 text-slate-800 text-[11px] leading-relaxed">
                {/* Ghana Coat of Arms / Header styling with Assembly Logo and Tenant Picture */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b-2 border-double border-slate-900/80">
                  {/* Left Column: Assembly Seal Logo */}
                  <div className="flex flex-col items-center text-center shrink-0">
                    <MunicipalLogo size={64} className="print:w-14 print:h-14" />
                    <span className="text-[7px] text-slate-500 font-bold mt-1 uppercase tracking-wider font-mono">OFFICIAL SEAL</span>
                  </div>

                  {/* Center Column: Official municipal letterhead content */}
                  <div className="text-center flex-1 py-1">
                    <h4 className="text-[12px] font-extrabold tracking-tight text-slate-950 font-sans">
                      {agreementTemplate?.lessorTitle || "NSAWAM MUNICIPAL ASSEMBLY"}
                    </h4>
                    <p className="text-[8px] uppercase font-bold text-slate-600 mt-0.5 tracking-wider">
                      {agreementTemplate?.officeTitle || "OFFICE OF THE MUN. COORDINATING DIRECTOR"}
                    </p>
                    <p className="text-[8px] text-slate-500 font-medium font-mono">
                      {agreementTemplate?.boxAddress || "P.O. BOX 45, NSAWAM, EASTERN REGION, GHANA"}
                    </p>
                    <h5 className="text-[11px] font-extrabold text-indigo-950 mt-2.5 uppercase underline tracking-widest font-serif">
                      TENANCY LEASE INDENTURE
                    </h5>
                    <p className="text-[7px] font-mono text-indigo-900 font-bold mt-0.5 uppercase">
                      REGISTRATION FILE ID: {application.id.toUpperCase()}
                    </p>
                  </div>

                  {/* Right Column: Tenant Passport Photo */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-[72px] h-[84px] p-0.5 bg-white border border-slate-300 rounded shadow-sm relative overflow-hidden flex items-center justify-center shrink-0">
                      {media?.photo ? (
                        <img
                          src={media.photo}
                          referrerPolicy="no-referrer"
                          alt="Tenant Portrait"
                          className="w-full h-full object-cover rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${application.firstName}+${application.surname}`;
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-300">
                          <User className="w-8 h-8 stroke-1" />
                          <span className="text-[7px] font-bold text-slate-400 mt-1 uppercase text-center leading-none">NO PHOTO<br/>LOGGED</span>
                        </div>
                      )}
                      {/* Biometric Watermark/Stamp effect overlay */}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 border border-indigo-500/30 rounded-full flex items-center justify-center bg-indigo-50/20 backdrop-blur-[0.5px]">
                        <svg className="w-4 h-4 text-indigo-500/40" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="5" fill="none" strokeDasharray="5 5" />
                          <path d="M 25,50 C 25,25 75,25 75,50" stroke="currentColor" strokeWidth="5" fill="none" />
                        </svg>
                      </div>
                    </div>
                    <span className="text-[7px] text-slate-500 font-bold mt-1 uppercase tracking-wider font-mono">TENANT PHOTO</span>
                  </div>
                </div>

                {/* Legal Opening Indenture */}
                <div className="space-y-3">
                  <p className="font-serif">
                    <strong>THIS INDENTURE</strong> is made and executed this <strong className="underline">{currentSignedDate}</strong>, by and between:
                  </p>
                  <div className="pl-4 border-l-2 border-slate-300 space-y-2">
                    <p>
                      <strong>1. THE LESSOR:</strong> <strong>{agreementTemplate?.lessorTitle || "THE NSAWAM MUNICIPAL ASSEMBLY"}</strong>, {formatTemplateText(agreementTemplate?.lessorDesc || "represented herein by its authorized administrative municipal delegate (hereinafter referred to as \"the Assembly\") of the one part; and")}
                    </p>
                    <p>
                      <strong>2. THE LESSEE:</strong> <strong className="underline">{application.firstName} {application.surname}</strong> (Ghana Card Number: <strong className="font-mono underline">{application.ghanaCardNumber}</strong>) residing at <strong className="underline">{application.address || "Ghana"}</strong> (hereinafter referred to as "the Tenant") of the other part.
                    </p>
                  </div>
                </div>

                {/* Recitals and Allocated Spaces */}
                <div className="space-y-2">
                  <h6 className="font-extrabold uppercase text-slate-900 tracking-wider">RECITALS & ALLOCATED PREMISES:</h6>
                  <p>
                    {formatTemplateText(agreementTemplate?.recitals || "WHEREAS the Assembly is the lawful controller and administrative caretaker of all municipal spaces and retail market sectors within the Nsawam Municipal Area; and whereas the Tenant has applied for allocation of physical retail/commercial business space(s) and the Assembly has agreed to lease same under the specified terms herein.")}
                  </p>
                  <p>
                    The physical spaces allocated under this Indenture are described as:
                  </p>
                  
                  {assignedAssetsList.length > 0 ? (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 font-mono text-[10px] space-y-1.5">
                      {assignedAssetsList.map((asset, i) => (
                        <div key={asset.id} className="flex justify-between items-center border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                          <span>{i+1}. {asset.name} <span className="text-slate-400">({asset.id})</span></span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 font-mono text-[10px] flex justify-between items-center">
                      <span>1. Allocated Space (Code: {application.assetCode || "PENDING"})</span>
                    </div>
                  )}
                </div>

                {/* Covenants & Terms Section */}
                <div className="space-y-2.5">
                  <h6 className="font-extrabold uppercase text-slate-900 tracking-wider">COVENANTS & TERMS OF TENANCY:</h6>
                  <ol className="list-decimal pl-4 space-y-1.5">
                    {agreementTemplate?.termsList && agreementTemplate.termsList.length > 0 ? (
                      agreementTemplate.termsList.map((term, index) => (
                        <li key={index}>
                          {formatTemplateText(term)}
                        </li>
                      ))
                    ) : (
                      <>
                        <li>
                          <strong>LEASE TERM:</strong> This lease is granted for a term of <strong className="underline">{currentDuration}</strong>, commencing from <strong className="underline">{application.leaseStart ? new Date(application.leaseStart).toLocaleDateString() : new Date().toLocaleDateString()}</strong>.
                        </li>
                        <li>
                          <strong>RENT VALUE & PAYMENT COVENANTS:</strong> The monthly rent rate under this lease is locked in for the first (1st) year of tenancy only. Thereafter, the rent rate is subject to automatic revision and adjustments each year in accordance with the annual Fee Fixing Resolution guidelines.
                        </li>
                        <li>
                          <strong>USE OF PREMISES:</strong> The premises shall be used strictly for commercial/residential purposes as registered under the <strong className="underline">{category?.name || "assigned"}</strong> category. No sub-leasing, structural adjustments, or third-party transfer is permitted without written consent from the Mun. Coordinating Director.
                        </li>
                        <li>
                          <strong>MAINTENANCE:</strong> The Tenant agrees to maintain the allocated physical space in clean, hygienic, and tenantable condition, respecting all municipal sanitation and safety guidelines.
                        </li>
                        <li>
                          <strong>BYE-LAWS COMPLIANCE:</strong> The Tenant is bound by all Nsawam Municipal Assembly bye-laws, health, and licensing criteria. Non-compliance serves as immediate grounds for lease termination and space recovery.
                        </li>
                      </>
                    )}
                  </ol>
                </div>

                {/* Signatures Panel */}
                <div className="pt-6 border-t border-dashed border-slate-300 space-y-6">
                  <p className="font-semibold text-center italic text-slate-500 text-[10px]">
                    {agreementTemplate?.witnessStatement || "IN WITNESS WHEREOF the parties have set their hands and municipal stamps the day and year first above written."}
                  </p>

                  <div className="grid grid-cols-2 gap-8 text-slate-600">
                    {/* Tenant Column */}
                    <div className="space-y-4 border-r border-slate-100 pr-4 flex flex-col justify-between">
                      <div>
                        <span className="font-black text-slate-900 uppercase tracking-wider text-[9px] block border-b border-slate-100 pb-1">1. LESSEE (THE TENANT)</span>
                        
                        {/* Tenant Signature Area */}
                        <div className="space-y-1 pt-4">
                          <div className="h-28 border-b-2 border-slate-300 border-dashed flex flex-col justify-end pb-2 font-serif italic text-slate-800 text-sm">
                            <span className="text-[9px] text-slate-400 font-sans not-italic block mb-auto uppercase tracking-wider font-semibold">Signature / Thumbmark Area</span>
                            <span>{application.firstName} {application.surname}</span>
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-400 font-mono pt-1">
                            <span>TENANT SIGNATURE / THUMBMARK</span>
                            <span>DATE: __________________</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Assembly Column */}
                    <div className="space-y-4 pl-4 flex flex-col justify-between">
                      <div>
                        <span className="font-black text-slate-900 uppercase tracking-wider text-[9px] block border-b border-slate-100 pb-1">2. LESSOR (THE ASSEMBLY)</span>
                        
                        {/* Assembly Rep Signature Area */}
                        <div className="space-y-1 pt-4">
                          <div className="min-h-[112px] border-b-2 border-slate-300 border-dashed pb-2 flex flex-col justify-end">
                            {leaseSignatureToDisplay ? (
                              <img src={leaseSignatureToDisplay} alt="Authorized Signature" className="max-h-20 object-contain block pb-1 text-left" />
                            ) : (
                              <span className="text-[9px] text-slate-400 font-sans not-italic block mb-auto uppercase tracking-wider font-semibold">Authorized Signature / Stamp</span>
                            )}
                            <span className="font-bold font-serif italic text-slate-800 text-sm">
                              {authorizedSignature}
                            </span>
                          </div>
                          <div className="flex flex-col text-[9px] text-slate-400 font-mono pt-1">
                            <div className="flex justify-between">
                              <span>{globalSignature?.signeeTitle ? globalSignature.signeeTitle.toUpperCase() : "MUNICIPAL COORDINATING DIRECTOR"}</span>
                              <span>DATE: {currentSignedDate}</span>
                            </div>
                            <span className="text-[8px] font-bold text-slate-500 mt-1 uppercase">For: MUNICIPAL CHIEF EXECUTIVE</span>
                          </div>
                        </div>
                      </div>

                      {/* Official Stamp & Seal Area under lessor signature */}
                      <div className="flex justify-end pt-4">
                        <div className="w-28 h-28 border-2 border-dashed border-indigo-900/40 rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center p-2 text-center text-slate-400 font-mono uppercase tracking-wider shadow-sm">
                          <span className="text-[8px] font-black text-indigo-900/70 leading-tight">OFFICIAL<br/>ASSEMBLY<br/>SEAL / STAMP</span>
                          <div className="w-2 h-2 bg-indigo-900/20 rounded-full mt-2"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="text-[7px] text-slate-400 pt-6 text-center leading-normal border-t border-slate-200 uppercase tracking-wider">
                  {agreementTemplate?.statutoryText || "⚠️ Authorized by Act of Parliament • Ministry of Local Government & Decentralisation • Republic of Ghana"}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Scanned Agreement Document Viewer Modal */}
      {showScannedAgreementModal && media?.scannedAgreementUrl && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" id="scanned-agreement-viewer-modal">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-left">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Scanned Signed Lease Indenture</h3>
                <p className="text-[9px] text-slate-400">Uploaded on {media.scannedAgreementUploadedAt ? new Date(media.scannedAgreementUploadedAt).toLocaleString() : "N/A"}</p>
              </div>
              <div className="flex gap-1.5">
                <a
                  href={media.scannedAgreementUrl}
                  download={`signed-lease-agreement-${application.firstName.toLowerCase()}-${application.surname.toLowerCase()}.jpg`}
                  className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs rounded-lg active:scale-95 transition-all shadow-sm"
                >
                  Download File
                </a>
                <button
                  type="button"
                  onClick={() => setShowScannedAgreementModal(false)}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="border border-slate-150 rounded-2xl overflow-hidden bg-slate-50 max-h-[75vh] flex items-center justify-center p-2">
              {media.scannedAgreementUrl.startsWith("data:application/pdf") ? (
                <iframe
                  src={media.scannedAgreementUrl}
                  className="w-full h-[60vh] rounded-xl border border-slate-200"
                  title="PDF Document Viewer"
                />
              ) : (
                <img
                  src={media.scannedAgreementUrl}
                  referrerPolicy="no-referrer"
                  alt="Scanned signed copy"
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
