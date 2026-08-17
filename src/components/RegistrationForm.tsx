import React, { useState, useEffect } from "react";
import { Category, AttributeDefinition, SmsTemplatesSetting, PortalUser } from "../types";
import CameraCapture from "./CameraCapture";
import { User, CreditCard, ShieldCheck, HelpCircle, Loader2, Plus, Sparkles, CheckCircle, AlertTriangle, Phone, MapPin } from "lucide-react";
import { collection, addDoc, getDocs, doc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { sendSMSAndLog, formatRegistrationSms } from "../services/smsService";
import { DEFAULT_SMS_TEMPLATES } from "../data";

interface RegistrationFormProps {
  categories: Category[];
  onSuccess: () => void;
  onCancel: () => void;
  smsTemplates?: SmsTemplatesSetting | null;
  currentUser?: PortalUser | null;
}

export default function RegistrationForm({ categories, onSuccess, onCancel, smsTemplates, currentUser }: RegistrationFormProps) {
  const isRegistrar = currentUser?.role === "REGISTRAR";
  // Core Bio details
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [gender, setGender] = useState<"Male" | "Female">("Male");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [ghanaCardNumber, setGhanaCardNumber] = useState("");
  const [photo, setPhoto] = useState<string>("");

  // Track / Asset Selector
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubType, setSelectedSubType] = useState("");
  
  // Custom Attributes values map
  const [rawAttributes, setRawAttributes] = useState<Record<string, any>>({});

  // Loading, Errors, and Review States
  const [isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [workflowMessage, setWorkflowMessage] = useState("");
  const [aiVerifiedReport, setAiVerifiedReport] = useState<{
    valid: boolean;
    errors: string[];
    normalizedAttributes: Record<string, any>;
    verificationSummary: string;
  } | null>(null);

  const [showPreview, setShowPreview] = useState(false);
  const [pendingApplication, setPendingApplication] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setFirstName("");
    setSurname("");
    setGender("Male");
    setContactNumber("");
    setAddress("");
    setGhanaCardNumber("");
    setPhoto("");
    setValidationErrors([]);
    setAiVerifiedReport(null);
    setShowPreview(false);
    setPendingApplication(null);
    if (categories.length > 0) {
      const firstCat = categories[0];
      setSelectedCategoryId(firstCat.id);
      if (firstCat.subTypes.length > 0) {
        setSelectedSubType(firstCat.subTypes[0]);
      }
      const initialAttrs: Record<string, any> = {};
      firstCat.attributes.forEach(attr => {
        initialAttrs[attr.slug] = attr.type === "select" ? (attr.options?.[0] || "") : "";
      });
      setRawAttributes(initialAttrs);
    }
  };

  // Default selection set on mount
  useEffect(() => {
    if (categories.length > 0) {
      const firstCat = categories[0];
      setSelectedCategoryId(firstCat.id);
      if (firstCat.subTypes.length > 0) {
        setSelectedSubType(firstCat.subTypes[0]);
      }
      
      // Initialize raw attributes
      const initialAttrs: Record<string, any> = {};
      firstCat.attributes.forEach(attr => {
        initialAttrs[attr.slug] = attr.type === "select" ? (attr.options?.[0] || "") : "";
      });
      setRawAttributes(initialAttrs);
    }
  }, [categories]);

  // Handle Category Switch
  const handleCategoryChange = (catId: string) => {
    setSelectedCategoryId(catId);
    const cat = categories.find(c => c.id === catId);
    if (cat) {
      setSelectedSubType(cat.subTypes[0] || "");
      
      // Reset raw attributes matching new category
      const initialAttrs: Record<string, any> = {};
      cat.attributes.forEach(attr => {
        initialAttrs[attr.slug] = attr.type === "select" ? (attr.options?.[0] || "") : "";
      });
      setRawAttributes(initialAttrs);
    }
  };

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  const handleAttributeChange = (slug: string, value: any) => {
    setRawAttributes(prev => ({
      ...prev,
      [slug]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);
    setAiVerifiedReport(null);

    // Client-side quick checks
    if (!firstName.trim() || !surname.trim()) {
      setValidationErrors(["Please enter both First Name and Surname."]);
      return;
    }

    if (!gender) {
      setValidationErrors(["Please select your Gender."]);
      return;
    }

    const cleanedContact = contactNumber.replace(/\D/g, "");
    if (cleanedContact.length !== 10) {
      setValidationErrors(["Contact Number must be exactly 10 digits."]);
      return;
    }

    if (!address.trim()) {
      setValidationErrors(["Please enter a valid Residential or Business Address."]);
      return;
    }

    const ghanaCardRegex = /^GHA-\d{9}-\d$/;
    if (!ghanaCardRegex.test(ghanaCardNumber.trim().toUpperCase())) {
      setValidationErrors(["Ghana Card Number must match standard format: GHA-XXXXXXXXX-X (e.g. GHA-123456789-0)."]);
      return;
    }

    if (!photo) {
      setValidationErrors(["Applicant passport photo is required."]);
      return;
    }

    if (!selectedCategoryId || !selectedSubType) {
      setValidationErrors(["Please select a property category track and sub-type."]);
      return;
    }

    setIsValidating(true);
    setWorkflowMessage("Validating and storing credentials securely...");

    try {
      // Call validation endpoint (runs 100% locally and deterministically now)
      const response = await fetch("/api/process-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          surname: surname.trim(),
          gender,
          contactNumber: contactNumber.trim(),
          address: address.trim(),
          ghanaCardNumber: ghanaCardNumber.trim().toUpperCase(),
          photo,
          categoryId: selectedCategoryId,
          categoryName: selectedCategory?.name || "Unknown Track",
          subType: selectedSubType,
          rawAttributes,
          attributeDefinitions: selectedCategory?.attributes || []
        })
      });

      if (!response.ok) {
        throw new Error("Validation engine failed to process the request. Please verify inputs.");
      }

      const result = await response.json();
      setIsValidating(false);

      if (result.valid) {
        const appId = `APP-${Date.now().toString().slice(-6)}`;
        
        const newApplication = {
          id: appId,
          categoryId: selectedCategoryId,
          subType: selectedSubType,
          firstName: result.normalizedAttributes?.firstName || firstName.trim(),
          surname: result.normalizedAttributes?.surname || surname.trim(),
          gender,
          contactNumber: contactNumber.trim(),
          address: result.normalizedAttributes?.address || address.trim(),
          ghanaCardNumber: ghanaCardNumber.trim().toUpperCase(),
          photo,
          attributes: result.normalizedAttributes || rawAttributes,
          status: "PENDING_ALLOCATION" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        setPendingApplication(newApplication);
        setAiVerifiedReport(result);
        setShowPreview(true);
      } else {
        setValidationErrors(result.errors || ["Unknown validation failure."]);
      }
    } catch (err) {
      setIsValidating(false);
      setValidationErrors([err instanceof Error ? err.message : "Error contacting validation server."]);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!pendingApplication) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, "applications", pendingApplication.id), pendingApplication);
      
      // Asynchronously trigger Wigal SMS notification to the client upon successful registration
      try {
        const template = smsTemplates?.registration || DEFAULT_SMS_TEMPLATES.registration;
        const smsMessage = formatRegistrationSms(template, {
          firstName: pendingApplication.firstName,
          id: pendingApplication.id
        });
        sendSMSAndLog(pendingApplication.contactNumber, smsMessage, pendingApplication.categoryId)
          .then(log => console.log("[Registration SMS Logged]", log))
          .catch(err => console.error("[Registration SMS Error]", err));
      } catch (smsErr) {
        console.error("SMS notification send trigger failed:", smsErr);
      }

      setShowPreview(false);
    } catch (dbErr) {
      handleFirestoreError(dbErr, OperationType.CREATE, `applications/${pendingApplication.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden" id="registration-form-panel">
      {/* Form Header */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-6 text-white relative">
        <div className="absolute top-4 right-4 bg-white/10 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 backdrop-blur-md">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-300" /> Validation Engine Active
        </div>
        <h3 className="text-xl font-bold tracking-tight">On-Site Applicant Registration</h3>
        <p className="text-blue-100 text-xs mt-1">Digitizing property tracks & housing variants dynamically</p>
      </div>

      {/* Validation / Loading Screen */}
      {isValidating && (
        <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 min-h-[400px]">
          <div className="relative">
            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
          </div>
          <h4 className="text-lg font-bold text-slate-800">Processing Registration</h4>
          <p className="text-sm text-slate-500 max-w-xs">{workflowMessage}</p>
        </div>
      )}

      {/* Registration Preview Panel Screen */}
      {!isValidating && showPreview && pendingApplication && (
        <div className="p-6 space-y-6 text-left animate-fade-in" id="registration-preview-panel">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start shadow-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <h4 className="text-xs font-extrabold text-amber-800 uppercase tracking-wider">Please Review Application Profile</h4>
              <p className="text-[11px] text-amber-700 leading-normal mt-0.5 font-medium">
                Verify all the details below are perfect before officially registering the occupant and assigning their track record in the database.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Passport Photo Column */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Passport Photo</span>
              <div className="aspect-[4/5] md:aspect-[3/4] bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden relative shadow-inner flex items-center justify-center">
                {pendingApplication.photo ? (
                  <img
                    src={pendingApplication.photo}
                    alt="Applicant Preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-slate-400 text-xs font-medium">No Image Uploaded</div>
                )}
              </div>
            </div>

            {/* Application Data Grid */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Applicant Bio-data</span>
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150 mt-1.5 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block">First Name</span>
                    <strong className="text-slate-800 text-sm font-bold">{pendingApplication.firstName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Surname</span>
                    <strong className="text-slate-800 text-sm font-bold">{pendingApplication.surname}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Gender</span>
                    <strong className="text-slate-800 font-bold">{pendingApplication.gender}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Contact Number</span>
                    <strong className="text-slate-800 font-mono font-bold">{pendingApplication.contactNumber}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 font-semibold block">Ghana Card Number</span>
                    <strong className="text-slate-800 font-mono text-[13px] tracking-wide font-bold">{pendingApplication.ghanaCardNumber}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 font-semibold block">Residential/Business Address</span>
                    <strong className="text-slate-800 font-bold">{pendingApplication.address}</strong>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Dynamic Track Selection</span>
                <div className="grid grid-cols-2 gap-4 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/40 mt-1.5 text-xs">
                  <div>
                    <span className="text-indigo-900/50 font-bold block">Selected Track</span>
                    <strong className="text-indigo-950 font-bold text-sm">{selectedCategory?.name}</strong>
                  </div>
                  <div>
                    <span className="text-indigo-900/50 font-bold block">Variant Subtype</span>
                    <strong className="text-indigo-950 font-bold text-sm">{pendingApplication.subType}</strong>
                  </div>

                  {/* Attributes list */}
                  <div className="col-span-2 pt-2 border-t border-indigo-100/30">
                    <span className="text-[9px] text-indigo-400 font-bold uppercase block mb-1.5 tracking-wider">Custom Track Attributes (EAV mapping)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px] text-indigo-900">
                      {selectedCategory?.attributes.map(attr => (
                        <div key={attr.slug} className="flex justify-between items-center bg-white/75 px-3 py-1.5 rounded-xl border border-indigo-100/30">
                          <span className="text-indigo-650 font-medium">{attr.label}:</span>
                          <span className="font-extrabold text-slate-800">{pendingApplication.attributes[attr.slug] || "N/A"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-150">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setShowPreview(false)}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all active:scale-98 disabled:opacity-50"
            >
              Go Back and Edit
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleConfirmAndSave}
              className="flex-1 py-3 rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-300" />
                  <span>Confirm & Save to Database</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Successful Validation Report */}
      {!isValidating && !showPreview && aiVerifiedReport && aiVerifiedReport.valid && (
        <div className="p-8 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm">
            <CheckCircle className="w-10 h-10" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-800">Registration Success</h4>
            <p className="text-xs text-slate-400 mt-1">Profile validated and stored securely</p>
          </div>
          
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-left w-full space-y-3 max-w-sm">
            <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-650" /> Normalized EAV Attribute Log
            </h5>
            <p className="text-xs text-slate-600 italic">"{aiVerifiedReport.verificationSummary}"</p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/50 text-xs text-slate-700 font-mono">
              <div>
                <span className="text-slate-400">First Name:</span>{" "}
                <span className="font-semibold text-slate-900">{firstName}</span>
              </div>
              <div>
                <span className="text-slate-400">Surname:</span>{" "}
                <span className="font-semibold text-slate-900">{surname}</span>
              </div>
              <div>
                <span className="text-slate-400">Ghana Card:</span>{" "}
                <span className="font-semibold text-slate-900">{ghanaCardNumber.toUpperCase()}</span>
              </div>
              <div>
                <span className="text-slate-400">Track:</span>{" "}
                <span className="font-semibold text-slate-900">{selectedCategory?.name}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isRegistrar) {
                resetForm();
              } else {
                onSuccess();
              }
            }}
            className="w-full max-w-xs py-3 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-bold transition-all shadow-md active:scale-95 cursor-pointer"
          >
            {isRegistrar ? "Register Another Space" : "Back to Dashboard"}
          </button>
        </div>
      )}

      {/* Main Form Fields */}
      {!isValidating && !showPreview && !aiVerifiedReport && (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Banner */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 text-red-800 border border-red-100 p-4 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>Verification Warning</span>
              </div>
              <ul className="list-disc pl-4 space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Grid Layout splits bio details and camera capture */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Hand: Core Personal & Identification details */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase text-slate-400 tracking-wider">
                1. Personal Details
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="e.g. Kofi"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none text-sm transition-all bg-slate-50/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Surname</label>
                  <input
                    type="text"
                    required
                    value={surname}
                    onChange={e => setSurname(e.target.value)}
                    placeholder="e.g. Mensah"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none text-sm transition-all bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Gender</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Male", "Female"] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        gender === g
                          ? "bg-indigo-50 border-indigo-600 text-indigo-700"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                  <span>Contact Number</span>
                  <span className="text-[10px] text-slate-400 font-mono">Mobile / Telephone</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={contactNumber}
                    onChange={e => setContactNumber(e.target.value)}
                    placeholder="e.g. +233 24 412 3456"
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none text-sm transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                  <span>Ghana Card Number</span>
                  <span className="text-[10px] text-slate-400 font-mono">GHA-XXXXXXXXX-X</span>
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={ghanaCardNumber}
                    onChange={e => setGhanaCardNumber(e.target.value)}
                    placeholder="e.g. GHA-123456789-0"
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none text-sm transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                  <span>Residential / Business Address</span>
                  <span className="text-[10px] text-slate-400 font-mono">Mandatory</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="e.g. H/No. 45 Block B, Nsawam"
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none text-sm transition-all"
                  />
                </div>
              </div>

              {/* Dynamic Property Track selection */}
              <div className="space-y-4 pt-2">
                <h4 className="text-sm font-bold uppercase text-slate-400 tracking-wider">
                  2. Dynamic Track Allocation
                </h4>

                 <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Selected Track</label>
                  <select
                    value={selectedCategoryId}
                    onChange={e => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none font-medium focus:border-indigo-500"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.description})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCategory && (
                  <div className="grid grid-cols-1 gap-3 p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/50">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Space Variant</label>
                      <select
                        value={selectedSubType}
                        onChange={e => setSelectedSubType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-indigo-500"
                      >
                        {selectedCategory.subTypes.map(sub => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>

                     {/* Dynamic EAV Fields based on IT configuration */}
                    {selectedCategory.attributes.map(attr => (
                      <div key={attr.slug} className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          {attr.label}
                          {attr.required && <span className="text-red-500">*</span>}
                        </label>

                        {attr.type === "select" ? (
                          <select
                            value={rawAttributes[attr.slug] || ""}
                            onChange={e => handleAttributeChange(attr.slug, e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-indigo-500"
                          >
                            {attr.options?.map(opt => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : attr.type === "number" ? (
                          <input
                            type="number"
                            required={attr.required}
                            value={rawAttributes[attr.slug] || ""}
                            onChange={e => handleAttributeChange(attr.slug, e.target.value)}
                            placeholder={`Enter ${attr.label.toLowerCase()}`}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-indigo-500"
                          />
                        ) : (
                          <input
                            type="text"
                            required={attr.required}
                            value={rawAttributes[attr.slug] || ""}
                            onChange={e => handleAttributeChange(attr.slug, e.target.value)}
                            placeholder={`Enter ${attr.label.toLowerCase()}`}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-indigo-500"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Hand: Active Camera Photo Capture */}
            <div>
              <h4 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-4">
                3. Face Verification
              </h4>
              <CameraCapture onCapture={setPhoto} savedPhoto={photo} />
            </div>
          </div>

          {/* Bottom Action buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                if (isRegistrar) {
                  resetForm();
                } else {
                  onCancel();
                }
              }}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {isRegistrar ? "Clear Form" : "Cancel"}
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-300" /> Register & Save
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
