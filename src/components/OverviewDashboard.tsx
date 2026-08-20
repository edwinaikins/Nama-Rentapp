import React, { useState, useEffect, useMemo } from "react";
import { doc, getDoc, updateDoc, writeBatch, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Application, Category, ApplicationStatus, PortalUser, Asset, SmsLog, RentRatesSetting, RentBillTemplateSetting, GlobalSignatureSetting } from "../types";
import { getCentralRentRate } from "../utils/rentUtils";
import MunicipalLogo from "./MunicipalLogo";
import { sendSMSAndLog, formatAllocationSms } from "../services/smsService";
import { DEFAULT_SMS_TEMPLATES } from "../data";
import { 
  Building, Search, Filter, Plus, Settings, 
  MapPin, CheckCircle, CheckCircle2, Clock, AlertCircle, FileText, 
  CreditCard, Sparkles, User, LogOut, ShieldCheck, Landmark, ShieldAlert, Info, Calculator,
  TrendingUp, Users, Activity, BarChart3, PieChart as PieChartIcon, Mail, Check, AlertTriangle, RefreshCw,
  Download, Database, Printer, X, Trash2
} from "lucide-react";
import { 
  exportApplicationsToCSV, 
  exportAssetsToCSV, 
  exportSmsLogsToCSV, 
  exportCompleteRegistryToJSON 
} from "../utils/exportUtils";
import SignaturePad from "./SignaturePad";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts";

interface OverviewDashboardProps {
  applications: Application[];
  categories: Category[];
  assets: Asset[];
  smsLogs?: SmsLog[];
  onSelectApplication: (app: Application) => void;
  onNewRegistration: () => void;
  onOpenSettings: () => void;
  onOpenAssets: () => void;
  currentUser: PortalUser | null;
  users: PortalUser[];
  onLogout: () => void;
  rentRates?: RentRatesSetting | null;
  rentBillTemplate?: RentBillTemplateSetting | null;
  globalSignature?: GlobalSignatureSetting | null;
  allocationLetterTemplate?: any;
}

export default function OverviewDashboard({
  applications,
  categories,
  assets = [],
  smsLogs = [],
  onSelectApplication,
  onNewRegistration,
  onOpenSettings,
  onOpenAssets,
  currentUser,
  users,
  onLogout,
  rentRates,
  rentBillTemplate,
  globalSignature,
  allocationLetterTemplate
}: OverviewDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"all" | ApplicationStatus>("all");
  const [activeTab, setActiveTab] = useState<"database" | "analytics" | "sms" | "billing">(
    currentUser?.role === "REGISTRAR" ? "analytics" : "database"
  );

  useEffect(() => {
    if (currentUser?.role === "REGISTRAR" && activeTab === "database") {
      setActiveTab("analytics");
    }
  }, [currentUser?.role, activeTab]);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [analyticsTrackFilter, setAnalyticsTrackFilter] = useState<string>("market_stores___shed");

  // Bulk Allocation Letter Printing States
  const [printAllAllocationLetters, setPrintAllAllocationLetters] = useState(false);
  const [bulkAllocationSearch, setBulkAllocationSearch] = useState("");
  const [bulkAllocationCategoryFilter, setBulkAllocationCategoryFilter] = useState("all");
  const [bulkAllocationStatusFilter, setBulkAllocationStatusFilter] = useState("all");
  // Applicant photos for the bulk allocation-letter print run, keyed by
  // application id. Photos live in application_media/{id} now (not on the
  // applications doc — see types.ts), so they're batch-fetched on demand
  // only when this print modal actually opens, rather than being carried
  // on every application record the always-on dashboard listener downloads.
  const [bulkPrintPhotos, setBulkPrintPhotos] = useState<Record<string, string>>({});

  // SMS Tracking and Testing Panel States
  const [smsSearch, setSmsSearch] = useState("");
  const [smsStatusFilter, setSmsStatusFilter] = useState<"all" | "SUCCESS" | "FAILED">("all");
  const [testSmsPhone, setTestSmsPhone] = useState("0546867491");
  const [testSmsMessage, setTestSmsMessage] = useState("Hello from Nsawam Municipal Assembly! This is a test notification message.");
  const [testSmsLoading, setTestSmsLoading] = useState(false);
  const [testSmsStatus, setTestSmsStatus] = useState<string | null>(null);
  const [testSmsError, setTestSmsError] = useState<string | null>(null);

  // SMS test sending trigger
  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testSmsPhone || !testSmsMessage) return;

    setTestSmsLoading(true);
    setTestSmsStatus(null);
    setTestSmsError(null);

    try {
      const log = await sendSMSAndLog(testSmsPhone, testSmsMessage);
      if (log.status === "SUCCESS") {
        setTestSmsStatus(`Successfully dispatched to Wigal Gateway! Log ID: ${log.id}`);
      } else {
        setTestSmsError(log.error || `Failed with gateway status code: ${log.statusCode}`);
      }
    } catch (err: any) {
      setTestSmsError(err.message || "Failed to trigger message dispatch proxy");
    } finally {
      setTestSmsLoading(false);
    }
  };

  // Bill Printable Signatures persistent state
  const [estateOfficerSig, setEstateOfficerSig] = useState<string | null>(
    (typeof window !== "undefined" ? localStorage.getItem("signature_estate_officer") : null) || globalSignature?.signatureImg || null
  );
  const [financeDirectorSig, setFinanceDirectorSig] = useState<string | null>(
    (typeof window !== "undefined" ? localStorage.getItem("signature_finance_director") : null) || globalSignature?.signatureImg || null
  );
  const [omitBillSignatures, setOmitBillSignatures] = useState(false);

  React.useEffect(() => {
    if (globalSignature?.signatureImg) {
      if (!estateOfficerSig) {
        setEstateOfficerSig(globalSignature.signatureImg);
      }
      if (!financeDirectorSig) {
        setFinanceDirectorSig(globalSignature.signatureImg);
      }
    }
  }, [globalSignature, estateOfficerSig, financeDirectorSig]);

  const [showSignatureSettings, setShowSignatureSettings] = useState(false);

  // Annual Billing States
  const [billingSearch, setBillingSearch] = useState("");
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [isGeneratingBills, setIsGeneratingBills] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationTotal, setGenerationTotal] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");
  const [generationResults, setGenerationResults] = useState<string | null>(null);
  const [selectedPrintBillApp, setSelectedPrintBillApp] = useState<Application | null>(null);
  const [printAllBills, setPrintAllBills] = useState(false);

  // Keep the print-bill modal's snapshot in sync with the live applications
  // list (e.g. once a persisted bill number round-trips back from Firestore).
  useEffect(() => {
    if (!selectedPrintBillApp) return;
    const fresh = applications.find(a => a.id === selectedPrintBillApp.id);
    if (fresh && fresh !== selectedPrintBillApp) {
      setSelectedPrintBillApp(fresh);
    }
  }, [applications]);

  // Opens the print-bill modal. A bill number, once printed, must stay the
  // same every time — it's an official financial document reference. If
  // this application doesn't have one yet, generate and persist it now
  // (rather than re-randomizing it on every render, which is never saved).
  const handleOpenPrintBill = async (app: Application) => {
    if (app.rentBillNo) {
      setSelectedPrintBillApp(app);
      return;
    }
    const newBillNo = `NB-${app.id.substring(0, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newBillDate = new Date().toISOString().split("T")[0];
    const merged = { ...app, rentBillNo: newBillNo, rentBillDate: newBillDate };
    setSelectedPrintBillApp(merged);
    try {
      await updateDoc(doc(db, "applications", app.id), {
        rentBillNo: newBillNo,
        rentBillDate: newBillDate,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `applications/${app.id}/rentBillNo`);
    }
  };

  // Opens the bulk print modal. Same reasoning as handleOpenPrintBill: every
  // tenant in the batch needs a stable, persisted bill number rather than
  // one derived from array index (which drifts between visits as the list
  // is filtered/sorted differently, and can disagree with the single-print
  // view for the same tenant).
  const handleOpenBulkPrintBills = async () => {
    const missingBillNo = activeTenants.filter(app => !app.rentBillNo);
    if (missingBillNo.length > 0) {
      try {
        const batch = writeBatch(db);
        const todayIso = new Date().toISOString().split("T")[0];
        missingBillNo.forEach(app => {
          const newBillNo = `NB-${app.id.substring(0, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
          batch.update(doc(db, "applications", app.id), {
            rentBillNo: newBillNo,
            rentBillDate: app.rentBillDate || todayIso,
            updatedAt: new Date().toISOString()
          });
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, "applications/bulk-rent-bill-no");
      }
    }
    setPrintAllBills(true);
  };

  // Tenants eligible for annual rent bill generation — OCCUPIED only.
  // AWAITING_PAYMENT means the lease is signed but the tenant hasn't made
  // their first payment or moved in yet, so sending them "your annual rent
  // bill" is premature; they become eligible once handleAddInstallment
  // transitions them to OCCUPIED on their first logged payment.
  const activeTenants = useMemo(
    () => applications.filter(app => app.status === "OCCUPIED"),
    [applications]
  );

  // The billingSearch-filtered view of activeTenants — was previously
  // duplicated verbatim five times across the billing UI (a disabled-state
  // check, a count label, and three separate render lists). Computed once
  // here and reused everywhere below instead.
  const billingFilteredTenants = useMemo(() => {
    const term = billingSearch.toLowerCase();
    return activeTenants.filter(app => {
      const name = `${app.firstName} ${app.surname}`.toLowerCase();
      const code = (app.assetCode || "").toLowerCase();
      const subType = (app.subType || "").toLowerCase();
      return name.includes(term) || code.includes(term) || subType.includes(term);
    });
  }, [activeTenants, billingSearch]);

  // Individual Explicit Store Selection States
  const [selectingAppForStore, setSelectingAppForStore] = useState<Application | null>(null);
  const [selectedStoreAsset, setSelectedStoreAsset] = useState<Asset | null>(null);
  const [storeSearchFilter, setStoreSearchFilter] = useState("");
  const [isAllocatingStore, setIsAllocatingStore] = useState(false);
  const [allocationSuccessMsg, setAllocationSuccessMsg] = useState<string | null>(null);

  const pendingAllocationList = applications.filter(a => a.status === "PENDING_ALLOCATION");

  const handleOpenStoreSelector = (app: Application, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectingAppForStore(app);
    setSelectedStoreAsset(null);
    setStoreSearchFilter("");
  };

  const handleConfirmSpecificStoreAllocation = async () => {
    if (!selectingAppForStore || !selectedStoreAsset) return;

    const app = selectingAppForStore;
    const store = selectedStoreAsset;
    const code = store.assetCode || store.id;
    const safeDocId = store.id.replace(/\//g, "-");

    setIsAllocatingStore(true);
    try {
      // 1. Update application doc
      await updateDoc(doc(db, "applications", app.id), {
        status: "RESERVED",
        assetCode: code,
        updatedAt: new Date().toISOString()
      });

      // 2. Update asset doc
      await updateDoc(doc(db, "assets", safeDocId), {
        status: "RESERVED",
        assignedApplicationId: app.id,
        assignedOccupantName: `${app.firstName} ${app.surname}`,
        updatedAt: new Date().toISOString()
      });

      // 3. Send SMS notification
      const smsMsg = formatAllocationSms(DEFAULT_SMS_TEMPLATES.allocation, {
        firstName: app.firstName,
        assetCode: code
      });
      sendSMSAndLog(app.contactNumber, smsMsg, app.categoryId).catch(err => console.warn("Allocation SMS err:", err));

      setAllocationSuccessMsg(`✅ Store ${code} (${store.name}) successfully allocated to ${app.firstName} ${app.surname}!`);
      setSelectingAppForStore(null);
      setSelectedStoreAsset(null);
    } catch (err) {
      console.error("Store allocation error:", err);
      alert("Failed to allocate store. Please try again.");
    } finally {
      setIsAllocatingStore(false);
    }
  };

  const handleGenerateAnnualBills = async () => {
    if (activeTenants.length === 0) return;
    setIsGeneratingBills(true);
    setGenerationProgress(0);
    setGenerationTotal(activeTenants.length);
    setGenerationStatus("Initializing annual billing cycle...");
    setGenerationResults(null);

    let succeeded = 0;
    let failed = 0;

    const BATCH_SIZE = 400;
    for (let i = 0; i < activeTenants.length; i += BATCH_SIZE) {
      const chunk = activeTenants.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      chunk.forEach(app => {
        const nextYear = (app.currentLeaseYear || 1) + 1;
        const docRef = doc(db, "applications", app.id);
        batch.update(docRef, {
          currentLeaseYear: nextYear,
          updatedAt: new Date().toISOString()
        });
      });

      try {
        setGenerationStatus(`Committing atomic batch update for tenants ${i + 1} to ${i + chunk.length}...`);
        await batch.commit();
        succeeded += chunk.length;

        // Async non-blocking SMS
        chunk.forEach(app => {
          const nextYear = (app.currentLeaseYear || 1) + 1;
          const contact = app.contactNumber;
          if (contact && contact.trim().length >= 9) {
            const smsText = `Dear ${app.firstName} ${app.surname}, your annual Rent Bill for Year ${nextYear} has been generated per the Nsawam fee fixing guidelines. Please visit the estate office to settle outstanding dues. Thank you.`;
            sendSMSAndLog(contact, smsText).catch(smsErr => console.warn("SMS notice failed:", smsErr));
          }
        });
      } catch (err) {
        console.error("Batch update failed:", err);
        failed += chunk.length;
      }

      setGenerationProgress(Math.min(i + chunk.length, activeTenants.length));
    }

    setIsGeneratingBills(false);
    setGenerationStatus("Billing cycle complete!");
    setGenerationResults(`Successfully generated annual rent bills for ${succeeded} tenant(s). ${failed > 0 ? `Failed for ${failed} record(s).` : ""}`);
  };

  const handleUnlinkStoreFromDashboard = async (app: Application, e: React.MouseEvent) => {
    e.stopPropagation();
    const code = app.assetCode;
    if (!code) return;

    if (!window.confirm(`Are you sure you want to unlink physical store ${code} from ${app.firstName} ${app.surname}? This store will return to VACANT status in the database.`)) {
      return;
    }

    try {
      // 1. Unlink in assets collection
      const matchingAssets = assets.filter(a => (a.assetCode || a.id).toUpperCase() === code.toUpperCase() || a.assignedApplicationId === app.id);
      for (const ast of matchingAssets) {
        const safeDocId = ast.id.replace(/\//g, "-");
        await updateDoc(doc(db, "assets", safeDocId), {
          status: "VACANT",
          assignedApplicationId: null,
          assignedOccupantName: null,
          updatedAt: new Date().toISOString()
        });
      }

      // 2. Unlink in applications collection
      await updateDoc(doc(db, "applications", app.id), {
        assetCode: "",
        status: (app.status === "RESERVED" || app.status === "AWAITING_PAYMENT") ? "PENDING_ALLOCATION" : app.status,
        updatedAt: new Date().toISOString()
      });

      setAllocationSuccessMsg(`Unlinked store ${code} from ${app.firstName} ${app.surname}. Store is now VACANT.`);
    } catch (err) {
      console.error("Unlink error:", err);
      alert("Failed to unlink store. Please try again.");
    }
  };

  const handleDeleteAppFromDashboard = async (app: Application, e: React.MouseEvent) => {
    e.stopPropagation();

    // Explicit allow-list, not "anyone who isn't a REGISTRAR" — this is a
    // permanent, irreversible delete, and previously LEASING_OFFICER and
    // FINANCIAL_OFFICER accounts could reach it too since the only gate on
    // this whole screen was role !== "REGISTRAR".
    if (currentUser?.role !== "SUPER_USER") {
      alert("Only a Super User can permanently delete an application record.");
      return;
    }

    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE the record for ${app.firstName} ${app.surname} (${app.id})? This will delete the profile from the database and release any allocated physical store back to VACANT.`)) {
      return;
    }

    try {
      // 1. Unlink/Release any assets assigned to this applicant
      const matchingAssets = assets.filter(a => a.assignedApplicationId === app.id || (app.assetCode && (a.assetCode || a.id).toUpperCase() === app.assetCode.toUpperCase()));
      for (const ast of matchingAssets) {
        const safeDocId = ast.id.replace(/\//g, "-");
        await updateDoc(doc(db, "assets", safeDocId), {
          status: "VACANT",
          assignedApplicationId: null,
          assignedOccupantName: null,
          updatedAt: new Date().toISOString()
        });
      }

      // 2. Delete application doc from Firestore
      await deleteDoc(doc(db, "applications", app.id));

      setAllocationSuccessMsg(`Deleted record for ${app.firstName} ${app.surname} and released any assigned store(s).`);
    } catch (err) {
      console.error("Delete app error:", err);
      alert("Failed to delete record. Please try again.");
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case "SUPER_USER":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "REGISTRAR":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "LEASING_OFFICER":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "FINANCIAL_OFFICER":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "SUPER_USER":
        return "Super User";
      case "REGISTRAR":
        return "Registrar Clerk";
      case "LEASING_OFFICER":
        return "Leasing Officer";
      case "FINANCIAL_OFFICER":
        return "Treasury Cashier";
      default:
        return "Guest";
    }
  };

  // Calculate high level metrics
  const totalCount = applications.length;
  const pendingCount = applications.filter(a => a.status === "PENDING_ALLOCATION").length;
  const reservedCount = applications.filter(a => a.status === "RESERVED").length;
  const awaitingPaymentCount = applications.filter(a => a.status === "AWAITING_PAYMENT").length;
  const activeCount = applications.filter(a => a.status === "OCCUPIED").length;

  const allocatedApplications = applications.filter(a => a.status === "RESERVED" || a.status === "AWAITING_PAYMENT" || a.status === "OCCUPIED" || !!a.assetCode);
  const allocatedCount = allocatedApplications.length;
  const printedAllocationLettersCount = allocatedApplications.filter(a => a.allocationLetterPrinted).length;

  // Batch-fetch applicant photos for the bulk allocation-letter print run
  // only when the print modal is actually opened — a one-time read per
  // allocated applicant, not a standing subscription. Ignores the modal's
  // own search/category/status filters deliberately, so photos stay
  // available even if the staff member narrows the filter after opening.
  useEffect(() => {
    if (!printAllAllocationLetters) return;
    let cancelled = false;
    const idsNeeded = allocatedApplications.map(a => a.id).filter(id => !(id in bulkPrintPhotos));
    if (idsNeeded.length === 0) return;
    Promise.all(
      idsNeeded.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, "application_media", id));
          return [id, snap.exists() ? (snap.data().photo || "") : ""] as const;
        } catch (error) {
          console.warn(`Failed to fetch application_media/${id} for bulk print:`, error);
          return [id, ""] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setBulkPrintPhotos(prev => {
        const next = { ...prev };
        entries.forEach(([id, photo]) => { next[id] = photo; });
        return next;
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printAllAllocationLetters, allocatedApplications.map(a => a.id).join(",")]);

  // Filter application list with null-safe property checks. Memoized: this
  // list can run into the thousands, and without memoization it re-filtered
  // on every render — including every keystroke in any OTHER search box on
  // the page, since they all live in this same component and any state
  // change re-renders the whole thing.
  const filteredApplications = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return applications.filter(app => {
      const matchesSearch = !term ||
        (app.firstName || "").toLowerCase().includes(term) ||
        (app.surname || "").toLowerCase().includes(term) ||
        (app.ghanaCardNumber || "").toLowerCase().includes(term) ||
        (app.contactNumber || "").toLowerCase().includes(term) ||
        (app.assetCode || "").toLowerCase().includes(term) ||
        (app.id || "").toLowerCase().includes(term) ||
        (app.subType || "").toLowerCase().includes(term) ||
        (app.address || "").toLowerCase().includes(term);

      const matchesCategory = selectedCategoryFilter === "all" || app.categoryId === selectedCategoryFilter;
      const matchesStatus = selectedStatusFilter === "all" || app.status === selectedStatusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [applications, searchTerm, selectedCategoryFilter, selectedStatusFilter]);

  // Was previously duplicated verbatim twice in the JSX below (once to
  // check .length > 0, once to actually render) — memoized and computed
  // once here instead.
  const filteredSmsLogs = useMemo(() => {
    return smsLogs.filter(log => {
      const matchesSearch =
        log.to.includes(smsSearch) ||
        log.message.toLowerCase().includes(smsSearch.toLowerCase());
      const matchesStatus =
        smsStatusFilter === "all" ||
        log.status === smsStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [smsLogs, smsSearch, smsStatusFilter]);

  const getStatusStyle = (status: ApplicationStatus) => {
    switch (status) {
      case "PENDING_ALLOCATION":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "RESERVED":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "AWAITING_PAYMENT":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "OCCUPIED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  const getStatusLabel = (status: ApplicationStatus) => {
    switch (status) {
      case "PENDING_ALLOCATION":
        return "Pending Allocation";
      case "RESERVED":
        return "Reserved / Allocated";
      case "AWAITING_PAYMENT":
        return "Agreement Signed";
      case "OCCUPIED":
        return "Occupied / Active";
    }
  };

  // --- ANALYTICAL CALCULATIONS (Track-Filtered) ---
  const analyticsCategoryObj = categories.find(c => c.id === analyticsTrackFilter);
  const analyticsSubTypes = analyticsCategoryObj?.subTypes || [];

  const analyticsApplications = applications.filter(a => a.categoryId === analyticsTrackFilter);
  const analyticsAssets = assets.filter(a => a.categoryId === analyticsTrackFilter);

  const analyticsPendingCount = analyticsApplications.filter(a => a.status === "PENDING_ALLOCATION").length;
  const occupiedCount = analyticsAssets.filter(a => a.status === "OCCUPIED").length;
  const reservedCountAssets = analyticsAssets.filter(a => a.status === "RESERVED").length;
  const vacantCount = analyticsAssets.filter(a => a.status === "VACANT").length;
  const totalAssetsCount = analyticsAssets.length;

  const demandData = analyticsSubTypes.map(subType => ({
    name: subType,
    "Registered Spaces": analyticsApplications.filter(a => a.subType === subType).length,
    "Allocated Units": analyticsApplications.filter(a => a.subType === subType && a.status !== "PENDING_ALLOCATION").length
  }));

  const occupancyData = [
    { name: "Vacant Units", value: vacantCount, color: "#cbd5e1" },
    { name: "Allocated/Reserved", value: reservedCountAssets, color: "#6366f1" },
    { name: "Occupied & Active", value: occupiedCount, color: "#10b981" }
  ].filter(d => d.value > 0);

  // "Projected Monthly" is a genuine estimate (occupied/reserved units x
  // standard rent rate) and is presented as such. "Collected Monthly" must
  // NOT be another estimate — it's derived from the real payment records
  // already logged against each application, summed for the current
  // calendar month only, so it reflects actual cash received.
  const currentMonthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const revenueData = analyticsSubTypes.map(subType => {
    const subTypeAssets = analyticsAssets.filter(a => a.subType === subType && (a.status === "OCCUPIED" || a.status === "RESERVED"));
    const totalProjected = subTypeAssets.reduce((sum, a) => sum + (a.baseRent || 150), 0);
    const collectedRevenue = analyticsApplications
      .filter(a => a.subType === subType)
      .flatMap(a => a.payments || [])
      .filter(p => (p.paymentDate || "").startsWith(currentMonthKey))
      .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
    return {
      name: subType,
      "Projected Monthly": totalProjected,
      "Collected Monthly": collectedRevenue
    };
  });

  const maleCount = analyticsApplications.filter(a => a.gender?.toUpperCase() === "MALE").length;
  const femaleCount = analyticsApplications.filter(a => a.gender?.toUpperCase() === "FEMALE").length;
  const genderData = [
    { name: "Female", value: femaleCount, color: "#ec4899" },
    { name: "Male", value: maleCount, color: "#3b82f6" }
  ].filter(d => d.value > 0);

  const occupancyRate = totalAssetsCount > 0 ? Math.round(((occupiedCount + reservedCountAssets) / totalAssetsCount) * 100) : 0;
  const totalProjectedBilling = analyticsAssets.filter(a => a.status === "OCCUPIED" || a.status === "RESERVED").reduce((sum, a) => sum + (a.baseRent || 150), 0);

  return (
    <div className="space-y-6" id="overview-dashboard-panel">
      {/* Upper Branding Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-150 shadow-sm">
        <div className="flex items-center gap-3">
          <MunicipalLogo size={52} />
          <div className="text-left">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Nsawam Municipal Assembly
            </span>
            <h2 className="text-xl font-bold tracking-tight text-indigo-950">
              Space & Housing Registry
            </h2>
          </div>
        </div>

        {/* User Login state & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active Staff Identity (Read-only for Production) */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-7 h-7 bg-indigo-900 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
              {(currentUser?.name || "G").substring(0, 1).toUpperCase()}
            </div>
            <div className="text-left text-xs">
              <span className="text-[8px] font-bold text-indigo-900 uppercase block tracking-wider">Active Staff Identity</span>
              <span className="font-bold text-[11px] text-slate-800 block mt-0.5">
                {currentUser?.name || "Guest"}
              </span>
            </div>
            
            {currentUser && (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border shrink-0 ${getRoleBadgeStyle(currentUser.role)}`}>
                {getRoleLabel(currentUser.role)}
              </span>
            )}

            <button
              onClick={onLogout}
              className="ml-1 text-slate-400 hover:text-red-500 transition-colors p-1"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {currentUser?.role !== "REGISTRAR" && (
            <button
              type="button"
              onClick={onOpenAssets}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-2xl transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <Landmark className="w-4 h-4 text-amber-500" /> Asset Registry
            </button>
          )}

          {currentUser?.role !== "REGISTRAR" && (
            <button
              type="button"
              onClick={() => setPrintAllAllocationLetters(true)}
              className="p-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-2xl transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Bulk print allocation letters for all allocated tenants"
            >
              <Printer className="w-4 h-4 text-indigo-700" /> Bulk Print Letters
            </button>
          )}

          {/* Export Data Dropdown */}
          {currentUser?.role !== "REGISTRAR" && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-2xl transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <Download className="w-4 h-4 text-indigo-600" /> Export Data
              </button>

              {showExportDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-15" 
                    onClick={() => setShowExportDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 py-1.5 text-left">
                    <div className="px-3 py-1.5 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Select Export Format
                      </span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        exportApplicationsToCSV(applications, categories);
                        setShowExportDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 transition-colors flex items-center gap-2.5"
                    >
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span>Applicants Log (CSV)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        exportAssetsToCSV(assets, categories);
                        setShowExportDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 transition-colors flex items-center gap-2.5"
                    >
                      <Landmark className="w-4 h-4 text-slate-400" />
                      <span>Assets Registry (CSV)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        exportSmsLogsToCSV(smsLogs);
                        setShowExportDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 transition-colors flex items-center gap-2.5"
                    >
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span>SMS Dispatch Logs (CSV)</span>
                    </button>

                    <div className="border-t border-slate-100 my-1"></div>

                    <button
                      type="button"
                      onClick={() => {
                        exportCompleteRegistryToJSON({ applications, categories, assets, smsLogs });
                        setShowExportDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-xs font-bold text-indigo-900 hover:bg-indigo-50 transition-colors flex items-center gap-2.5"
                    >
                      <Database className="w-4 h-4 text-indigo-600" />
                      <span>Full Registry Backup (JSON)</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {currentUser?.role === "SUPER_USER" && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-2xl transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <Settings className="w-4 h-4 text-indigo-900" /> Admin Panel
            </button>
          )}

          {currentUser && (
            <button
              type="button"
              onClick={onNewRegistration}
              className="px-4 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white font-bold rounded-2xl transition-all shadow-md hover:shadow-lg shadow-indigo-100 flex items-center gap-1.5 text-xs transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Register Space
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation Menu */}
      <div className="flex border-b border-slate-200 gap-6 px-2 overflow-x-auto">
        {currentUser?.role !== "REGISTRAR" && (
          <button
            type="button"
            onClick={() => setActiveTab("database")}
            className={`pb-3 text-xs uppercase font-extrabold tracking-wider transition-all border-b-2 relative flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === "database"
                ? "border-indigo-900 text-indigo-950 font-black"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Applicant Database
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
              {applications.length}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab("analytics")}
          className={`pb-3 text-xs uppercase font-extrabold tracking-wider transition-all border-b-2 relative flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "analytics"
              ? "border-indigo-900 text-indigo-950 font-black"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Analytical Insights Dashboard
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("billing")}
          className={`pb-3 text-xs uppercase font-extrabold tracking-wider transition-all border-b-2 relative flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "billing"
              ? "border-indigo-900 text-indigo-950 font-black"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          Rent Billing Center
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sms")}
          className={`pb-3 text-xs uppercase font-extrabold tracking-wider transition-all border-b-2 relative flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "sms"
              ? "border-indigo-900 text-indigo-950 font-black"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          SMS Notification Logs
        </button>
      </div>

      {activeTab === "analytics" ? (
        <div className="space-y-6 animate-fade-in text-left" id="dashboard-analytics-view">
          {/* Track Selection Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-150 shadow-sm">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Select Analytics Category Track</h3>
              <p className="text-[11px] text-slate-400">Filter all insights, capacity status, gender diversity, and projected lease revenues dynamically.</p>
            </div>
            <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner shrink-0 flex-wrap gap-1">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setAnalyticsTrackFilter(cat.id)}
                  className={`px-4 py-2.5 text-xs font-extrabold rounded-xl transition-all duration-200 cursor-pointer ${
                    analyticsTrackFilter === cat.id
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/10"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Total Physical Assets</span>
                <strong className="text-2xl font-extrabold text-slate-800">{totalAssetsCount}</strong>
                <span className="text-[10px] text-indigo-600 block font-semibold mt-0.5">Municipal spaces logged</span>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Occupancy Rate</span>
                <strong className="text-2xl font-extrabold text-slate-800">{occupancyRate}%</strong>
                <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${occupancyRate}%` }}></div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Awaiting Allocation</span>
                <strong className="text-2xl font-extrabold text-slate-800">{analyticsPendingCount}</strong>
                <span className="text-[10px] text-amber-600 block font-semibold mt-0.5">Applications pending</span>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-150 flex items-center justify-center text-purple-600 shrink-0">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Projected Lease/Month</span>
                <strong className="text-xl font-extrabold text-slate-800">{totalProjectedBilling.toLocaleString()} GHS</strong>
                <span className="text-[10px] text-purple-600 block font-semibold mt-0.5">Est. monthly billing</span>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Track Demand Bar Chart */}
            <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm lg:col-span-8 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-700" /> Space Demand by Track Category
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">Comparison of registered commercial space applicants versus allocated units per category track.</p>
              </div>

              <div className="h-64 mt-4 w-full text-xs">
                {demandData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={demandData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                      <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      <Bar dataKey="Registered Spaces" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Allocated Units" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-xs">No categories configured</div>
                )}
              </div>
            </div>

            {/* Asset Occupancy Status Pie Chart */}
            <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm lg:col-span-4 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-amber-500" /> Space Capacity Occupancy
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">Real-time breakdown of all municipal units and booths logged inside the directory.</p>
              </div>

              <div className="h-52 mt-4 relative flex items-center justify-center">
                {occupancyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={occupancyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {occupancyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} Units`, "Count"]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-xs">No physical assets registered</div>
                )}
                {totalAssetsCount > 0 && (
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-black text-slate-800">{totalAssetsCount}</span>
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Total Units</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 mt-2">
                {occupancyData.map((d, i) => (
                  <div key={i} className="flex justify-between items-center text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full block" style={{ backgroundColor: d.color }}></span>
                      <span className="text-slate-600 font-medium">{d.name}</span>
                    </div>
                    <strong className="text-slate-700">{d.value} ({Math.round((d.value / (totalAssetsCount || 1)) * 100)}%)</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Projected Revenue Area Chart */}
            <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm lg:col-span-7 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" /> Projected Rent billing by track
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">Sum of monthly base rent charges (GHS) generated from allocated/occupied units across municipal tracks.</p>
              </div>

              <div className="h-60 mt-4 w-full text-xs">
                {revenueData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorColl" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip formatter={(value) => [`${value} GHS`, "Rent Amount"]} />
                      <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      <Area type="monotone" dataKey="Projected Monthly" stroke="#6366f1" fillOpacity={1} fill="url(#colorProj)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Collected Monthly" stroke="#10b981" fillOpacity={1} fill="url(#colorColl)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-xs">No assets registered with base rent parameters</div>
                )}
              </div>
            </div>

            {/* Gender Equity Pie Chart */}
            <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm lg:col-span-5 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-pink-500" /> Applicant Gender Inclusivity
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">Analysis of gender distribution of registered retail operators and space applicants.</p>
              </div>

              <div className="h-48 mt-4 flex items-center justify-center">
                {genderData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={genderData}
                        cx="50%"
                        cy="50%"
                        innerRadius={0}
                        outerRadius={70}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        dataKey="value"
                      >
                        {genderData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} Operators`, "Count"]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-xs">No gender information defined in applicant records</div>
                )}
              </div>

              <div className="flex justify-around items-center bg-slate-50 border border-slate-100 p-3 rounded-2xl mt-2 text-xs">
                {genderData.map((d, i) => (
                  <div key={i} className="text-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{d.name}</span>
                    <strong className="text-base font-extrabold" style={{ color: d.color }}>{d.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (activeTab === "database" && currentUser?.role !== "REGISTRAR") ? (
        <>
          {/* Metrics Summary Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Metric: Total Registrations */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 text-left shadow-sm flex flex-col justify-between min-h-[96px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Registered</span>
              <div className="flex justify-between items-end mt-2">
                <span className="text-2xl font-bold text-slate-800">{totalCount}</span>
                <div className="w-7 h-7 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Metric: Stage 1 */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 text-left shadow-sm flex flex-col justify-between min-h-[96px]">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">1. Pending Allocation</span>
              <div className="flex justify-between items-end mt-2">
                <span className="text-2xl font-bold text-amber-600">{pendingCount}</span>
                <div className="w-7 h-7 bg-amber-50/50 border border-amber-100 rounded-lg flex items-center justify-center text-amber-500">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Metric: Stage 2 */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 text-left shadow-sm flex flex-col justify-between min-h-[96px]">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">2. Reserved</span>
              <div className="flex justify-between items-end mt-2">
                <span className="text-2xl font-bold text-indigo-750">{reservedCount}</span>
                <div className="w-7 h-7 bg-indigo-50/50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                  <MapPin className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Metric: Stage 3 */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 text-left shadow-sm flex flex-col justify-between min-h-[96px]">
              <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider block">3. Signed Agreement</span>
              <div className="flex justify-between items-end mt-2">
                <span className="text-2xl font-bold text-purple-600">{awaitingPaymentCount}</span>
                <div className="w-7 h-7 bg-purple-50/50 border border-purple-100 rounded-lg flex items-center justify-center text-purple-500">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Metric: Stage 4 */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 text-left col-span-2 lg:col-span-1 shadow-sm flex flex-col justify-between min-h-[96px]">
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">4. Occupied & Active</span>
              <div className="flex justify-between items-end mt-2">
                <span className="text-2xl font-bold text-emerald-600">{activeCount}</span>
                <div className="w-7 h-7 bg-emerald-50/50 border border-emerald-100 rounded-lg flex items-center justify-center text-emerald-500">
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Filter Toggles & Search */}
          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
              
              {/* Quick Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search by Applicant Name, Ghana Card, or Asset Code..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 outline-none text-xs transition-all"
                />
              </div>

              {/* Track Filter Options */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 mr-2 shrink-0">Track:</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                    selectedCategoryFilter === "all"
                      ? "bg-slate-800 text-white"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  All Categories
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                      selectedCategoryFilter === cat.id
                        ? "bg-indigo-900 text-white shadow-sm shadow-indigo-100"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Status filters */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-2 shrink-0">Lifecycle Stage:</span>
              <button
                type="button"
                onClick={() => setSelectedStatusFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  selectedStatusFilter === "all"
                    ? "bg-indigo-50 text-indigo-700 border-2 border-indigo-500/20"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                All Stages
              </button>
              
              <button
                type="button"
                onClick={() => setSelectedStatusFilter("PENDING_ALLOCATION")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  selectedStatusFilter === "PENDING_ALLOCATION"
                    ? "bg-amber-50 text-amber-700 border-2 border-amber-500/20"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                Pending Allocation
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatusFilter("RESERVED")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  selectedStatusFilter === "RESERVED"
                    ? "bg-indigo-50 text-indigo-700 border-2 border-indigo-500/20"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                Reserved
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatusFilter("AWAITING_PAYMENT")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  selectedStatusFilter === "AWAITING_PAYMENT"
                    ? "bg-purple-50 text-purple-700 border-2 border-purple-500/20"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                Agreement Signed
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatusFilter("OCCUPIED")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  selectedStatusFilter === "OCCUPIED"
                    ? "bg-emerald-50 text-emerald-700 border-2 border-emerald-500/20"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                Occupied
              </button>
            </div>
          </div>

          {/* Applications list Grid */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                  Applicant Database Log ({filteredApplications.length})
                </h3>
                {filteredApplications.length !== applications.length && (
                  <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 font-bold px-2.5 py-0.5 rounded-full">
                    Filtered ({filteredApplications.length} of {applications.length} total)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPrintAllAllocationLetters(true)}
                  className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                  title="Bulk print allocation letters for allocated applicants"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-700" />
                  <span>Bulk Print Letters</span>
                </button>

                {pendingAllocationList.length > 0 && (
                  <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    {pendingAllocationList.length} Pending Store Selection
                  </span>
                )}
                {(searchTerm || selectedCategoryFilter !== "all" || selectedStatusFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedCategoryFilter("all");
                      setSelectedStatusFilter("all");
                    }}
                    className="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
                  >
                    Reset Filters ({applications.length} Total)
                  </button>
                )}
                <span className="text-[10px] text-slate-400 font-medium hidden md:inline">Click any card to execute progression</span>
              </div>
            </div>

            {/* Allocation Summary Banner */}
            <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 rounded-3xl p-5 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-400 text-slate-950 tracking-wider">
                    Allocation Summary
                  </span>
                  <span className="text-xs text-indigo-200">Letter & Space Tracking</span>
                </div>
                <h3 className="text-base font-extrabold tracking-tight">
                  Total Allocated Spaces: <span className="text-amber-300 font-mono text-lg">{allocatedCount}</span>
                </h3>
                <p className="text-xs text-indigo-200 max-w-xl">
                  Track individual and bulk allocation letters issued and confirmed printed across municipal tracks.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                <div className="bg-white/10 backdrop-blur border border-white/15 rounded-2xl px-4 py-2 text-center">
                  <span className="text-[10px] uppercase font-bold text-indigo-200 block">Letters Printed</span>
                  <span className="text-xl font-black text-emerald-400">{printedAllocationLettersCount} / {allocatedCount}</span>
                </div>
                <div className="bg-white/10 backdrop-blur border border-white/15 rounded-2xl px-4 py-2 text-center">
                  <span className="text-[10px] uppercase font-bold text-indigo-200 block">Pending Print</span>
                  <span className="text-xl font-black text-amber-300">{Math.max(0, allocatedCount - printedAllocationLettersCount)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPrintAllAllocationLetters(true)}
                  className="px-3.5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs rounded-2xl transition-all shadow-lg inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4 text-slate-950" />
                  <span>Bulk Print Letters</span>
                </button>
              </div>
            </div>

            {allocationSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-3.5 text-xs flex items-center justify-between font-medium animate-fade-in shadow-sm">
                <span>{allocationSuccessMsg}</span>
                <button type="button" onClick={() => setAllocationSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 font-bold underline ml-2 cursor-pointer">
                  Dismiss
                </button>
              </div>
            )}

            {filteredApplications.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredApplications.map(app => {
                  const appCat = categories.find(c => c.id === app.categoryId);
                  const isAllocated = app.status === "RESERVED" || app.status === "AWAITING_PAYMENT" || app.status === "OCCUPIED" || !!app.assetCode;
                  return (
                    <div
                      key={app.id}
                      onClick={() => onSelectApplication(app)}
                      className="bg-white rounded-3xl border border-slate-150 p-4 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer flex gap-4 text-left group"
                    >
                      {/* Avatar thumbnail — deliberately a static placeholder,
                          not a per-row photo fetch. The applicant photo now
                          lives in application_media/{id} (see types.ts), and
                          fetching it for every row in this list would
                          reintroduce the exact N-way read cost that moving
                          it out of the applications doc was meant to avoid.
                          The real photo is one click away in the detail view. */}
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 relative shadow-inner">
                        <div className="w-full h-full flex items-center justify-center text-slate-350">
                          <User className="w-6 h-6" />
                        </div>
                        <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-[8px] text-center text-white py-0.5 leading-none">
                          {app.id}
                        </span>
                      </div>

                      {/* Body info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="text-sm font-bold text-slate-800 truncate leading-tight">
                              {app.firstName} {app.surname}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusStyle(app.status)}`}>
                                {getStatusLabel(app.status)}
                              </span>
                              {currentUser?.role === "SUPER_USER" && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteAppFromDashboard(app, e)}
                                  className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-mono text-slate-400">
                              {app.ghanaCardNumber}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[10px] font-bold text-indigo-600">
                              {appCat?.name || "EAV Track"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-505 font-semibold bg-slate-50 border border-slate-200/50 px-2 py-0.5 rounded-md">
                              {app.subType}
                            </span>
                            {isAllocated && (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const newPrinted = !app.allocationLetterPrinted;
                                    await updateDoc(doc(db, "applications", app.id), {
                                      allocationLetterPrinted: newPrinted,
                                      allocationLetterPrintedAt: newPrinted ? new Date().toISOString() : null,
                                      updatedAt: new Date().toISOString()
                                    });
                                  } catch (err) {
                                    console.error("Failed to toggle letter printed status:", err);
                                  }
                                }}
                                className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border transition-all cursor-pointer flex items-center gap-1 ${
                                  app.allocationLetterPrinted
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                                    : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                                }`}
                                title={app.allocationLetterPrinted ? "Allocation letter confirmed printed. Click to toggle." : "Click to confirm allocation letter printed."}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{app.allocationLetterPrinted ? "Printed ✓" : "Confirm Printed"}</span>
                              </button>
                            )}
                          </div>
                          {app.assetCode ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded-md border border-indigo-100">
                                {app.assetCode}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleUnlinkStoreFromDashboard(app, e)}
                                className="text-[9px] bg-red-50 hover:bg-red-100 active:scale-95 text-red-700 font-extrabold px-1.5 py-0.5 rounded-md border border-red-200/80 transition-all cursor-pointer"
                                title="Unlink store and release to VACANT status"
                              >
                                Unlink
                              </button>
                            </div>
                          ) : app.status === "PENDING_ALLOCATION" ? (
                            <button
                              type="button"
                              onClick={(e) => handleOpenStoreSelector(app, e)}
                              className="text-[10px] bg-indigo-900 hover:bg-indigo-800 active:scale-95 text-white font-extrabold px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                              title="Choose specific physical store for this applicant"
                            >
                              <Building className="w-3 h-3 text-amber-400" /> Choose Store
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center text-slate-400 space-y-3 shadow-inner">
                <Filter className="w-10 h-10 text-slate-300 mx-auto" />
                <div>
                  <p className="text-sm font-bold text-slate-700">No applicant profiles match selection</p>
                  <p className="text-xs text-slate-400 mt-1">Try resetting filters or registering a new commercial/residential space applicant</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedCategoryFilter("all");
                    setSelectedStatusFilter("all");
                  }}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all mt-2 cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </>
      ) : activeTab === "sms" ? (
        <div className="space-y-6 animate-fade-in text-left font-sans" id="sms-tracking-panel">
          {/* Diagnostic KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Total Dispatched</span>
                <strong className="text-2xl font-extrabold text-slate-800">{smsLogs.length}</strong>
                <span className="text-[10px] text-indigo-600 block font-semibold mt-0.5">Logged notifications</span>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Delivery Success Rate</span>
                <strong className="text-2xl font-extrabold text-slate-800">
                  {/* Was hardcoded to "100%" when zero messages had ever
                      been sent, falsely implying perfect delivery. */}
                  {smsLogs.length > 0
                    ? `${Math.round((smsLogs.filter(l => l.status === "SUCCESS").length / smsLogs.length) * 100)}%`
                    : "—"}
                </strong>
                <span className="text-[10px] text-emerald-600 block font-semibold mt-0.5">
                  {smsLogs.length > 0
                    ? `${smsLogs.filter(l => l.status === "SUCCESS").length} of ${smsLogs.length} ok`
                    : "No messages sent yet"}
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Gateway Client ID</span>
                <strong className="text-2xl font-extrabold text-slate-800">
                  {smsLogs.length > 0 && smsLogs.find(l => l.clientId)?.clientId ? smsLogs.find(l => l.clientId)?.clientId : "Active"}
                </strong>
                <span className="text-[10px] text-slate-500 block font-semibold mt-0.5">Wigal numeric clientid</span>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-150 flex items-center justify-center text-purple-600 shrink-0">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Gateway Sender ID</span>
                <strong className="text-2xl font-extrabold text-slate-800">
                  {smsLogs.length > 0 && smsLogs.find(l => l.senderId)?.senderId ? smsLogs.find(l => l.senderId)?.senderId : "NAMA"}
                </strong>
                <span className="text-[10px] text-purple-600 block font-semibold mt-0.5">Wigal numeric index</span>
              </div>
            </div>
          </div>

          {/* Interactive Bento Layout: Logs List vs Quick Sender Test Utility */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Logs List (8 columns) */}
            <div className="lg:col-span-8 bg-white border border-slate-150 rounded-3xl p-6 shadow-sm flex flex-col h-[600px]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">SMS Dispatch History</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Real-time audit log of all system triggers to Wigal SMS gateway.</p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* Status Pills */}
                  <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setSmsStatusFilter("all")}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        smsStatusFilter === "all"
                          ? "bg-white text-indigo-950 shadow-sm"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSmsStatusFilter("SUCCESS")}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        smsStatusFilter === "SUCCESS"
                          ? "bg-white text-emerald-700 shadow-sm"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      Ok
                    </button>
                    <button
                      type="button"
                      onClick={() => setSmsStatusFilter("FAILED")}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        smsStatusFilter === "FAILED"
                          ? "bg-white text-red-700 shadow-sm"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      Failures
                    </button>
                  </div>
                </div>
              </div>

              {/* Filter / Search Bar */}
              <div className="py-3 shrink-0 flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={smsSearch}
                    onChange={(e) => setSmsSearch(e.target.value)}
                    placeholder="Search logs by recipient phone or message..."
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-indigo-500 font-medium bg-slate-50 transition-all focus:bg-white"
                  />
                </div>
              </div>

              {/* Logs Scroll List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                {filteredSmsLogs.length > 0 ? (
                    filteredSmsLogs
                      .map((log) => (
                        <div
                          key={log.id}
                          className={`p-4 rounded-2xl border transition-all flex gap-3 ${
                            log.status === "SUCCESS"
                              ? "bg-slate-50/50 border-slate-150 hover:bg-slate-50"
                              : "bg-red-50/30 border-red-100 hover:bg-red-50/50"
                          }`}
                        >
                          <div className={`w-2 shrink-0 rounded-full ${
                            log.status === "SUCCESS" ? "bg-emerald-500" : "bg-red-500"
                          }`} />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs font-mono font-extrabold text-slate-800">
                                {log.to}
                              </span>
                              <span className="text-[9px] font-mono text-slate-400">
                                {new Date(log.sentAt).toLocaleString()}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 mt-1 leading-normal break-words">
                              {log.message}
                            </p>

                            {/* Additional metadata info row */}
                            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100/50 text-[9px] font-mono text-slate-400">
                              <span>HTTP Code: <strong>{log.statusCode}</strong></span>
                              <span>•</span>
                              <span>Client ID: <strong>{log.clientId || "Active"}</strong></span>
                              <span>•</span>
                              <span>Sender ID Index: <strong>{log.senderId || "NAMA"}</strong></span>
                            </div>

                            {log.error && (
                              <div className="mt-2 p-2 bg-red-100/40 border border-red-100 text-[10px] text-red-700 rounded-xl flex items-start gap-1.5 font-medium leading-relaxed">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-500 mt-0.5" />
                                <div>
                                  <strong className="block uppercase text-[8px] tracking-wider mb-0.5">Gateway Error Description:</strong>
                                  {log.error}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-12">
                      <Mail className="w-10 h-10 text-slate-300" />
                      <p className="text-xs font-bold text-slate-600">No matching SMS logs found</p>
                      <p className="text-[10px] text-slate-400">Send a test message on the right or trigger a registration to begin.</p>
                    </div>
                  )}
              </div>
            </div>

            {/* Right: Interactive Test Panel / Gateway Overview (4 columns) */}
            <div className="lg:col-span-4 bg-white border border-slate-150 rounded-3xl p-6 shadow-sm flex flex-col h-[600px] justify-between">
              {currentUser?.role === "SUPER_USER" ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" /> Authorized Gateway Diagnostics
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Administrator Diagnostic Tool: Directly test the Wigal SMS transmission flow. Seeding valid variables in the environment secrets enables live delivery.
                    </p>
                  </div>

                  <form onSubmit={handleSendTestSms} className="space-y-3.5 text-left">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        Recipient Number
                      </label>
                      <input
                        type="text"
                        value={testSmsPhone}
                        onChange={(e) => setTestSmsPhone(e.target.value)}
                        placeholder="e.g. 0546867491"
                        required
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-indigo-500 font-bold bg-slate-50 transition-all focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        Message Content
                      </label>
                      <textarea
                        value={testSmsMessage}
                        onChange={(e) => setTestSmsMessage(e.target.value)}
                        placeholder="Enter SMS body content..."
                        required
                        rows={5}
                        maxLength={160}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-indigo-500 font-semibold bg-slate-50 transition-all focus:bg-white resize-none leading-relaxed"
                      />
                      <div className="text-right text-[9px] text-slate-400 font-bold">
                        {testSmsMessage.length}/160 characters
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={testSmsLoading}
                      className="w-full py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-bold text-xs transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testSmsLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Transmitting...
                        </>
                      ) : (
                        <>
                          <Mail className="w-3.5 h-3.5" />
                          Transmit Test Message
                        </>
                      )}
                    </button>
                  </form>

                  {/* Live Output Log Banner */}
                  {testSmsStatus && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-800 rounded-2xl flex items-start gap-2 animate-fade-in font-medium leading-normal">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold text-[10px] uppercase tracking-wider mb-0.5 text-emerald-900">Success Status</strong>
                        {testSmsStatus}
                      </div>
                    </div>
                  )}

                  {testSmsError && (
                    <div className="p-3.5 bg-red-50 border border-red-100 text-[11px] text-red-800 rounded-2xl flex items-start gap-2 animate-fade-in font-medium leading-normal">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold text-[10px] uppercase tracking-wider mb-0.5 text-red-950">Gateway Failure</strong>
                        {testSmsError}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5 text-left">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500" /> Gateway Integration Live
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      The Nsawam SMS notification pipeline is fully operational in production mode.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Automated Notification Triggers</h4>
                    <ul className="space-y-2.5 text-xs text-slate-600 font-medium">
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                        <span><strong>Registration:</strong> Sent instantly when an applicant's space application is saved in the database.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                        <span><strong>Allocation:</strong> Sent when a specific physical asset or shed code is assigned to the applicant.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                        <span><strong>Payment:</strong> Sent when an installment or base rent lease payment is registered with a manual receipt number.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-950 flex gap-2">
                    <Info className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                    <p className="leading-normal">
                      Custom SMS templates can be modified by going to the <strong>Admin Panel &gt; SMS Notification Templates</strong> tab. Only authorized administrators can perform direct manual diagnostic transmissions.
                    </p>
                  </div>
                </div>
              )}

              {/* helpful instructional footer details */}
              <div className="border-t border-slate-100 pt-4 text-slate-450 leading-relaxed text-[10px]">
                <strong className="text-slate-700 block uppercase text-[9px] tracking-wider mb-1">Evaluating the API connection:</strong>
                If you get a <strong>403 Permission Denied</strong> or <strong>400 Bad Request</strong>, please confirm that your <strong>API Token</strong>, <strong>Client ID</strong>, and <strong>Sender ID</strong> values are fully authorized together by the provider.
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "billing" ? (
        <div className="space-y-6 animate-fade-in text-left font-sans" id="rent-billing-panel">
          {/* Diagnostic / Overview KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Eligible Tenancies</span>
                <strong className="text-2xl font-extrabold text-slate-800">{activeTenants.length}</strong>
                <span className="text-[10px] text-indigo-600 block font-semibold mt-0.5">Active or occupied</span>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Store Rate</span>
                <strong className="text-2xl font-extrabold text-slate-800">{rentRates?.storeRentRate ?? 150} GHS/mo</strong>
                <span className="text-[10px] text-amber-600 block font-semibold mt-0.5">Central fee fixing</span>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Shed/Stall Rate</span>
                <strong className="text-2xl font-extrabold text-slate-800">{rentRates?.shedRentRate ?? 80} GHS/mo</strong>
                <span className="text-[10px] text-teal-600 block font-semibold mt-0.5">Central fee fixing</span>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-800 shrink-0">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Grounds Rate</span>
                <strong className="text-2xl font-extrabold text-slate-800">{rentRates?.groundsRentRate ?? 100} GHS/mo</strong>
                <span className="text-[10px] text-indigo-600 block font-semibold mt-0.5">Central fee fixing</span>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <Calculator className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Cycle Value Est.</span>
                <strong className="text-2xl font-extrabold text-emerald-800">
                  {activeTenants.reduce((sum, app) => sum + (app.subType ? getCentralRentRate(app.subType, rentRates) : 150) * 12, 0).toLocaleString()} GHS
                </strong>
                <span className="text-[10px] text-emerald-600 block font-semibold mt-0.5">Combined annual rent</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Controls and Status */}
            <div className="lg:col-span-5 bg-white border border-slate-150 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-indigo-700" /> Rent Billing Engine
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Allows administrators to generate rent bills for all active tenancies based on the current system date and the configured rent rates per shed/store.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">System Context</span>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Reference System Date:</span>
                    <strong className="text-slate-800 font-bold">
                      {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-200">
                    <span className="text-slate-500 font-medium">Active Tenants Count:</span>
                    <strong className="text-slate-800 font-bold">{activeTenants.length}</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-200">
                    <span className="text-slate-500 font-medium">Gateway Dispatcher:</span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px] font-black uppercase tracking-wider">Wigal SMS OK</span>
                  </div>
                </div>

                <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-950 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                    <Info className="w-4 h-4 text-indigo-700 shrink-0" />
                    <span>How bulk generation works:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1.5 text-indigo-900/80 font-medium">
                    <li>Reads each tenant's assigned asset sub-type (Store or Shed).</li>
                    <li>Fetches the configured rates ({rentRates?.storeRentRate ?? 150} GHS/mo for Stores, {rentRates?.shedRentRate ?? 80} GHS/mo for Sheds).</li>
                    <li>Increments their lease year to the next period.</li>
                    <li>Transmits an official SMS notification to the tenant's phone with the payment information.</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 space-y-4">
                {isGeneratingBills ? (
                  <div className="space-y-3.5">
                    <div className="flex justify-between text-xs font-bold text-indigo-950">
                      <span>{generationStatus}</span>
                      <span>{Math.round((generationProgress / generationTotal) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full transition-all duration-300" 
                        style={{ width: `${(generationProgress / generationTotal) * 100}%` }}
                      ></div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono text-right">
                      Processing {generationProgress} of {generationTotal} records
                    </div>
                  </div>
                ) : generationResults ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-2.5">
                      <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold text-emerald-950 text-xs uppercase tracking-wider mb-0.5">Run Complete</strong>
                        <p className="text-xs text-emerald-800 leading-normal font-medium">{generationResults}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGenerationResults(null)}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Reset Generator
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateAnnualBills}
                    disabled={activeTenants.length === 0}
                    className="w-full py-3 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-bold text-xs transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Calculator className="w-4 h-4" />
                    Generate Bills for {activeTenants.length} Tenancies
                  </button>
                )}
              </div>
            </div>

            {/* Right: Tenant preview list */}
            <div className="lg:col-span-7 bg-white border border-slate-150 rounded-3xl p-6 shadow-sm flex flex-col h-[600px]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Eligible Active Tenancies</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Below is the ledger of tenants scheduled for bulk billing.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-60">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      value={billingSearch}
                      onChange={(e) => setBillingSearch(e.target.value)}
                      placeholder="Search tenant or code..."
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-indigo-500 font-semibold bg-slate-50 transition-all focus:bg-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenBulkPrintBills()}
                    disabled={billingFilteredTenants.length === 0}
                    className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
                    title="Print all bills in the list"
                    id="print-all-bills-btn"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print All</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 pt-2 divide-y divide-slate-100 scrollbar-none">
                {billingFilteredTenants.length > 0 ? (
                  billingFilteredTenants.map((app) => {
                    const monthlyRate = app.subType ? getCentralRentRate(app.subType, rentRates) : 150;
                    const annualRate = monthlyRate * 12;
                    return (
                      <div key={app.id} className="py-3 flex justify-between items-center hover:bg-slate-50/50 px-2 rounded-xl transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-slate-500" />
                          </div>
                          <div>
                            <strong className="text-xs text-slate-800 block font-bold">
                              {app.firstName} {app.surname}
                            </strong>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                              <span>Asset: {app.assetCode || "PENDING"}</span>
                              <span>•</span>
                              <span className="text-indigo-900">{app.subType || "store"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-xs text-slate-900 font-extrabold block">
                              {annualRate.toLocaleString()} GHS / yr
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold block mt-0.5 uppercase tracking-wider">
                              Year {app.currentLeaseYear || 1} ➔ {(app.currentLeaseYear || 1) + 1}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenPrintBill(app)}
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-all active:scale-90 border border-indigo-100/60 flex items-center justify-center cursor-pointer shrink-0"
                            title="Print Bill Hard Copy"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 space-y-3">
                    <Search className="w-8 h-8 text-slate-300" />
                    <div>
                      <p className="text-xs font-bold text-slate-700">No matching active tenancies</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Try searching with another name or space code.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Annual Rent Billing Confirmation/Progress Modal */}
      {billingModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-left font-sans" id="annual-billing-modal">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center gap-3 text-indigo-900 border-b border-slate-100 pb-3">
              <div className="p-2 bg-indigo-50 rounded-xl">
                <Calculator className="w-6 h-6 text-indigo-700" />
              </div>
              <div>
                <h3 className="text-base font-extrabold tracking-tight">Generate Annual Rent Bills</h3>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Nsawam Municipal Assembly Estate Unit</p>
              </div>
            </div>

            {!isGeneratingBills && !generationResults ? (
              <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
                <p>
                  You are about to launch the bulk annual rent billing generator. This operation will update all active tenancy records within the municipality:
                </p>

                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-2.5">
                  <div className="flex justify-between text-[11px] border-b border-slate-200/50 pb-1.5 font-medium">
                    <span>Target Active Tenancies:</span>
                    <strong className="text-slate-800 font-bold">{activeTenants.length} spaces</strong>
                  </div>
                  <div className="flex justify-between text-[11px] border-b border-slate-200/50 pb-1.5 font-medium">
                    <span>Cycle Advance Action:</span>
                    <strong className="text-indigo-700 font-bold">Lease Year ➔ Year + 1</strong>
                  </div>
                  <div className="flex justify-between text-[11px] font-medium">
                    <span>Pricing Standard:</span>
                    <strong className="text-slate-800 font-bold">Fee Fixing Guidelines (Stores & Sheds)</strong>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-amber-800 flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold text-[11px] block text-amber-900">SMS Broadcast Alert</strong>
                    Each tenant will automatically receive a standard SMS notification via the Wigal Gateway containing their updated Year billing parameters and payment code.
                  </div>
                </div>

                <div className="flex justify-end gap-2 text-xs pt-2">
                  <button
                    type="button"
                    onClick={() => setBillingModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={activeTenants.length === 0}
                    onClick={handleGenerateAnnualBills}
                    className="px-5 py-2 bg-indigo-900 hover:bg-indigo-850 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center gap-1.5"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Run Billing Generator</span>
                  </button>
                </div>
              </div>
            ) : isGeneratingBills ? (
              <div className="space-y-4 text-center py-6">
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin"></div>
                  <Calculator className="w-6 h-6 text-indigo-600 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <strong className="text-xs font-bold text-slate-800 block">Processing Bulk Invoicing Cycle</strong>
                  <p className="text-[11px] text-slate-400 font-medium">{generationStatus}</p>
                </div>

                <div className="max-w-xs mx-auto space-y-1.5 pt-2">
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>Progress</span>
                    <span>{generationProgress} of {generationTotal}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(generationProgress / (generationTotal || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-slate-600">
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-2.5">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-emerald-900 font-bold text-sm">Bulk Invoicing Completed Successfully!</strong>
                    <p className="text-[11px] text-emerald-800 leading-relaxed mt-1 font-medium">
                      {generationResults}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  All active lease contracts have been advanced to their next annual billing cycle and standard GHS rent dues have been loaded to each client's ledger. Dispatch logs have been recorded under the SMS tab.
                </p>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBillingModalOpen(false);
                      setGenerationResults(null);
                    }}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors"
                  >
                    Close Panel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Printable Rent Bill Hard Copy Modal */}
      {selectedPrintBillApp && (
        <div 
          className="fixed inset-0 z-[150] flex items-start justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" 
          id="rent-bill-print-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedPrintBillApp(null);
            }
          }}
        >
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #printable-rent-bill-document, #printable-rent-bill-document * {
                visibility: visible;
              }
              #printable-rent-bill-document {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                border: none !important;
                padding: 0 !important;
                box-shadow: none !important;
              }
            }
          `}</style>
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-left print:p-0 print:shadow-none print:border-none print:rounded-none my-auto">
            {/* Action Bar (hidden when printing) */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 print:hidden">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rent Bill Demand Notice Printer</h3>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { window.focus(); window.print(); }}
                  className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs rounded-lg shadow inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Demand Notice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPrintBillApp(null)}
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
                  <span className="font-bold">Embedded Preview Environment:</span> If your browser security blocks printing or nothing happens when you click "Print Demand Notice", please click the <strong className="font-semibold">Open in New Tab</strong> button in the top right of the screen and run the Print action there.
                </div>
              </div>
            )}

            {/* Signature Settings Panel */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 print:hidden font-sans">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setShowSignatureSettings(!showSignatureSettings)}
                  className="flex justify-between items-center text-xs font-bold text-slate-700 uppercase tracking-wider focus:outline-none cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">✍️ Bill Signature Pads</span>
                  <span className="text-[10px] text-indigo-600 font-semibold ml-2">{showSignatureSettings ? "Hide Pads" : "Show Pads"}</span>
                </button>

                <div className="flex items-center gap-1.5 select-none">
                  <input
                    type="checkbox"
                    id="omit-bill-signatures-chk"
                    checked={omitBillSignatures}
                    onChange={e => setOmitBillSignatures(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-900 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="omit-bill-signatures-chk" className="text-[10px] text-slate-600 font-bold cursor-pointer">
                    Sign Manually (Leave empty for print out)
                  </label>
                </div>
              </div>
              
              {showSignatureSettings && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-150">
                  <SignaturePad
                    label="Estate / Leasing Officer Signature"
                    placeholderText="Draw signature or upload for Estate Officer"
                    initialValue={estateOfficerSig}
                    onSave={(dataUrl) => {
                      setEstateOfficerSig(dataUrl || null);
                      if (dataUrl) {
                        localStorage.setItem("signature_estate_officer", dataUrl);
                      } else {
                        localStorage.removeItem("signature_estate_officer");
                      }
                    }}
                  />
                  <SignaturePad
                    label="Municipal Finance Director Signature"
                    placeholderText="Draw signature or upload for Finance Director"
                    initialValue={financeDirectorSig}
                    onSave={(dataUrl) => {
                      setFinanceDirectorSig(dataUrl || null);
                      if (dataUrl) {
                        localStorage.setItem("signature_finance_director", dataUrl);
                      } else {
                        localStorage.removeItem("signature_finance_director");
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Document Content */}
            <div 
              id="printable-rent-bill-document" 
              className="p-8 border border-slate-300 rounded-2xl bg-white space-y-6 relative print:border-none print:p-0 text-slate-800 text-[11px] leading-relaxed"
            >
              {/* Header section with coat of arms and details */}
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
                  <h4 className="text-[12px] font-extrabold tracking-tight text-slate-950 font-sans uppercase">
                    {rentBillTemplate?.title || "Nsawam Adoagyiri Municipal Assembly"}
                  </h4>
                  <p className="text-[8px] uppercase font-bold text-slate-600 mt-0.5 tracking-wider">
                    {rentBillTemplate?.subTitle || "Finance & Estate Management Department"}
                  </p>
                  <p className="text-[8px] text-slate-500 font-medium font-mono">
                    {rentBillTemplate?.boxAddress || "P.O. BOX 45, NSAWAM, EASTERN REGION, GHANA"}
                  </p>
                  <h5 className="text-[11px] font-extrabold text-indigo-950 mt-3 uppercase underline tracking-widest font-serif">
                    OFFICIAL RENT BILL & DEMAND NOTICE
                  </h5>
                  <p className="text-[7px] font-mono text-indigo-900 font-bold mt-0.5 uppercase">
                    BILLING CYCLE REF: NAMA-RENT-{(selectedPrintBillApp.currentLeaseYear || 1) + 1}-{selectedPrintBillApp.id.substring(0, 6).toUpperCase()}
                  </p>
                </div>

                <div className="text-right shrink-0 flex flex-col justify-between h-20">
                  <div className="border border-slate-200 p-2 rounded bg-slate-50/50 text-[8px] font-mono text-slate-600 space-y-0.5">
                    <div><strong>BILL NO:</strong> {selectedPrintBillApp.rentBillNo || `NB-${selectedPrintBillApp.id.substring(0, 6).toUpperCase()}-PENDING`}</div>
                    <div><strong>DATE:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}</div>
                    <div><strong>DUE DATE:</strong> 30 Days from issue</div>
                  </div>
                </div>
              </div>

              {/* Tenant Details Grid */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1 bg-slate-50/60 border border-slate-150 p-3 rounded-xl">
                  <span className="text-slate-400 block text-[8px] uppercase font-bold tracking-wider">Tenant Profile</span>
                  <div className="text-xs font-black text-slate-900">
                    {selectedPrintBillApp.firstName} {selectedPrintBillApp.surname}
                  </div>
                  <div className="text-[10px] text-slate-600 font-medium">
                    Phone: {selectedPrintBillApp.contactNumber || "N/A"}
                  </div>
                  <div className="text-[10px] text-slate-600 font-medium">
                    National ID: {selectedPrintBillApp.ghanaCardNumber || "N/A"}
                  </div>
                </div>

                <div className="space-y-1 bg-slate-50/60 border border-slate-150 p-3 rounded-xl">
                  <span className="text-slate-400 block text-[8px] uppercase font-bold tracking-wider">Space Location Details</span>
                  <div className="text-xs font-black text-slate-900">
                    Asset Code: {selectedPrintBillApp.assetCode || "PENDING"}
                  </div>
                  <div className="text-[10px] text-slate-600 font-medium">
                    Type / Class: <span className="uppercase font-bold text-indigo-950">{selectedPrintBillApp.subType || "Store"}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 font-medium">
                    Track: {categories.find(c => c.id === selectedPrintBillApp.categoryId)?.name || "Market Space Directory"}
                  </div>
                </div>
              </div>

              {/* Invoice Fee Table */}
              <div className="pt-2">
                <table className="w-full border-collapse border border-slate-300 text-left text-[10px]">
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
                      <td className="p-2">
                        <strong className="block text-slate-900 font-bold uppercase">
                          Year {(selectedPrintBillApp.currentLeaseYear || 1) + 1} Annual Rent Lease Covenant
                        </strong>
                        <span className="text-slate-500 text-[9px]">
                          Commercial rate fixing resolution for space {selectedPrintBillApp.assetCode || "N/A"} ({selectedPrintBillApp.subType || "store"})
                        </span>
                      </td>
                      <td className="p-2 text-center text-slate-600">12 Months</td>
                      <td className="p-2 text-right font-mono text-slate-600">
                        {(selectedPrintBillApp.subType ? getCentralRentRate(selectedPrintBillApp.subType, rentRates) : 150).toLocaleString()} GHS
                      </td>
                      <td className="p-2 text-right font-mono text-slate-900 font-extrabold">
                        {((selectedPrintBillApp.subType ? getCentralRentRate(selectedPrintBillApp.subType, rentRates) : 150) * 12).toLocaleString()}.00
                      </td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td colSpan={3} className="p-2 text-right font-bold text-slate-700 uppercase">Total Rent Demand</td>
                      <td className="p-2 text-right font-mono text-xs font-black text-indigo-950">
                        {((selectedPrintBillApp.subType ? getCentralRentRate(selectedPrintBillApp.subType, rentRates) : 150) * 12).toLocaleString()}.00 GHS
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Instructions Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block">IMPORTANT PAYMENT GUIDELINES</span>
                <p className="text-[9px] text-slate-600 leading-normal whitespace-pre-wrap">
                  {rentBillTemplate?.paymentGuidelines || `1. Payments are due and payable within thirty (30) days of service of this notice.\n2. All payments must be made to the Nsawam Municipal Assembly Finance Office at the treasury cashier desks, or via official banker's draft.\n3. Please present this bill demand notice at the time of payment to ensure correct credit allocation to your file.\n4. Unsettled rent beyond the 30-day grace period may attract standard administrative surcharges or result in lease review.`}
                </p>
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-3 gap-6 pt-6 items-end">
                <div className="text-center border-t border-slate-300 pt-2 flex flex-col items-center justify-end">
                  {estateOfficerSig && !omitBillSignatures ? (
                    <img src={estateOfficerSig} alt="Estate Officer Signature" className="max-h-12 max-w-[120px] object-contain mb-1" />
                  ) : (
                    <div className="h-6" />
                  )}
                  <span className="text-[9px] font-bold text-slate-500 block">
                    {globalSignature?.signeeName || "Estate / Leasing Officer"}
                  </span>
                  <span className="text-[8px] text-slate-400 block mt-1 uppercase">
                    {globalSignature?.signeeTitle || "NSAWAM MUNICIPALITY"}
                  </span>
                </div>
                <div className="text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 border border-dashed border-slate-300 rounded-full flex items-center justify-center text-slate-350 text-[8px] font-bold uppercase tracking-wider">
                    Stamp Here
                  </div>
                  <span className="text-[8px] text-slate-400 block mt-1 uppercase">Official Stamp Box</span>
                </div>
                <div className="text-center border-t border-slate-300 pt-2 flex flex-col items-center justify-end">
                  {financeDirectorSig && !omitBillSignatures ? (
                    <img src={financeDirectorSig} alt="Finance Director Signature" className="max-h-12 max-w-[120px] object-contain mb-1" />
                  ) : (
                    <div className="h-6" />
                  )}
                  <span className="text-[9px] font-bold text-slate-500 block">
                    {globalSignature?.signeeName || "Municipal Finance Director"}
                  </span>
                  <span className="text-[8px] text-slate-400 block mt-1 uppercase">
                    {globalSignature?.signeeTitle || "APPROVED SIGNATORY"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Rent Bills Bulk Modal */}
      {printAllBills && (
        <div 
          className="fixed inset-0 z-[150] flex items-start justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" 
          id="rent-bills-bulk-print-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPrintAllBills(false);
            }
          }}
        >
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #printable-rent-bills-container, #printable-rent-bills-container * {
                visibility: visible;
              }
              #printable-rent-bills-container {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white !important;
              }
              .bulk-bill-page {
                page-break-after: always;
                break-after: page;
                break-inside: avoid;
                page-break-inside: avoid;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
                height: auto;
              }
            }
          `}</style>
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-left print:p-0 print:shadow-none print:border-none print:rounded-none my-auto">
            {/* Action Bar (hidden when printing) */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 print:hidden">
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bulk Rent Bill Demand Notice Printer</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Ready to print {billingFilteredTenants.length} demand notices in a single continuous batch.
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { window.focus(); window.print(); }}
                  className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs rounded-lg shadow inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print All Bills</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintAllBills(false)}
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
                  <span className="font-bold">Embedded Preview Environment:</span> If your browser security blocks printing or nothing happens when you click "Print All Bills", please click the <strong className="font-semibold">Open in New Tab</strong> button in the top right of the screen and run the Print action there.
                </div>
              </div>
            )}

            {/* Signature Settings Panel */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 print:hidden font-sans">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setShowSignatureSettings(!showSignatureSettings)}
                  className="flex justify-between items-center text-xs font-bold text-slate-700 uppercase tracking-wider focus:outline-none cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">✍️ Bulk Bill Signature Pads</span>
                  <span className="text-[10px] text-indigo-600 font-semibold ml-2">{showSignatureSettings ? "Hide Pads" : "Show Pads"}</span>
                </button>

                <div className="flex items-center gap-1.5 select-none">
                  <input
                    type="checkbox"
                    id="omit-bulk-signatures-chk"
                    checked={omitBillSignatures}
                    onChange={e => setOmitBillSignatures(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-900 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="omit-bulk-signatures-chk" className="text-[10px] text-slate-600 font-bold cursor-pointer">
                    Sign Manually (Leave empty for print out)
                  </label>
                </div>
              </div>
              
              {showSignatureSettings && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-150">
                  <SignaturePad
                    label="Estate / Leasing Officer Signature"
                    placeholderText="Draw signature or upload for Estate Officer"
                    initialValue={estateOfficerSig}
                    onSave={(dataUrl) => {
                      setEstateOfficerSig(dataUrl || null);
                      if (dataUrl) {
                        localStorage.setItem("signature_estate_officer", dataUrl);
                      } else {
                        localStorage.removeItem("signature_estate_officer");
                      }
                    }}
                  />
                  <SignaturePad
                    label="Municipal Finance Director Signature"
                    placeholderText="Draw signature or upload for Finance Director"
                    initialValue={financeDirectorSig}
                    onSave={(dataUrl) => {
                      setFinanceDirectorSig(dataUrl || null);
                      if (dataUrl) {
                        localStorage.setItem("signature_finance_director", dataUrl);
                      } else {
                        localStorage.removeItem("signature_finance_director");
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Document Container */}
            <div 
              id="printable-rent-bills-container" 
              className="space-y-8 max-h-[70vh] overflow-y-auto p-4 bg-slate-50/50 rounded-2xl print:max-h-none print:overflow-visible print:bg-white print:p-0 print:space-y-0"
            >
              {billingFilteredTenants.map((app, index, arr) => {
                const monthlyRate = app.subType ? getCentralRentRate(app.subType, rentRates) : 150;
                const annualRate = monthlyRate * 12;
                return (
                  <div 
                    key={app.id} 
                    className={`bulk-bill-page p-8 border border-slate-300 rounded-2xl bg-white space-y-6 relative print:border-none print:p-0 text-slate-800 text-[11px] leading-relaxed ${
                      index < arr.length - 1 ? "print:mb-0" : ""
                    } ${index > 0 ? "mt-8 print:mt-0" : ""}`}
                  >
                    {/* Header section with coat of arms and details */}
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
                        <h4 className="text-[12px] font-extrabold tracking-tight text-slate-950 font-sans uppercase">
                          {rentBillTemplate?.title || "Nsawam Adoagyiri Municipal Assembly"}
                        </h4>
                        <p className="text-[8px] uppercase font-bold text-slate-600 mt-0.5 tracking-wider">
                          {rentBillTemplate?.subTitle || "Finance & Estate Management Department"}
                        </p>
                        <p className="text-[8px] text-slate-500 font-medium font-mono">
                          {rentBillTemplate?.boxAddress || "P.O. BOX 45, NSAWAM, EASTERN REGION, GHANA"}
                        </p>
                        <h5 className="text-[11px] font-extrabold text-indigo-950 mt-3 uppercase underline tracking-widest font-serif">
                          OFFICIAL RENT BILL & DEMAND NOTICE
                        </h5>
                        <p className="text-[7px] font-mono text-indigo-900 font-bold mt-0.5 uppercase">
                          BILLING CYCLE REF: NAMA-RENT-{(app.currentLeaseYear || 1) + 1}-{app.id.substring(0, 6).toUpperCase()}
                        </p>
                      </div>

                      <div className="text-right shrink-0 flex flex-col justify-between h-20">
                        <div className="border border-slate-200 p-2 rounded bg-slate-50/50 text-[8px] font-mono text-slate-600 space-y-0.5">
                          <div><strong>BILL NO:</strong> {app.rentBillNo || `NB-${app.id.substring(0, 6).toUpperCase()}-PENDING`}</div>
                          <div><strong>DATE:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}</div>
                          <div><strong>DUE DATE:</strong> 30 Days from issue</div>
                        </div>
                      </div>
                    </div>

                    {/* Tenant Details Grid */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1 bg-slate-50/60 border border-slate-150 p-3 rounded-xl">
                        <span className="text-slate-400 block text-[8px] uppercase font-bold tracking-wider">Tenant Profile</span>
                        <div className="text-xs font-black text-slate-900">
                          {app.firstName} {app.surname}
                        </div>
                        <div className="text-[10px] text-slate-600 font-medium">
                          Phone: {app.contactNumber || "N/A"}
                        </div>
                        <div className="text-[10px] text-slate-600 font-medium">
                          National ID: {app.ghanaCardNumber || "N/A"}
                        </div>
                      </div>

                      <div className="space-y-1 bg-slate-50/60 border border-slate-150 p-3 rounded-xl">
                        <span className="text-slate-400 block text-[8px] uppercase font-bold tracking-wider">Space Location Details</span>
                        <div className="text-xs font-black text-slate-900">
                          Asset Code: {app.assetCode || "PENDING"}
                        </div>
                        <div className="text-[10px] text-slate-600 font-medium">
                          Type / Class: <span className="uppercase font-bold text-indigo-950">{app.subType || "Store"}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 font-medium">
                          Track: {categories.find(c => c.id === app.categoryId)?.name || "Market Space Directory"}
                        </div>
                      </div>
                    </div>

                    {/* Invoice Fee Table */}
                    <div className="pt-2">
                      <table className="w-full border-collapse border border-slate-300 text-left text-[10px]">
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
                            <td className="p-2">
                              <strong className="block text-slate-900 font-bold uppercase">
                                Year {(app.currentLeaseYear || 1) + 1} Annual Rent Lease Covenant
                              </strong>
                              <span className="text-slate-500 text-[9px]">
                                Commercial rate fixing resolution for space {app.assetCode || "N/A"} ({app.subType || "store"})
                              </span>
                            </td>
                            <td className="p-2 text-center text-slate-600">12 Months</td>
                            <td className="p-2 text-right font-mono text-slate-600">
                              {monthlyRate.toLocaleString()} GHS
                            </td>
                            <td className="p-2 text-right font-mono text-slate-900 font-extrabold">
                              {annualRate.toLocaleString()}.00
                            </td>
                          </tr>
                          <tr className="bg-slate-50/50">
                            <td colSpan={3} className="p-2 text-right font-bold text-slate-700 uppercase">Total Rent Demand</td>
                            <td className="p-2 text-right font-mono text-xs font-black text-indigo-950">
                              {annualRate.toLocaleString()}.00 GHS
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Payment Instructions Section */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-left">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block">IMPORTANT PAYMENT GUIDELINES</span>
                      <p className="text-[9px] text-slate-600 leading-normal whitespace-pre-wrap">
                        {rentBillTemplate?.paymentGuidelines || `1. Payments are due and payable within thirty (30) days of service of this notice.\n2. All payments must be made to the Nsawam Municipal Assembly Finance Office at the treasury cashier desks, or via official banker's draft.\n3. Please present this bill demand notice at the time of payment to ensure correct credit allocation to your file.\n4. Unsettled rent beyond the 30-day grace period may attract standard administrative surcharges or result in lease review.`}
                      </p>
                    </div>

                    {/* Signature Blocks */}
                    <div className="grid grid-cols-3 gap-6 pt-6 items-end">
                      <div className="text-center border-t border-slate-300 pt-2 flex flex-col items-center justify-end">
                        {estateOfficerSig && !omitBillSignatures ? (
                          <img src={estateOfficerSig} alt="Estate Officer Signature" className="max-h-12 max-w-[120px] object-contain mb-1" />
                        ) : (
                          <div className="h-6" />
                        )}
                        <span className="text-[9px] font-bold text-slate-500 block">
                          {globalSignature?.signeeName || "Estate / Leasing Officer"}
                        </span>
                        <span className="text-[8px] text-slate-400 block mt-1 uppercase">
                          {globalSignature?.signeeTitle || "NSAWAM MUNICIPALITY"}
                        </span>
                      </div>
                      <div className="text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 border border-dashed border-slate-300 rounded-full flex items-center justify-center text-slate-350 text-[8px] font-bold uppercase tracking-wider">
                          Stamp Here
                        </div>
                        <span className="text-[8px] text-slate-400 block mt-1 uppercase">Official Stamp Box</span>
                      </div>
                      <div className="text-center border-t border-slate-300 pt-2 flex flex-col items-center justify-end">
                        {financeDirectorSig && !omitBillSignatures ? (
                          <img src={financeDirectorSig} alt="Finance Director Signature" className="max-h-12 max-w-[120px] object-contain mb-1" />
                        ) : (
                          <div className="h-6" />
                        )}
                        <span className="text-[9px] font-bold text-slate-500 block">
                          {globalSignature?.signeeName || "Municipal Finance Director"}
                        </span>
                        <span className="text-[8px] text-slate-400 block mt-1 uppercase">
                          {globalSignature?.signeeTitle || "APPROVED SIGNATORY"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Store Allocation Selection Modal */}
      {selectingAppForStore && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh] animate-fade-in border border-slate-100">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold font-mono bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-md">
                    {selectingAppForStore.id}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">
                    Ghana Card: {selectingAppForStore.ghanaCardNumber}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  Choose Physical Store for {selectingAppForStore.firstName} {selectingAppForStore.surname}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select an available vacant store from the assembly registry below to reserve for this applicant.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectingAppForStore(null);
                  setSelectedStoreAsset(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search filter bar */}
            <div className="py-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={storeSearchFilter}
                  onChange={(e) => setStoreSearchFilter(e.target.value)}
                  placeholder="Filter store number or code (e.g. 001, 015, Store #005, NAMA/ST/012)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Vacant Store Grid */}
            <div className="flex-1 overflow-y-auto min-h-[240px] max-h-[360px] pr-1 py-1 space-y-2">
              {(() => {
                const vacantList = assets.filter(a => 
                  a.status === "VACANT" && 
                  ((a.assetCode || a.id).toLowerCase().includes(storeSearchFilter.toLowerCase()) || 
                   a.name.toLowerCase().includes(storeSearchFilter.toLowerCase()) ||
                   a.subType.toLowerCase().includes(storeSearchFilter.toLowerCase()))
                ).sort((a, b) => (a.assetCode || a.id).localeCompare(b.assetCode || b.id, undefined, { numeric: true }));

                if (vacantList.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Building className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-600">No vacant store assets found</p>
                      <p className="text-[11px] text-slate-400">
                        {storeSearchFilter ? "Try adjusting your search filter." : "No vacant store units available in registry. Please add store units first."}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {vacantList.map((asset) => {
                      const codeDisplay = asset.assetCode || asset.id;
                      const isSelected = selectedStoreAsset?.id === asset.id;
                      const rentRate = getCentralRentRate(asset.subType, rentRates);

                      return (
                        <div
                          key={asset.id}
                          onClick={() => setSelectedStoreAsset(asset)}
                          className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? "bg-indigo-50 border-2 border-indigo-600 shadow-md shadow-indigo-100 ring-2 ring-indigo-500/20"
                              : "bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80"
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-center gap-1">
                              <span className="font-mono font-extrabold text-xs text-indigo-900">
                                {codeDisplay}
                              </span>
                              {isSelected && (
                                <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                              )}
                            </div>
                            <h5 className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                              {asset.name}
                            </h5>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                            <span className="text-slate-500 font-medium truncate">
                              {asset.subType || "Market Store"}
                            </span>
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/60">
                              {rentRate} GHS/mo
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 mt-2">
              <div className="text-xs text-slate-600 font-medium">
                {selectedStoreAsset ? (
                  <span>
                    Selected: <strong className="text-indigo-950 font-bold font-mono">{selectedStoreAsset.assetCode || selectedStoreAsset.id}</strong> ({selectedStoreAsset.name})
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Please click on a store above to select it</span>
                )}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectingAppForStore(null);
                    setSelectedStoreAsset(null);
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedStoreAsset || isAllocatingStore}
                  onClick={handleConfirmSpecificStoreAllocation}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {isAllocatingStore ? (
                    "Allocating..."
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Confirm Store Allocation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Allocation Letters Print Modal */}
      {printAllAllocationLetters && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[120] flex flex-col p-4 md:p-6 overflow-y-auto"
          id="bulk-allocation-letters-print-modal"
        >
          {/* Top Control Header Bar (Hidden during printing) */}
          <div className="bg-white rounded-2xl p-4 mb-6 border border-slate-200 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 print:hidden max-w-[210mm] mx-auto w-full">
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-900" />
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                  Bulk Print Allocation Letters
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Official letter compilation for all allocated applicants. Filter, search, and click Print All.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 md:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={bulkAllocationSearch}
                  onChange={(e) => setBulkAllocationSearch(e.target.value)}
                  placeholder="Filter name, store code..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-indigo-600 focus:bg-white transition-all font-medium"
                />
              </div>

              <select
                value={bulkAllocationCategoryFilter}
                onChange={(e) => setBulkAllocationCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-indigo-600"
              >
                <option value="all">All Tracks</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={bulkAllocationStatusFilter}
                onChange={(e) => setBulkAllocationStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-indigo-600"
              >
                <option value="all">All Allocated Statuses</option>
                <option value="RESERVED">Reserved</option>
                <option value="AWAITING_PAYMENT">Agreement Signed</option>
                <option value="OCCUPIED">Occupied / Active</option>
              </select>

              <div className="flex items-center gap-2 ml-auto md:ml-0">
                <button
                  type="button"
                  onClick={async () => {
                    const allocatedAppsToMark = applications.filter(app => {
                      const isAllocated = app.status === "RESERVED" || app.status === "AWAITING_PAYMENT" || app.status === "OCCUPIED" || !!app.assetCode;
                      if (!isAllocated) return false;
                      const matchesSearch = !bulkAllocationSearch.trim() || 
                        `${app.firstName} ${app.surname}`.toLowerCase().includes(bulkAllocationSearch.toLowerCase()) ||
                        (app.assetCode || "").toLowerCase().includes(bulkAllocationSearch.toLowerCase()) ||
                        app.id.toLowerCase().includes(bulkAllocationSearch.toLowerCase());
                      const matchesCat = bulkAllocationCategoryFilter === "all" || app.categoryId === bulkAllocationCategoryFilter;
                      const matchesStatus = bulkAllocationStatusFilter === "all" || app.status === bulkAllocationStatusFilter;
                      return matchesSearch && matchesCat && matchesStatus;
                    });

                    if (allocatedAppsToMark.length === 0) return;
                    try {
                      const batch = writeBatch(db);
                      allocatedAppsToMark.forEach(a => {
                        batch.update(doc(db, "applications", a.id), {
                          allocationLetterPrinted: true,
                          allocationLetterPrintedAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        });
                      });
                      await batch.commit();
                      alert(`Successfully marked ${allocatedAppsToMark.length} allocation letters as printed!`);
                    } catch (err) {
                      console.error("Bulk mark printed error:", err);
                      alert("Failed to update printed status.");
                    }
                  }}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  title="Mark all current filtered allocation letters as printed"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark All as Printed</span>
                </button>

                <button
                  type="button"
                  id="print-all-letters-btn"
                  onClick={async () => {
                    // Automatically mark filtered letters as printed on print action
                    const allocatedAppsToMark = applications.filter(app => {
                      const isAllocated = app.status === "RESERVED" || app.status === "AWAITING_PAYMENT" || app.status === "OCCUPIED" || !!app.assetCode;
                      if (!isAllocated) return false;
                      const matchesSearch = !bulkAllocationSearch.trim() || 
                        `${app.firstName} ${app.surname}`.toLowerCase().includes(bulkAllocationSearch.toLowerCase()) ||
                        (app.assetCode || "").toLowerCase().includes(bulkAllocationSearch.toLowerCase()) ||
                        app.id.toLowerCase().includes(bulkAllocationSearch.toLowerCase());
                      const matchesCat = bulkAllocationCategoryFilter === "all" || app.categoryId === bulkAllocationCategoryFilter;
                      const matchesStatus = bulkAllocationStatusFilter === "all" || app.status === bulkAllocationStatusFilter;
                      return matchesSearch && matchesCat && matchesStatus;
                    });

                    if (allocatedAppsToMark.length > 0) {
                      try {
                        const batch = writeBatch(db);
                        allocatedAppsToMark.forEach(a => {
                          if (!a.allocationLetterPrinted) {
                            batch.update(doc(db, "applications", a.id), {
                              allocationLetterPrinted: true,
                              allocationLetterPrintedAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString()
                            });
                          }
                        });
                        await batch.commit();
                      } catch (err) {
                        console.error("Auto mark printed error:", err);
                      }
                    }

                    window.print();
                  }}
                  className="px-4 py-2 bg-indigo-900 hover:bg-indigo-850 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print All Letters</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintAllAllocationLetters(false)}
                  className="p-2 border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                  title="Close Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Printable Documents Scroll Container */}
          <div className="flex-1 w-full max-w-[210mm] mx-auto space-y-8" id="printable-bulk-allocation-letters-container">
            {(() => {
              const allocatedApps = applications.filter(app => {
                const isAllocated = app.status === "RESERVED" || app.status === "AWAITING_PAYMENT" || app.status === "OCCUPIED" || !!app.assetCode;
                if (!isAllocated) return false;

                const matchesSearch = !bulkAllocationSearch.trim() || 
                  `${app.firstName} ${app.surname}`.toLowerCase().includes(bulkAllocationSearch.toLowerCase()) ||
                  (app.assetCode || "").toLowerCase().includes(bulkAllocationSearch.toLowerCase()) ||
                  app.id.toLowerCase().includes(bulkAllocationSearch.toLowerCase()) ||
                  (app.contactNumber || "").includes(bulkAllocationSearch);

                const matchesCat = bulkAllocationCategoryFilter === "all" || app.categoryId === bulkAllocationCategoryFilter;
                const matchesStatus = bulkAllocationStatusFilter === "all" || app.status === bulkAllocationStatusFilter;

                return matchesSearch && matchesCat && matchesStatus;
              });

              if (allocatedApps.length === 0) {
                return (
                  <div className="bg-white rounded-2xl p-12 text-center space-y-3 border border-slate-200 text-slate-500 print:hidden">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                    <h4 className="font-extrabold text-slate-800 text-base">No Allocated Applicants Found</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      There are currently no allocated applicants matching your search or filter settings. Please assign store spaces to applicants in Stage 2 before printing allocation letters.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-8 print:space-y-0">
                  <div className="text-center text-xs font-mono text-slate-300 print:hidden py-1 border-b border-slate-700/50">
                    Compiled <strong>{allocatedApps.length}</strong> allocation letters for bulk printing
                  </div>

                  {allocatedApps.map((app, index) => {
                    const assignedAssetsList = assets.filter(a => 
                      a.assignedApplicationId === app.id || 
                      (app.assetCode && (a.assetCode || a.id).toUpperCase() === app.assetCode.toUpperCase())
                    );
                    const assetCodeToDisplay = assignedAssetsList.length > 0 
                      ? assignedAssetsList.map(a => a.assetCode || a.id).join(", ") 
                      : (app.assetCode || "N/A");

                    const refNo = app.allocationLetterRef || `NAMA/AL/${app.id}/${new Date().getFullYear()}`;
                    const letterDate = app.allocationLetterDate 
                      ? new Date(app.allocationLetterDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                      : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

                    const signee = app.allocationLetterSignee || globalSignature?.signeeName || "Mr. Jasper Adenyo";
                    const signeeTitle = app.allocationLetterSigneeTitle || globalSignature?.signeeTitle || "Municipal Coordinating Director";
                    const signatureImg = app.signAllocationManually ? null : (globalSignature?.signatureImg || null);

                    return (
                      <div
                        key={app.id}
                        className="bulk-allocation-letter-page bg-white border border-slate-300 rounded-xl p-8 shadow-md relative text-slate-800 text-[11px] leading-relaxed font-sans max-w-[210mm] mx-auto min-h-[297mm] print:border-none print:shadow-none print:rounded-none"
                      >
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
                              <MunicipalLogo size={56} className="mb-1" />
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
                              <span className="font-bold">OUR REF:</span> {refNo}
                            </div>
                            <div>
                              <span className="font-bold">APPLICANT ID:</span> {app.id}
                            </div>
                          </div>
                          <div>
                            <span className="font-bold">DATE:</span> {letterDate}
                          </div>
                        </div>

                        {/* Address & Photo */}
                        <div className="pt-6 flex justify-between items-start">
                          <div className="text-left space-y-1 text-slate-800">
                            <p className="font-bold text-[10px]">{app.firstName.toUpperCase()} {app.surname.toUpperCase()}</p>
                            <p className="text-slate-600">{app.address || "Residential Address Not Specified"}</p>
                            <p className="text-slate-600">Nsawam, Eastern Region, Ghana</p>
                            <p className="text-slate-600 font-mono text-[9px]">{app.contactNumber}</p>
                          </div>

                          {/* Applicant Photo Stamp */}
                          {bulkPrintPhotos[app.id] ? (
                            <div className="border-2 border-slate-200 rounded-lg p-1 shrink-0 bg-slate-50 shadow-sm print:border print:shadow-none">
                              <img
                                src={bulkPrintPhotos[app.id]}
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
                              <span className="font-bold text-slate-900">{app.subType || "Standard"}</span>
                            </div>
                          </div>

                          <p>
                            {allocationLetterTemplate?.conditionsIntro || "Please be advised that this allocation is strictly subject to the following regulatory terms and covenants:"}
                          </p>

                          <ul className="list-decimal pl-4 space-y-1 text-[10px]">
                            {allocationLetterTemplate?.conditionsList && allocationLetterTemplate.conditionsList.length > 0 ? (
                              allocationLetterTemplate.conditionsList.map((cond: string, idx: number) => (
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
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
