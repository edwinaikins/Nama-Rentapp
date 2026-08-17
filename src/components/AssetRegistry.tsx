import React, { useState } from "react";
import { Asset, Category, AssetStatus, Application, PortalUser, SmsTemplatesSetting, RentRatesSetting } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { sendSMSAndLog, formatAllocationSms } from "../services/smsService";
import { doc, setDoc, deleteDoc, updateDoc, writeBatch, runTransaction } from "firebase/firestore";
import { DEFAULT_SMS_TEMPLATES } from "../data";
import { getCentralRentRate } from "../utils/rentUtils";
import { 
  Building, Plus, Search, Filter, Trash2, Edit2, 
  MapPin, CheckCircle, Clock, X, AlertTriangle, HelpCircle,
  TrendingUp, Save, Landmark, Layers, User, UserCheck,
  Upload, FileSpreadsheet, Download, CheckCircle2, Sparkles, RefreshCw, FileText, Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ParsedImportAsset {
  rowIndex: number;
  id: string;
  name: string;
  categoryId: string;
  subType: string;
  baseRent: number;
  notes: string;
  error: string | null;
}

function parseAssetCSV(text: string, categories: Category[], existingAssets: Asset[]): ParsedImportAsset[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  // Determine header
  const firstLine = lines[0];
  const isHeader = firstLine.toLowerCase().includes("code") || 
                   firstLine.toLowerCase().includes("name") || 
                   firstLine.toLowerCase().includes("category") ||
                   firstLine.toLowerCase().includes("description");
  
  const dataLines = isHeader ? lines.slice(1) : lines;
  const parsedList: ParsedImportAsset[] = [];
  const seenCodesInBatch = new Set<string>();

  dataLines.forEach((line, idx) => {
    // split by comma or tab or semicolon ignoring commas inside quotes
    const cols = line.match(/(".*?"|[^",\t;]+)(?=\s*[,;\t]|\s*$)/g) || line.split(/[,;\t]/);
    const cleanCols = cols.map(c => c.replace(/^"|"$/g, '').trim());

    if (cleanCols.length < 1 || !cleanCols[0]) return;

    const rawCode = cleanCols[0]?.toUpperCase().trim() || "";
    const rawName = cleanCols[1]?.trim() || `Asset ${rawCode}`;
    const rawCategory = cleanCols[2]?.trim() || "";
    const rawSubType = cleanCols[3]?.trim() || "";
    const rawRent = cleanCols[4] ? parseFloat(cleanCols[4].replace(/[^0-9.]/g, '')) : NaN;
    const rawNotes = cleanCols[5]?.trim() || "";

    // Resolve Category
    let matchedCat = categories.find(c => 
      c.id.toLowerCase() === rawCategory.toLowerCase() || 
      c.name.toLowerCase() === rawCategory.toLowerCase()
    );
    if (!matchedCat && categories.length > 0) {
      matchedCat = categories[0];
    }
    const catId = matchedCat ? matchedCat.id : (categories[0]?.id || "market_stores___shed");

    // Resolve SubType
    let matchedSub = matchedCat?.subTypes.find(s => s.toLowerCase() === rawSubType.toLowerCase());
    if (!matchedSub && matchedCat && matchedCat.subTypes.length > 0) {
      matchedSub = matchedCat.subTypes[0];
    }
    const finalSubType = matchedSub || rawSubType || "Market Store";

    // Validate Code
    let error: string | null = null;
    if (!rawCode) {
      error = "Missing Asset Code";
    } else if (existingAssets.some(a => a.id.toUpperCase() === rawCode)) {
      error = `Code "${rawCode}" already exists in registry`;
    } else if (seenCodesInBatch.has(rawCode)) {
      error = `Duplicate Code "${rawCode}" in import batch`;
    }

    if (rawCode) seenCodesInBatch.add(rawCode);

    parsedList.push({
      rowIndex: idx + 1,
      id: rawCode,
      name: rawName,
      categoryId: catId,
      subType: finalSubType,
      baseRent: !isNaN(rawRent) && rawRent > 0 ? rawRent : 150,
      notes: rawNotes,
      error
    });
  });

  return parsedList;
}

interface AssetRegistryProps {
  assets: Asset[];
  categories: Category[];
  applications: Application[];
  onClose: () => void;
  onUpdate: () => void;
  currentUser: PortalUser | null;
  autoOpenCreate?: boolean;
  smsTemplates?: SmsTemplatesSetting | null;
  rentRates?: RentRatesSetting | null;
}

export default function AssetRegistry({ assets, categories, applications, onClose, onUpdate, currentUser, autoOpenCreate, smsTemplates, rentRates }: AssetRegistryProps) {
  const [searchTerm, setSearchTerm] = useState("");

  React.useEffect(() => {
    if (autoOpenCreate) {
      openCreateModal();
    }
  }, [autoOpenCreate]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"all" | AssetStatus>("all");

  // Creation/Editing Form states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  
  const [assetId, setAssetId] = useState("");
  const [assetName, setAssetName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subType, setSubType] = useState("");
  const [baseRent, setBaseRent] = useState<number>(100);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<AssetStatus>("VACANT");
  
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deletion Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Allocation states
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocatingAsset, setAllocatingAsset] = useState<Asset | null>(null);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [allocationError, setAllocationError] = useState("");
  const [isAllocating, setIsAllocating] = useState(false);
  const [allocateSearchTerm, setAllocateSearchTerm] = useState("");
  const [matchCategoryOnly, setMatchCategoryOnly] = useState(true);

  // Bulk Import Modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [parsedImportAssets, setParsedImportAssets] = useState<ParsedImportAsset[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrorMsg, setImportErrorMsg] = useState("");
  const [importSuccessMsg, setImportSuccessMsg] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || "";
      setImportText(text);
      const parsed = parseAssetCSV(text, categories, assets);
      setParsedImportAssets(parsed);
    };
    reader.readAsText(file);
  };

  const handleImportTextChange = (val: string) => {
    setImportText(val);
    const parsed = parseAssetCSV(val, categories, assets);
    setParsedImportAssets(parsed);
  };

  const downloadCsvTemplate = () => {
    const csvLines = [
      "Asset Code,Physical Description,Category,Space Variant,Monthly Rent,Notes",
      "NMA-MKT-B01,Block B Store #01 (Corner),Market Stores & Shed,Market Store,150,Newly renovated with shutter",
      "NMA-MKT-S05,Market Shed Stall #05,Market Stores & Shed,Market Shed,80,Standard trading stall",
      "NMA-BUNG-03,Senior Officer Bungalow #03,Staff Bungalows & Housing,Staff Bungalow,250,3-bedroom detached house"
    ];
    const csvString = csvLines.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "municipal_assets_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const executeBatchImport = async () => {
    const validItems = parsedImportAssets.filter(item => !item.error);
    if (validItems.length === 0) {
      setImportErrorMsg("No valid assets to import. Please review errors or upload asset data.");
      return;
    }

    setIsImporting(true);
    setImportErrorMsg("");
    setImportSuccessMsg("");

    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      validItems.forEach(item => {
        const safeDocId = item.id.replace(/\//g, "-");
        const docRef = doc(db, "assets", safeDocId);
        const centralRate = getCentralRentRate(item.subType, rentRates);
        const assetPayload: Asset = {
          id: safeDocId,
          assetCode: item.id,
          name: item.name,
          categoryId: item.categoryId,
          subType: item.subType,
          status: "VACANT",
          baseRent: item.baseRent || centralRate,
          notes: item.notes || "Bulk imported asset",
          assignedApplicationId: null,
          assignedOccupantName: null,
          createdAt: now,
          updatedAt: now
        };
        batch.set(docRef, assetPayload);
      });

      await batch.commit();

      setIsImporting(false);
      setImportSuccessMsg(`Successfully imported ${validItems.length} assets into the registry database!`);
      setTimeout(() => {
        setShowImportModal(false);
        setImportText("");
        setParsedImportAssets([]);
        setImportFileName("");
        onUpdate();
      }, 1200);
    } catch (err) {
      setIsImporting(false);
      setImportErrorMsg("Failed to write imported assets to Firestore database.");
      handleFirestoreError(err, OperationType.WRITE, "assets/batch_import");
    }
  };

  // Filter lists
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = 
      asset.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset.assignedOccupantName && asset.assignedOccupantName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategoryFilter === "all" || asset.categoryId === selectedCategoryFilter;
    const matchesStatus = selectedStatusFilter === "all" || asset.status === selectedStatusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Category change inside creation form adjusts subTypes list automatically
  const handleCategoryChange = (catId: string) => {
    setCategoryId(catId);
    const selectedCat = categories.find(c => c.id === catId);
    if (selectedCat && selectedCat.subTypes.length > 0) {
      setSubType(selectedCat.subTypes[0]);
    } else {
      setSubType("");
    }

    // Auto-formulate a suggested Code prefix to make life super easy!
    if (!editingAsset) {
      const prefix = catId === "staff_bungalows" ? "NMA-BUNG-" : catId === "assembly_grounds" ? "NMA-GRD-" : "NMA-MKT-";
      // Find a suitable next index
      const matchingAssets = assets.filter(a => a.categoryId === catId);
      const nextNum = matchingAssets.length + 1;
      const formattedNum = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
      setAssetId(`${prefix}${formattedNum}`);
    }
  };

  const openCreateModal = () => {
    setEditingAsset(null);
    setAssetId("");
    setAssetName("");
    setNotes("");
    setStatus("VACANT");
    
    // Pick the first category as default if available
    if (categories.length > 0) {
      const defaultCat = categories[0];
      setCategoryId(defaultCat.id);
      if (defaultCat.subTypes.length > 0) {
        setSubType(defaultCat.subTypes[0]);
      } else {
        setSubType("");
      }
      const prefix = defaultCat.id === "staff_bungalows" ? "NMA-BUNG-" : defaultCat.id === "assembly_grounds" ? "NMA-GRD-" : "NMA-MKT-";
      const matchingAssets = assets.filter(a => a.categoryId === defaultCat.id);
      const nextNum = matchingAssets.length + 1;
      const formattedNum = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
      setAssetId(`${prefix}${formattedNum}`);
    } else {
      setCategoryId("");
      setSubType("");
    }
    setBaseRent(150);
    setFormError("");
    setShowFormModal(true);
  };

  const openEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setAssetId(asset.id);
    setAssetName(asset.name);
    setCategoryId(asset.categoryId);
    setSubType(asset.subType);
    setBaseRent(asset.baseRent || 150);
    setNotes(asset.notes || "");
    setStatus(asset.status);
    setFormError("");
    setShowFormModal(true);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!assetId.trim()) {
      setFormError("Asset Code/ID is required.");
      return;
    }
    if (!assetName.trim()) {
      setFormError("Physical description / asset name is required.");
      return;
    }
    if (!categoryId) {
      setFormError("Please select a category track.");
      return;
    }

    const cleanId = assetId.trim().toUpperCase();

    // Check code duplication for NEW assets
    if (!editingAsset) {
      const codeExists = assets.some(a => a.id.toUpperCase() === cleanId);
      if (codeExists) {
        setFormError(`An asset with the code "${cleanId}" is already registered.`);
        return;
      }
    }

    setIsSubmitting(true);
    
    const centralRate = getCentralRentRate(subType, rentRates);
    const assetPayload: Asset = {
      id: cleanId,
      name: assetName.trim(),
      categoryId,
      subType,
      status,
      baseRent: centralRate,
      notes: notes.trim(),
      assignedApplicationId: editingAsset ? (editingAsset.assignedApplicationId || null) : null,
      assignedOccupantName: editingAsset ? (editingAsset.assignedOccupantName || null) : null,
      createdAt: editingAsset ? editingAsset.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "assets", cleanId), assetPayload);
      setIsSubmitting(false);
      setShowFormModal(false);
      onUpdate();
    } catch (err) {
      setIsSubmitting(false);
      setFormError("Could not write asset to registry database.");
      handleFirestoreError(err, OperationType.WRITE, `assets/${cleanId}`);
    }
  };

  const triggerDeleteAsset = (asset: Asset) => {
    if (currentUser?.role !== "SUPER_USER") return;
    setAssetToDelete(asset);
    setShowDeleteModal(true);
  };

  const executeDeleteAsset = async () => {
    if (currentUser?.role !== "SUPER_USER") return;
    if (!assetToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "assets", assetToDelete.id));
      setIsDeleting(false);
      setShowDeleteModal(false);
      setAssetToDelete(null);
      onUpdate();
    } catch (err) {
      setIsDeleting(false);
      setShowDeleteModal(false);
      handleFirestoreError(err, OperationType.DELETE, `assets/${assetToDelete.id}`);
    }
  };

  const handleReleaseAsset = async (assetToRelease: Asset) => {
    if (!window.confirm(`Are you sure you want to release/unlink asset "${assetToRelease.id}"? This will disconnect it from any assigned occupant and restore its status to VACANT in the database.`)) {
      return;
    }

    const safeDocId = assetToRelease.id.replace(/\//g, "-");
    const assetRef = doc(db, "assets", safeDocId);
    const matchingApp = assetToRelease.assignedApplicationId
      ? applications.find(a => a.id === assetToRelease.assignedApplicationId)
      : undefined;
    const appDocRef = matchingApp ? doc(db, "applications", matchingApp.id) : null;

    try {
      // Release the asset and clear it from the linked application
      // atomically, re-reading the application's live assignedAssets list
      // inside the transaction rather than trusting a possibly-stale prop.
      await runTransaction(db, async (tx) => {
        // All reads must happen before any writes in a Firestore transaction.
        const appSnap = appDocRef ? await tx.get(appDocRef) : null;

        tx.update(assetRef, {
          status: "VACANT",
          assignedApplicationId: null,
          assignedOccupantName: null,
          updatedAt: new Date().toISOString()
        });

        if (appDocRef && matchingApp && appSnap) {
          const appData = (appSnap.data() as Application | undefined) || matchingApp;
          const currentAssigned = appData.assignedAssets && appData.assignedAssets.length > 0
            ? appData.assignedAssets
            : [assetToRelease.id];
          const remainingAssigned = currentAssigned.filter(id => id !== assetToRelease.id);
          const isNowEmpty = remainingAssigned.length === 0;

          tx.update(appDocRef, {
            assetCode: isNowEmpty ? "" : (appData.assetCode === assetToRelease.id ? "" : appData.assetCode),
            assignedAssets: remainingAssigned,
            status: isNowEmpty && (appData.status === "RESERVED" || appData.status === "AWAITING_PAYMENT") ? "PENDING_ALLOCATION" : appData.status,
            updatedAt: new Date().toISOString()
          });
        }
      });

      onUpdate();
    } catch (err) {
      console.error("Release asset error:", err);
      handleFirestoreError(err, OperationType.UPDATE, `assets/${assetToRelease.id}`);
    }
  };

  const executeAllocation = async () => {
    if (!allocatingAsset || !selectedAppId) {
      setAllocationError("Please select an occupant for allocation.");
      return;
    }

    setIsAllocating(true);
    setAllocationError("");

    const matchingApp = applications.find(a => a.id === selectedAppId);
    if (!matchingApp) {
      setAllocationError("Selected occupant was not found.");
      setIsAllocating(false);
      return;
    }

    const appDocRef = doc(db, "applications", matchingApp.id);
    const assetDocRef = doc(db, "assets", allocatingAsset.id.replace(/\//g, "-"));
    const updatedAssetCode = matchingApp.assetCode || allocatingAsset.id;

    try {
      // A transaction re-checks the asset is still VACANT and updates both
      // documents atomically — closes the same double-allocation race as
      // ApplicationDetails.handleAllocate.
      await runTransaction(db, async (tx) => {
        const assetSnap = await tx.get(assetDocRef);
        if (!assetSnap.exists()) {
          throw new Error(`Asset "${allocatingAsset.id}" was not found in the registry.`);
        }
        const assetData = assetSnap.data() as Asset;
        if (assetData.status !== "VACANT") {
          throw new Error(`Asset "${allocatingAsset.id}" is no longer vacant (currently ${assetData.status}). It may have just been allocated to someone else — please refresh and try again.`);
        }

        const appSnap = await tx.get(appDocRef);
        const appData = (appSnap.data() as Application | undefined) || matchingApp;
        const existingAssets = appData.assignedAssets || [];
        const updatedAssignedAssets = Array.from(new Set([...existingAssets, allocatingAsset.id]));
        const updatedStatus = appData.status === "PENDING_ALLOCATION" ? "RESERVED" : appData.status;

        tx.update(appDocRef, {
          status: updatedStatus,
          assetCode: updatedAssetCode,
          assignedAssets: updatedAssignedAssets,
          updatedAt: new Date().toISOString()
        });

        tx.update(assetDocRef, {
          status: "RESERVED",
          assignedApplicationId: matchingApp.id,
          assignedOccupantName: `${matchingApp.firstName} ${matchingApp.surname}`,
          updatedAt: new Date().toISOString()
        });
      });

      // Asynchronously trigger Wigal SMS notification to the client upon space allocation
      try {
        const template = smsTemplates?.allocation || DEFAULT_SMS_TEMPLATES.allocation;
        const smsMessage = formatAllocationSms(template, {
          firstName: matchingApp.firstName,
          assetCode: updatedAssetCode
        });
        sendSMSAndLog(matchingApp.contactNumber, smsMessage, matchingApp.categoryId)
          .then(log => console.log("[Allocation SMS Logged]", log))
          .catch(err => console.error("[Allocation SMS Error]", err));
      } catch (smsErr) {
        console.error("SMS notification send trigger failed:", smsErr);
      }

      setIsAllocating(false);
      setShowAllocateModal(false);
      setAllocatingAsset(null);
      setSelectedAppId("");
      onUpdate();
    } catch (err: any) {
      setIsAllocating(false);
      if (err instanceof Error && /no longer vacant|was not found in the registry/.test(err.message)) {
        setAllocationError(err.message);
        return;
      }
      setAllocationError("Failed to update Firestore records.");
      handleFirestoreError(err, OperationType.UPDATE, `assets/${allocatingAsset.id}`);
    }
  };

  const getStatusColor = (s: AssetStatus) => {
    switch (s) {
      case "VACANT":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "RESERVED":
        return "bg-indigo-50 text-indigo-700 border-indigo-150";
      case "OCCUPIED":
        return "bg-slate-900 text-slate-100 border-slate-950";
    }
  };

  return (
    <div className="space-y-6" id="assets-registry-root">
      {/* Upper Title Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-150 shadow-sm text-left">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-amber-500 to-indigo-950 rounded-2xl flex items-center justify-center text-white shadow-md">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Asset Registry Division
            </span>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Stores & Bungalows Database
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-2xl transition-all text-xs font-bold"
          >
            Back to Occupants
          </button>
          {(currentUser?.role === "REGISTRAR" || currentUser?.role === "SUPER_USER") && (
            <>
              <button
                type="button"
                onClick={() => {
                  setImportText("");
                  setParsedImportAssets([]);
                  setImportFileName("");
                  setImportErrorMsg("");
                  setImportSuccessMsg("");
                  setShowImportModal(true);
                }}
                className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl transition-all shadow-md flex items-center gap-1.5 text-xs transform active:scale-95"
              >
                <Upload className="w-4 h-4" /> Bulk Import
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white font-bold rounded-2xl transition-all shadow-md flex items-center gap-1.5 text-xs transform active:scale-95"
              >
                <Plus className="w-4 h-4" /> Register New Asset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-150 rounded-2xl p-4 text-left shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Physical Assets</span>
          <span className="text-2xl font-bold text-slate-800 mt-1 block">{assets.length}</span>
        </div>
        <div className="bg-white border border-slate-150 rounded-2xl p-4 text-left shadow-sm">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Vacant Assets</span>
          <span className="text-2xl font-bold text-emerald-600 mt-1 block">{assets.filter(a => a.status === "VACANT").length}</span>
        </div>
        <div className="bg-white border border-slate-150 rounded-2xl p-4 text-left shadow-sm">
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Reserved Assets</span>
          <span className="text-2xl font-bold text-indigo-700 mt-1 block">{assets.filter(a => a.status === "RESERVED").length}</span>
        </div>
        <div className="bg-white border border-slate-150 rounded-2xl p-4 text-left shadow-sm">
          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">Active Occupied</span>
          <span className="text-2xl font-bold text-slate-800 mt-1 block">{assets.filter(a => a.status === "OCCUPIED").length}</span>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          {/* Quick Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search assets by Code, Description, or Occupant name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none text-xs transition-all"
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
                    ? "bg-indigo-900 text-white shadow-sm"
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
          <span className="text-[10px] uppercase font-bold text-slate-400 mr-2 shrink-0">Status:</span>
          <button
            type="button"
            onClick={() => setSelectedStatusFilter("all")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              selectedStatusFilter === "all"
                ? "bg-slate-100 text-slate-800 border-2 border-slate-200"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            All Assets
          </button>
          
          <button
            type="button"
            onClick={() => setSelectedStatusFilter("VACANT")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              selectedStatusFilter === "VACANT"
                ? "bg-emerald-50 text-emerald-700 border-2 border-emerald-500/20"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            Vacant
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
            onClick={() => setSelectedStatusFilter("OCCUPIED")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              selectedStatusFilter === "OCCUPIED"
                ? "bg-slate-900 text-white border-2 border-slate-950"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            Occupied
          </button>
        </div>
      </div>

      {/* Asset Cards Grid */}
      <div className="space-y-3 text-left">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider px-2">
          Registered Physical Inventory ({filteredAssets.length})
        </h3>

        {filteredAssets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAssets.map(asset => {
              const catObj = categories.find(c => c.id === asset.categoryId);
              return (
                <div 
                  key={asset.id}
                  className="bg-white rounded-3xl border border-slate-150 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header: Asset Code & Badges */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="font-mono text-sm font-bold tracking-tight text-slate-800">
                        {asset.id}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusColor(asset.status)}`}>
                        {asset.status}
                      </span>
                    </div>

                    {/* Body: Title & Category */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 line-clamp-1">{asset.name}</h4>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-slate-300" />
                        <span>{catObj?.name || "EAV Track"} • {asset.subType}</span>
                      </p>
                    </div>

                    {/* Standard monthly lease */}
                    {asset.baseRent && (
                      <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Standard Rent</span>
                        <span className="font-bold text-indigo-900">{asset.baseRent} GHS / mo</span>
                      </div>
                    )}

                    {/* Notes */}
                    {asset.notes && (
                      <p className="text-[10px] text-slate-500 italic line-clamp-2 leading-relaxed bg-slate-50/50 p-2 rounded-lg border border-dashed border-slate-100">
                        "{asset.notes}"
                      </p>
                    )}

                    {/* Assigned Occupant section */}
                    {(asset.status !== "VACANT" && asset.assignedOccupantName) && (
                      <div className="bg-indigo-50/40 rounded-xl p-3 border border-indigo-100/50 space-y-1">
                        <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider block">Assigned Occupant</span>
                        <div className="flex items-center gap-1.5 text-xs text-indigo-950 font-bold">
                          <CheckCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate">{asset.assignedOccupantName}</span>
                        </div>
                        <span className="text-[9px] font-mono text-indigo-500 block">ID: {asset.assignedApplicationId}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="flex justify-between items-center border-t border-slate-100 mt-4 pt-3 text-xs">
                    <div>
                      {asset.status === "VACANT" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAllocatingAsset(asset);
                            setSelectedAppId("");
                            setAllocateSearchTerm("");
                            setAllocationError("");
                            setShowAllocateModal(true);
                          }}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-xl transition-all flex items-center gap-1 border border-indigo-100/50"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Allocate Space</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReleaseAsset(asset)}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10px] rounded-xl transition-all flex items-center gap-1 border border-amber-200/80 cursor-pointer"
                          title="Unlink and return store to VACANT status in database"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Unlink Store</span>
                        </button>
                      )}
                    </div>
                    {(currentUser?.role === "REGISTRAR" || currentUser?.role === "SUPER_USER") ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(asset)}
                          className="p-2 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-800 rounded-xl transition-all"
                          title="Edit Asset Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {currentUser?.role === "SUPER_USER" && (
                          <button
                            type="button"
                            disabled={asset.status !== "VACANT"}
                            onClick={() => triggerDeleteAsset(asset)}
                            className={`p-2 border rounded-xl transition-all ${
                              asset.status !== "VACANT"
                                ? "border-slate-100 text-slate-300 cursor-not-allowed"
                                : "border-red-100 hover:bg-red-50 text-red-600 hover:border-red-200"
                            }`}
                            title={asset.status !== "VACANT" ? "Cannot delete occupied/reserved asset" : "Delete Physical Asset"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl">
                        🔒 Read-Only
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-slate-150 rounded-3xl p-12 text-center text-slate-400 space-y-3">
            <Landmark className="w-10 h-10 text-slate-300 mx-auto" />
            <div>
              <p className="text-sm font-bold text-slate-700">No assets found matching filters</p>
              <p className="text-xs text-slate-400 mt-1">Register some physical units to link them dynamically with occupant profiles</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setSelectedCategoryFilter("all");
                setSelectedStatusFilter("all");
              }}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Asset Creation/Editing Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" id="asset-form-modal">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-150 text-left space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-950">
                <Landmark className="w-5 h-5 text-indigo-900" />
                <h3 className="text-base font-bold tracking-tight">
                  {editingAsset ? "Edit Registered Asset" : "Register Physical Asset"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="p-1 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-150 rounded-xl p-3 text-xs text-red-800 flex gap-1.5 items-start">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAsset} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Category Selection */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-bold text-slate-600">Category Track</label>
                  <select
                    disabled={!!editingAsset}
                    value={categoryId}
                    onChange={e => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50 outline-none focus:border-indigo-500"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* SubType Selection */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-bold text-slate-600">Specific Sub-Type</label>
                  <select
                    value={subType}
                    onChange={e => setSubType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50 outline-none focus:border-indigo-500"
                  >
                    {categories.find(c => c.id === categoryId)?.subTypes.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    )) || <option value="">No sub-types available</option>}
                  </select>
                </div>

                {/* Asset ID/Code */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-600">Asset Code / ID</label>
                    {!editingAsset && (
                      <button
                        type="button"
                        onClick={() => {
                          const prefix = categoryId === "staff_bungalows" ? "NMA-BUNG-" : categoryId === "assembly_grounds" ? "NMA-GRD-" : "NMA-MKT-";
                          const matchingAssets = assets.filter(a => a.categoryId === categoryId);
                          const nextNum = matchingAssets.length + 1;
                          const formattedNum = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
                          setAssetId(`${prefix}${formattedNum}`);
                        }}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-500" /> Auto-Suggest Code
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    disabled={!!editingAsset}
                    value={assetId}
                    onChange={e => setAssetId(e.target.value)}
                    placeholder="Input custom Asset Code / ID e.g. MKT-B12, STORE-101"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 font-mono uppercase bg-white disabled:bg-slate-50 disabled:opacity-70"
                  />
                  {!editingAsset ? (
                    <span className="text-[9px] text-slate-500 block font-medium">
                      Type your custom Asset Code / ID or click Auto-Suggest.
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-400 block font-medium">
                      Unique asset identifier code
                    </span>
                  )}
                </div>

                {/* Standard Lease rent (Central Rates indicator) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Central Rent Rate</label>
                  <div className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 flex justify-between items-center h-[38px]">
                    <span>{getCentralRentRate(subType, rentRates)} GHS / mo</span>
                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[8px] font-extrabold tracking-wider border border-indigo-100 uppercase">
                      Fixed rate
                    </span>
                  </div>
                </div>
              </div>

              {/* Physical Name / Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Physical Name & Location / Block</label>
                <input
                  type="text"
                  value={assetName}
                  onChange={e => setAssetName(e.target.value)}
                  placeholder="e.g. Block B, Store #15 (Corner-side)"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                />
              </div>

              {/* Condition / Specifications Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Physical Condition & General Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Includes security shutter, standard lighting, newly built..."
                  rows={3}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Status choice if editing (to override manually if needed) */}
              {editingAsset && (
                <div className="space-y-1.5 bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                  <label className="text-xs font-bold text-slate-600 block">Override Operational Status</label>
                  <div className="flex gap-2 mt-1.5">
                    {["VACANT", "RESERVED", "OCCUPIED"].map(st => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatus(st as AssetStatus)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          status === st 
                            ? "bg-indigo-900 border-indigo-950 text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                  {status !== "VACANT" && !editingAsset.assignedApplicationId && (
                    <span className="text-[9px] text-amber-600 block mt-1.5">
                      ⚠️ Note: Manually setting an asset to non-vacant without an application ID is permitted but bypasses occupant sync.
                    </span>
                  )}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-900 hover:bg-indigo-800 text-white font-bold rounded-xl shadow transition-colors flex items-center gap-1.5"
                >
                  {isSubmitting ? "Saving..." : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{editingAsset ? "Save Changes" : "Register Asset"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Asset Deletion Confirmation Modal */}
      {showDeleteModal && assetToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" id="delete-asset-modal">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-150 text-left space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-50 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold tracking-tight">Delete Asset Profile?</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete physical asset <strong className="text-slate-800 font-semibold">{assetToDelete.id} - {assetToDelete.name}</strong> from the registry?
            </p>

            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-[11px] text-red-800 flex gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>This removes the asset and its metadata entirely. It is only permitted because the asset is currently VACANT. This is irreversible.</span>
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeDeleteAsset}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow shadow-red-100 transition-colors"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Allocation Modal */}
      {showAllocateModal && allocatingAsset && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" id="allocate-asset-modal">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-150 text-left space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-950">
                <UserCheck className="w-5 h-5 text-indigo-900" />
                <h3 className="text-base font-bold tracking-tight">Allocate Physical Space</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAllocateModal(false);
                  setAllocatingAsset(null);
                }}
                className="p-1 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Selected Asset Details Badge */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Target Asset Unit</span>
                  <h4 className="text-sm font-bold text-slate-800">{allocatingAsset.name}</h4>
                  <span className="font-mono text-xs text-indigo-600 font-bold block mt-0.5">{allocatingAsset.id}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Monthly Rent</span>
                  <span className="text-xs font-extrabold text-slate-700">{allocatingAsset.baseRent} GHS</span>
                </div>
              </div>
              <div className="flex gap-2 border-t border-slate-200/60 pt-2 text-[10px] text-slate-500 font-semibold">
                <span>Category: {categories.find(c => c.id === allocatingAsset.categoryId)?.name}</span>
                <span>•</span>
                <span>Type: {allocatingAsset.subType}</span>
              </div>
            </div>

            {allocationError && (
              <div className="bg-red-50 border border-red-150 rounded-xl p-3 text-xs text-red-800 flex gap-1.5 items-start">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{allocationError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 block">Select Registered Occupant / Applicant</label>
              {(() => {
                const eligibleApps = applications.filter(app => {
                  const matchesCategory = !matchCategoryOnly || app.categoryId === allocatingAsset.categoryId;
                  return matchesCategory;
                });

                if (eligibleApps.length === 0) {
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-1 py-0.5">
                        <input
                          type="checkbox"
                          id="match-category-checkbox"
                          checked={matchCategoryOnly}
                          onChange={e => setMatchCategoryOnly(e.target.checked)}
                          className="rounded text-indigo-900 focus:ring-indigo-900 h-3.5 w-3.5 border-slate-300"
                        />
                        <label htmlFor="match-category-checkbox" className="text-[10px] font-semibold text-slate-500 cursor-pointer select-none">
                          Only show applicants registered in the "{categories.find(c => c.id === allocatingAsset.categoryId)?.name || "matching"}" track
                        </label>
                      </div>
                      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-6 text-center text-slate-400 text-xs">
                        <p className="font-bold text-slate-600">No Applicants Found</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          No applicants currently registered under this track. Uncheck the filter box above to show applicants from all tracks.
                        </p>
                      </div>
                    </div>
                  );
                }

                const filteredEligible = eligibleApps.filter(app => {
                  const query = allocateSearchTerm.trim().toLowerCase();
                  if (!query) return true;
                  const fullName = `${app.firstName || ""} ${app.surname || ""}`.toLowerCase();
                  const cardNum = (app.ghanaCardNumber || "").toLowerCase();
                  const subTypeVal = (app.subType || "").toLowerCase();
                  const catName = (categories.find(c => c.id === app.categoryId)?.name || "").toLowerCase();
                  return fullName.includes(query) || cardNum.includes(query) || subTypeVal.includes(query) || catName.includes(query);
                });

                return (
                  <div className="space-y-2">
                    {/* Filter checkbox */}
                    <div className="flex items-center gap-2 px-1 py-0.5 bg-slate-50 border border-slate-100 p-2 rounded-xl">
                      <input
                        type="checkbox"
                        id="match-category-checkbox"
                        checked={matchCategoryOnly}
                        onChange={e => setMatchCategoryOnly(e.target.checked)}
                        className="rounded text-indigo-900 focus:ring-indigo-900 h-3.5 w-3.5 border-slate-300 cursor-pointer"
                      />
                      <label htmlFor="match-category-checkbox" className="text-[10px] font-bold text-indigo-950 cursor-pointer select-none">
                        Filter: Match "{categories.find(c => c.id === allocatingAsset.categoryId)?.name || "Track"}" only
                      </label>
                    </div>

                    {/* Search Field */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={allocateSearchTerm}
                        onChange={e => setAllocateSearchTerm(e.target.value)}
                        placeholder="Search applicant by name, track, Ghana Card..."
                        className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-xs transition-all bg-slate-50/50"
                      />
                      {allocateSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setAllocateSearchTerm("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {filteredEligible.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1 border border-slate-150 rounded-xl p-2 bg-slate-50/50">
                        {filteredEligible.map(app => {
                          const isPerfectTypeMatch = app.subType === allocatingAsset.subType;
                          const isSelected = selectedAppId === app.id;
                          const assignedCount = assets.filter(a => a.assignedApplicationId === app.id).length;
                          const appCategory = categories.find(c => c.id === app.categoryId);
                          
                          return (
                            <div
                              key={app.id}
                              onClick={() => setSelectedAppId(app.id)}
                              className={`p-3 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                                isSelected
                                  ? "bg-indigo-900 border-indigo-950 text-white shadow-sm"
                                  : "bg-white border-slate-150 hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div className="min-w-0 flex-1 pr-2 text-left">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-xs font-bold truncate">
                                    {app.firstName} {app.surname}
                                  </p>
                                  {assignedCount > 0 && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                      isSelected ? "bg-indigo-800 text-indigo-100" : "bg-blue-50 text-blue-700 border border-blue-100"
                                    }`}>
                                      Holds {assignedCount} {assignedCount === 1 ? 'Space' : 'Spaces'}
                                    </span>
                                  )}
                                  {app.status === "PENDING_ALLOCATION" && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                      isSelected ? "bg-indigo-800 text-indigo-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                                    }`}>
                                      New Occupant
                                    </span>
                                  )}
                                </div>
                                <p className={`text-[10px] font-mono mt-0.5 ${isSelected ? "text-indigo-200" : "text-slate-400"}`}>
                                  {app.ghanaCardNumber} • {app.subType}
                                </p>
                                {!matchCategoryOnly && app.categoryId !== allocatingAsset.categoryId && (
                                  <span className={`text-[8px] font-bold block mt-1 uppercase ${isSelected ? "text-indigo-200" : "text-indigo-600"}`}>
                                    Track: {appCategory?.name || "Other"}
                                  </span>
                                )}
                              </div>
                              {isPerfectTypeMatch && app.categoryId === allocatingAsset.categoryId && (
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 ${
                                  isSelected ? "bg-indigo-800 text-indigo-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                }`}>
                                  Type Match
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-6 text-center text-slate-400 text-xs italic">
                        No applicants found matching "{allocateSearchTerm}".
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowAllocateModal(false);
                  setAllocatingAsset(null);
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAllocating || !selectedAppId}
                onClick={executeAllocation}
                className="px-4 py-2 bg-indigo-900 hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow transition-colors flex items-center gap-1.5"
              >
                {isAllocating ? "Allocating..." : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Confirm Allocation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" id="asset-import-modal">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-150 text-left space-y-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2 text-emerald-950">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">
                    Bulk Import Municipal Assets
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Upload a CSV/Excel file or paste asset records to import in bulk
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Content Body - Scrollable */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Sample Template & Upload Row */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" /> CSV Template & Structure
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Columns: Asset Code, Physical Description, Category, Space Variant, Monthly Rent, Notes
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* Upload Input & Paste Textarea */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File Upload Box */}
                <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-5 text-center flex flex-col items-center justify-center bg-slate-50/50 transition-colors">
                  <Upload className="w-8 h-8 text-indigo-600 mb-2" />
                  <p className="text-xs font-bold text-slate-700">Choose a CSV / Text File</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 mb-3">.csv or .txt files supported</p>
                  <label className="px-3.5 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm">
                    Select File
                    <input
                      type="file"
                      accept=".csv, .txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  {importFileName && (
                    <span className="mt-2 text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 truncate max-w-[200px]">
                      📄 {importFileName}
                    </span>
                  )}
                </div>

                {/* Direct Paste Area */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Or Paste CSV Data Directly</label>
                  <textarea
                    rows={5}
                    value={importText}
                    onChange={e => handleImportTextChange(e.target.value)}
                    placeholder={"Asset Code, Description, Category, Space Variant, Rent, Notes\nNMA-MKT-B01, Block B Store #01, Market Stores & Shed, Market Store, 150, Front row\nNMA-MKT-S05, Market Shed Stall #05, Market Stores & Shed, Market Shed, 80, Standard"}
                    className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs font-mono outline-none focus:border-indigo-500 bg-white leading-relaxed resize-none"
                  />
                </div>
              </div>

              {/* Messages */}
              {importErrorMsg && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-xs text-red-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{importErrorMsg}</span>
                </div>
              )}

              {importSuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-800 flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{importSuccessMsg}</span>
                </div>
              )}

              {/* Preview & Validation Table */}
              {parsedImportAssets.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">
                      Import Batch Preview ({parsedImportAssets.length} parsed records)
                    </span>
                    <div className="flex gap-2">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        {parsedImportAssets.filter(i => !i.error).length} Valid
                      </span>
                      {parsedImportAssets.filter(i => i.error).length > 0 && (
                        <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                          {parsedImportAssets.filter(i => i.error).length} Errors
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-2xl bg-white text-[11px]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px] tracking-wider sticky top-0">
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Code / ID</th>
                          <th className="p-2.5">Description</th>
                          <th className="p-2.5">Variant</th>
                          <th className="p-2.5">Rent</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedImportAssets.map(item => (
                          <tr key={item.rowIndex} className={item.error ? "bg-red-50/50" : "hover:bg-slate-50/80"}>
                            <td className="p-2.5 font-mono text-slate-400">{item.rowIndex}</td>
                            <td className="p-2.5 font-mono font-bold text-slate-800">{item.id || "—"}</td>
                            <td className="p-2.5 font-medium text-slate-700 max-w-[180px] truncate">{item.name}</td>
                            <td className="p-2.5 text-slate-600">{item.subType}</td>
                            <td className="p-2.5 font-bold text-indigo-900">{item.baseRent} GHS</td>
                            <td className="p-2.5">
                              {item.error ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>{item.error}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                  <Check className="w-3 h-3 shrink-0" />
                                  <span>Valid</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 text-xs shrink-0">
              <button
                type="button"
                disabled={isImporting}
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isImporting || parsedImportAssets.filter(i => !i.error).length === 0}
                onClick={executeBatchImport}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow transition-colors flex items-center gap-1.5"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Importing Records...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Confirm & Import ({parsedImportAssets.filter(i => !i.error).length} Assets)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
