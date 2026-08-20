import React, { useState } from "react";
import { Category, AttributeDefinition, PortalUser, UserRole, Setting, SmsTemplatesSetting, AllocationLetterSetting, RentRatesSetting, RentBillTemplateSetting, GlobalSignatureSetting } from "../types";
import { Plus, Trash2, ShieldAlert, Sparkles, HelpCircle, Save, CheckCircle2, ChevronRight, Settings, Info, Edit, AlertCircle, ShieldCheck, User, FileText, Smartphone, Printer, Upload, PenTool } from "lucide-react";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { DEFAULT_SMS_TEMPLATES, DEFAULT_ALLOCATION_LETTER_TEMPLATE, DEFAULT_RENT_BILL_TEMPLATE, DEFAULT_AGREEMENT_TEMPLATE, DEFAULT_GLOBAL_SIGNATURE } from "../data";
import { useGlobalLogoUrl } from "../utils/logoState";
import MunicipalLogo from "./MunicipalLogo";
import SignaturePad from "./SignaturePad";

interface SettingsPanelProps {
  categories: Category[];
  users: PortalUser[];
  onUpdate: () => void;
  onClose: () => void;
  agreementTemplate?: Setting | null;
  smsTemplates?: SmsTemplatesSetting | null;
  allocationLetterTemplate?: AllocationLetterSetting | null;
  rentRates?: RentRatesSetting | null;
  rentBillTemplate?: RentBillTemplateSetting | null;
  globalSignature?: GlobalSignatureSetting | null;
}

export default function SettingsPanel({ categories, users, onUpdate, onClose, agreementTemplate, smsTemplates, allocationLetterTemplate, rentRates, rentBillTemplate, globalSignature }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<"LIST" | "CREATE" | "EDIT" | "USERS" | "AGREEMENT" | "SMS" | "ALLOCATION" | "RENT_RATES" | "BILL_TEMPLATE" | "GLOBAL_SIGNATURE">("LIST");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  // Global Signature & Signee states
  const [sigName, setSigName] = useState("");
  const [sigTitle, setSigTitle] = useState("");
  const [sigImg, setSigImg] = useState<string | null>(null);
  const [sigSaving, setSigSaving] = useState(false);

  // Central Rent Rates states
  const [storeRentValue, setStoreRentValue] = useState<number>(150);
  const [shedRentValue, setShedRentValue] = useState<number>(80);
  const [groundsRentValue, setGroundsRentValue] = useState<number>(100);
  const [ratesSaving, setRatesSaving] = useState(false);

  // Rent Bill Template states
  const [billTitle, setBillTitle] = useState("");
  const [billSubTitle, setBillSubTitle] = useState("");
  const [billBoxAddress, setBillBoxAddress] = useState("");
  const [billLogoUrl, setBillLogoUrl] = useState("");
  const [billPaymentGuidelines, setBillPaymentGuidelines] = useState("");
  const [billSaving, setBillSaving] = useState(false);

  // Allocation Letter Template editing states
  const [allocTitle, setAllocTitle] = useState("");
  const [allocSubTitle, setAllocSubTitle] = useState("");
  const [allocBoxAddress, setAllocBoxAddress] = useState("");
  const [allocLetterSubject, setAllocLetterSubject] = useState("");
  const [allocSalutation, setAllocSalutation] = useState("");
  const [allocIntroduction, setAllocIntroduction] = useState("");
  const [allocDetailsIntro, setAllocDetailsIntro] = useState("");
  const [allocConditionsIntro, setAllocConditionsIntro] = useState("");
  const [allocConditionsList, setAllocConditionsList] = useState<string[]>([]);
  const [allocInstructions, setAllocInstructions] = useState("");
  const [allocConcludingRemarks, setAllocConcludingRemarks] = useState("");
  const [allocLogoUrl, setAllocLogoUrl] = useState("");
  const [allocSaving, setAllocSaving] = useState(false);

  // Agreement Template editing states
  const [templateLessorTitle, setTemplateLessorTitle] = useState("");
  const [templateOfficeTitle, setTemplateOfficeTitle] = useState("");
  const [templateBoxAddress, setTemplateBoxAddress] = useState("");
  const [templateLessorDesc, setTemplateLessorDesc] = useState("");
  const [templateRecitals, setTemplateRecitals] = useState("");
  const [templateTermsList, setTemplateTermsList] = useState<string[]>([]);
  const [templateWitnessStatement, setTemplateWitnessStatement] = useState("");
  const [templateStatutoryText, setTemplateStatutoryText] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);

  // Global Logo states
  const [globalLogoUploading, setGlobalLogoUploading] = useState(false);
  const globalLogoUrl = useGlobalLogoUrl();

  // SMS Template editing states
  const [smsRegTemplate, setSmsRegTemplate] = useState("");
  const [smsAllocTemplate, setSmsAllocTemplate] = useState("");
  const [smsPayTemplate, setSmsPayTemplate] = useState("");
  const [smsSaving, setSmsSaving] = useState(false);

  const handleOpenAgreementTab = () => {
    setActiveTab("AGREEMENT");
    setTemplateLessorTitle(agreementTemplate?.lessorTitle || "");
    setTemplateOfficeTitle(agreementTemplate?.officeTitle || "");
    setTemplateBoxAddress(agreementTemplate?.boxAddress || "");
    setTemplateLessorDesc(agreementTemplate?.lessorDesc || "");
    setTemplateRecitals(agreementTemplate?.recitals || "");
    setTemplateTermsList(agreementTemplate?.termsList || []);
    setTemplateWitnessStatement(agreementTemplate?.witnessStatement || "");
    setTemplateStatutoryText(agreementTemplate?.statutoryText || "");
    setErrorMessage("");
    setMessage("");
  };

  const handleOpenSmsTab = () => {
    setActiveTab("SMS");
    setSmsRegTemplate(smsTemplates?.registration || DEFAULT_SMS_TEMPLATES.registration);
    setSmsAllocTemplate(smsTemplates?.allocation || DEFAULT_SMS_TEMPLATES.allocation);
    setSmsPayTemplate(smsTemplates?.payment || DEFAULT_SMS_TEMPLATES.payment);
    setErrorMessage("");
    setMessage("");
  };

  const handleOpenRatesTab = () => {
    setActiveTab("RENT_RATES");
    setStoreRentValue(rentRates?.storeRentRate ?? 150);
    setShedRentValue(rentRates?.shedRentRate ?? 80);
    setGroundsRentValue(rentRates?.groundsRentRate ?? 100);
    setErrorMessage("");
    setMessage("");
  };

  const handleSaveRentRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setRatesSaving(true);
    setErrorMessage("");
    setMessage("");
    try {
      const docRef = doc(db, "settings", "rent_rates");
      await setDoc(docRef, {
        id: "rent_rates",
        storeRentRate: Number(storeRentValue),
        shedRentRate: Number(shedRentValue),
        groundsRentRate: Number(groundsRentValue)
      });
      setMessage("Central Rent Rates successfully updated in Firestore for Stores, Sheds, and Assembly Grounds!");
      setRatesSaving(false);
      onUpdate();
    } catch (err) {
      setRatesSaving(false);
      setErrorMessage("Failed to save central Rent Rates to Firestore.");
      handleFirestoreError(err, OperationType.UPDATE, "settings/rent_rates");
    }
  };

  const handleSaveSmsTemplates = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmsSaving(true);
    setErrorMessage("");
    setMessage("");
    try {
      const docRef = doc(db, "settings", "sms_templates");
      await setDoc(docRef, {
        id: "sms_templates",
        registration: smsRegTemplate.trim(),
        allocation: smsAllocTemplate.trim(),
        payment: smsPayTemplate.trim()
      });
      setMessage("SMS notification templates successfully updated in Firestore!");
      onUpdate();
    } catch (err) {
      setErrorMessage("Failed to save SMS templates to Firestore.");
      handleFirestoreError(err, OperationType.UPDATE, "settings/sms_templates");
    } finally {
      setSmsSaving(false);
    }
  };

  const handleOpenAllocationTab = () => {
    setActiveTab("ALLOCATION");
    setAllocTitle(allocationLetterTemplate?.title || DEFAULT_ALLOCATION_LETTER_TEMPLATE.title);
    setAllocSubTitle(allocationLetterTemplate?.subTitle || DEFAULT_ALLOCATION_LETTER_TEMPLATE.subTitle);
    setAllocBoxAddress(allocationLetterTemplate?.boxAddress || DEFAULT_ALLOCATION_LETTER_TEMPLATE.boxAddress);
    setAllocLetterSubject(allocationLetterTemplate?.letterSubject || DEFAULT_ALLOCATION_LETTER_TEMPLATE.letterSubject);
    setAllocSalutation(allocationLetterTemplate?.salutation || DEFAULT_ALLOCATION_LETTER_TEMPLATE.salutation);
    setAllocIntroduction(allocationLetterTemplate?.introduction || DEFAULT_ALLOCATION_LETTER_TEMPLATE.introduction);
    setAllocDetailsIntro(allocationLetterTemplate?.detailsIntro || DEFAULT_ALLOCATION_LETTER_TEMPLATE.detailsIntro);
    setAllocConditionsIntro(allocationLetterTemplate?.conditionsIntro || DEFAULT_ALLOCATION_LETTER_TEMPLATE.conditionsIntro);
    setAllocConditionsList(allocationLetterTemplate?.conditionsList || DEFAULT_ALLOCATION_LETTER_TEMPLATE.conditionsList);
    setAllocInstructions(allocationLetterTemplate?.instructions || DEFAULT_ALLOCATION_LETTER_TEMPLATE.instructions);
    setAllocConcludingRemarks(allocationLetterTemplate?.concludingRemarks || DEFAULT_ALLOCATION_LETTER_TEMPLATE.concludingRemarks);
    setAllocLogoUrl(allocationLetterTemplate?.logoUrl || "");
    setErrorMessage("");
    setMessage("");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 250 * 1024) {
      setErrorMessage("Logo size should be under 250KB for cloud ledger synchronization.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setAllocLogoUrl(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenBillTemplateTab = () => {
    setActiveTab("BILL_TEMPLATE");
    setBillTitle(rentBillTemplate?.title || DEFAULT_RENT_BILL_TEMPLATE.title);
    setBillSubTitle(rentBillTemplate?.subTitle || DEFAULT_RENT_BILL_TEMPLATE.subTitle);
    setBillBoxAddress(rentBillTemplate?.boxAddress || DEFAULT_RENT_BILL_TEMPLATE.boxAddress);
    setBillLogoUrl(rentBillTemplate?.logoUrl || "");
    setBillPaymentGuidelines(rentBillTemplate?.paymentGuidelines || DEFAULT_RENT_BILL_TEMPLATE.paymentGuidelines);
    setErrorMessage("");
    setMessage("");
  };

  const handleBillLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 250 * 1024) {
      setErrorMessage("Logo size should be under 250KB for cloud ledger synchronization.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setBillLogoUrl(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveRentBillTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillSaving(true);
    setErrorMessage("");
    setMessage("");
    try {
      const docRef = doc(db, "settings", "rent_bill_template");
      await setDoc(docRef, {
        id: "rent_bill_template",
        title: billTitle.trim(),
        subTitle: billSubTitle.trim(),
        boxAddress: billBoxAddress.trim(),
        logoUrl: billLogoUrl,
        paymentGuidelines: billPaymentGuidelines.trim()
      });
      setMessage("Rent Bill & Demand Notice Template successfully updated in Firestore!");
      onUpdate();
    } catch (err) {
      setErrorMessage("Failed to save Rent Bill Template to Firestore.");
      handleFirestoreError(err, OperationType.UPDATE, "settings/rent_bill_template");
    } finally {
      setBillSaving(false);
    }
  };

  const handleOpenGlobalSignatureTab = () => {
    setActiveTab("GLOBAL_SIGNATURE");
    setSigName(globalSignature?.signeeName || DEFAULT_GLOBAL_SIGNATURE.signeeName);
    setSigTitle(globalSignature?.signeeTitle || DEFAULT_GLOBAL_SIGNATURE.signeeTitle);
    setSigImg(globalSignature?.signatureImg || null);
    setErrorMessage("");
    setMessage("");
  };

  const handleSaveGlobalSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigSaving(true);
    setErrorMessage("");
    setMessage("");
    try {
      const docRef = doc(db, "settings", "global_signature");
      await setDoc(docRef, {
        id: "global_signature",
        signeeName: sigName.trim(),
        signeeTitle: sigTitle.trim(),
        signatureImg: sigImg || ""
      });
      setMessage("Global Authorized Signatory & Signature successfully updated in Firestore!");
      onUpdate();
    } catch (err) {
      setErrorMessage("Failed to save global signature settings to Firestore.");
      handleFirestoreError(err, OperationType.UPDATE, "settings/global_signature");
    } finally {
      setSigSaving(false);
    }
  };

  const handleUpdateCondition = (idx: number, val: string) => {
    setAllocConditionsList(prev => {
      const updated = [...prev];
      updated[idx] = val;
      return updated;
    });
  };

  const handleAddCondition = () => {
    setAllocConditionsList(prev => [...prev, ""]);
  };

  const handleRemoveCondition = (idx: number) => {
    setAllocConditionsList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveAllocationTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAllocSaving(true);
    setErrorMessage("");
    setMessage("");
    try {
      const docRef = doc(db, "settings", "allocation_letter_template");
      await setDoc(docRef, {
        id: "allocation_letter_template",
        title: allocTitle.trim(),
        subTitle: allocSubTitle.trim(),
        boxAddress: allocBoxAddress.trim(),
        letterSubject: allocLetterSubject.trim(),
        salutation: allocSalutation.trim(),
        introduction: allocIntroduction.trim(),
        detailsIntro: allocDetailsIntro.trim(),
        conditionsIntro: allocConditionsIntro.trim(),
        conditionsList: allocConditionsList.map(c => c.trim()).filter(Boolean),
        instructions: allocInstructions.trim(),
        concludingRemarks: allocConcludingRemarks.trim(),
        logoUrl: allocLogoUrl
      });
      setMessage("Allocation letter template successfully updated in Firestore!");
      onUpdate();
    } catch (err) {
      setErrorMessage("Failed to save allocation letter template to Firestore.");
      handleFirestoreError(err, OperationType.UPDATE, "settings/allocation_letter_template");
    } finally {
      setAllocSaving(false);
    }
  };
  
  // User Management states
  const [userDeleteId, setUserDeleteId] = useState<string | null>(null);
  const [assignedRoles, setAssignedRoles] = useState<Record<string, UserRole>>({});
  
  // Delete confirm states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Create track states
  const [trackName, setTrackName] = useState("");
  const [trackDesc, setTrackDesc] = useState("");
  const [rawSubTypes, setRawSubTypes] = useState("");
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([
    { slug: "section_block", label: "Section / Block Name", type: "text", required: true }
  ]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Handle adding an attribute field
  const handleAddAttribute = () => {
    setAttributes(prev => [
      ...prev,
      { slug: "", label: "", type: "text", required: false }
    ]);
  };

  // Handle removing an attribute field
  const handleRemoveAttribute = (idx: number) => {
    setAttributes(prev => prev.filter((_, i) => i !== idx));
  };

  // Handle updating attribute values
  const handleUpdateAttribute = (idx: number, field: keyof AttributeDefinition, value: any) => {
    setAttributes(prev => {
      const updated = [...prev];
      if (field === "slug") {
        // Slugify output
        updated[idx].slug = String(value)
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_")
          .substring(0, 32);
      } else {
        (updated[idx] as any)[field] = value;
      }
      return updated;
    });
  };

  // Submit new Category track to Firestore
  const handleSaveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setMessage("");

    if (!trackName.trim()) {
      setErrorMessage("Track Name is required.");
      return;
    }

    const subTypesArray = rawSubTypes
      .split(",")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (subTypesArray.length === 0) {
      setErrorMessage("At least one Sub-type variant is required (e.g. Store, Shed).");
      return;
    }

    // Validate attributes
    for (const attr of attributes) {
      if (!attr.label.trim() || !attr.slug.trim()) {
        setErrorMessage("Please complete all Attribute labels and unique slugs.");
        return;
      }
    }

    setSaving(true);
    // When editing an existing track, keep writing to its original document
    // ID even if the name (and therefore the slug derived from it) changed
    // — otherwise a rename silently creates a brand-new document at the
    // new slug and orphans the old one, along with every asset/application
    // still referencing the original categoryId.
    const categoryId = editingCategoryId || trackName.toLowerCase().replace(/[^a-z0-9]/g, "_").trim();

    const newCategory: Category = {
      id: categoryId,
      name: trackName.trim(),
      description: trackDesc.trim(),
      subTypes: subTypesArray,
      attributes,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "categories", categoryId), newCategory);
      setSaving(false);
      setMessage(editingCategoryId ? `Successfully updated category track "${trackName}"!` : `Successfully created category track "${trackName}"!`);
      
      // Reset forms
      setTrackName("");
      setTrackDesc("");
      setRawSubTypes("");
      setAttributes([{ slug: "section_block", label: "Section / Block Name", type: "text", required: true }]);
      setEditingCategoryId(null);
      setActiveTab("LIST");
      onUpdate();
    } catch (err) {
      setSaving(false);
      setErrorMessage(editingCategoryId ? "Failed to update dynamic category track in cloud database." : "Failed to write dynamic category track to cloud database.");
      handleFirestoreError(err, editingCategoryId ? OperationType.UPDATE : OperationType.CREATE, `categories/${categoryId}`);
    }
  };

  // Start Edit Category Track
  const handleStartEdit = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setTrackName(cat.name);
    setTrackDesc(cat.description || "");
    setRawSubTypes(cat.subTypes.join(", "));
    setAttributes(cat.attributes || []);
    setActiveTab("EDIT");
    setErrorMessage("");
    setMessage("");
  };

  // Delete Category Track (Trigger overlay)
  const handleDeleteCategory = (catId: string, name: string) => {
    setDeleteConfirmId(catId);
    setDeleteConfirmName(name);
  };

  // Perform actual deletion
  const executeDeleteCategory = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    setErrorMessage("");
    setMessage("");
    try {
      await deleteDoc(doc(db, "categories", deleteConfirmId));
      setIsDeleting(false);
      onUpdate();
      setMessage(`Successfully deleted category track "${deleteConfirmName}".`);
      setDeleteConfirmId(null);
      setDeleteConfirmName("");
    } catch (err) {
      setIsDeleting(false);
      setErrorMessage(`Failed to delete category track "${deleteConfirmName}".`);
      handleFirestoreError(err, OperationType.DELETE, `categories/${deleteConfirmId}`);
      setDeleteConfirmId(null);
      setDeleteConfirmName("");
    }
  };

  // Approve and activate a pending user. Profiles are keyed by the staff
  // member's own Firebase Auth UID (required by firestore.rules — a Super
  // Admin cannot create a profile on someone else's behalf, only approve
  // one that person has already self-registered).
  const handleApproveUser = async (user: PortalUser, role: UserRole) => {
    setErrorMessage("");
    setMessage("");

    if (!user.uid) {
      setErrorMessage("Could not locate the account UID for this registration.");
      return;
    }

    try {
      const updatedUser: PortalUser = {
        ...user,
        role: role,
        status: "ACTIVE"
      };
      await setDoc(doc(db, "users", user.uid), updatedUser);
      setMessage(`Successfully approved and activated account for "${user.name}" as ${role.replace("_", " ")}!`);
      onUpdate();
    } catch (err) {
      setErrorMessage("Failed to activate user account.");
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  // Reject/Delete a pending user
  const handleRejectUser = async (user: PortalUser) => {
    setErrorMessage("");
    setMessage("");
    if (!user.uid) {
      setErrorMessage("Could not locate the account UID for this registration.");
      return;
    }
    try {
      await deleteDoc(doc(db, "users", user.uid));
      setMessage(`Registration request for "${user.email}" was rejected and removed.`);
      onUpdate();
    } catch (err) {
      setErrorMessage("Failed to reject registration request.");
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}`);
    }
  };

  // Delete User Role from Firestore
  const handleDeleteUser = async (user: PortalUser) => {
    if (user.email.toLowerCase() === "edwinaikins@gmail.com") {
      setErrorMessage("Cannot delete the core administrator account.");
      return;
    }
    if (!user.uid) {
      setErrorMessage("Could not locate the account UID for this staff user.");
      return;
    }

    setErrorMessage("");
    setMessage("");

    try {
      await deleteDoc(doc(db, "users", user.uid));
      setMessage(`Successfully removed staff user "${user.email}".`);
      onUpdate();
    } catch (err) {
      setErrorMessage(`Failed to delete user: ${user.email}`);
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}`);
    }
  };

  // Agreement Template handlers
  const handleUpdateTerm = (idx: number, val: string) => {
    setTemplateTermsList(prev => {
      const updated = [...prev];
      updated[idx] = val;
      return updated;
    });
  };

  const handleAddTerm = () => {
    setTemplateTermsList(prev => [...prev, ""]);
  };

  const handleRemoveTerm = (idx: number) => {
    setTemplateTermsList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveAgreementTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setMessage("");
    
    if (!templateLessorTitle.trim() || !templateOfficeTitle.trim() || !templateBoxAddress.trim()) {
      setErrorMessage("Lessor Title, Office Title, and Box Address are required.");
      return;
    }

    setTemplateSaving(true);
    try {
      const templateDocRef = doc(db, "settings", "agreement_template");
      const updatedTemplate: Setting = {
        id: "agreement_template",
        lessorTitle: templateLessorTitle.trim(),
        officeTitle: templateOfficeTitle.trim(),
        boxAddress: templateBoxAddress.trim(),
        lessorDesc: templateLessorDesc.trim(),
        recitals: templateRecitals.trim(),
        termsList: templateTermsList.map(t => t.trim()).filter(t => t.length > 0),
        witnessStatement: templateWitnessStatement.trim(),
        statutoryText: templateStatutoryText.trim()
      };
      
      await setDoc(templateDocRef, updatedTemplate);
      setMessage("Indenture Tenancy Agreement template updated successfully in dynamic cloud ledger!");
    } catch (err: any) {
      setErrorMessage("Failed to save agreement template. Please check database permissions.");
      handleFirestoreError(err, OperationType.UPDATE, "settings/agreement_template");
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleResetAgreementTemplate = () => {
    setTemplateLessorTitle(DEFAULT_AGREEMENT_TEMPLATE.lessorTitle);
    setTemplateOfficeTitle(DEFAULT_AGREEMENT_TEMPLATE.officeTitle);
    setTemplateBoxAddress(DEFAULT_AGREEMENT_TEMPLATE.boxAddress);
    setTemplateLessorDesc(DEFAULT_AGREEMENT_TEMPLATE.lessorDesc);
    setTemplateRecitals(DEFAULT_AGREEMENT_TEMPLATE.recitals);
    setTemplateTermsList(DEFAULT_AGREEMENT_TEMPLATE.termsList);
    setTemplateWitnessStatement(DEFAULT_AGREEMENT_TEMPLATE.witnessStatement);
    setTemplateStatutoryText(DEFAULT_AGREEMENT_TEMPLATE.statutoryText);
    setMessage("Agreement template draft reset to standard corrected default. Click 'Save' to finalize in database!");
    setErrorMessage("");
  };

  const handleGlobalLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 250 * 1024) {
      setErrorMessage("Logo size should be under 250KB for cloud ledger synchronization.");
      return;
    }

    setGlobalLogoUploading(true);
    setErrorMessage("");
    setMessage("");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64String = event.target?.result as string;
        const logoDocRef = doc(db, "settings", "global_logo");
        await setDoc(logoDocRef, {
          id: "global_logo",
          logoUrl: base64String,
          updatedAt: new Date().toISOString()
        });
        setMessage("Global Municipal Logo successfully updated in Firestore!");
      } catch (err: any) {
        setErrorMessage("Failed to upload and synchronize global logo to database.");
        handleFirestoreError(err, OperationType.UPDATE, "settings/global_logo");
      } finally {
        setGlobalLogoUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetGlobalLogo = async () => {
    setGlobalLogoUploading(true);
    setErrorMessage("");
    setMessage("");
    try {
      const logoDocRef = doc(db, "settings", "global_logo");
      await setDoc(logoDocRef, {
        id: "global_logo",
        logoUrl: "",
        updatedAt: new Date().toISOString()
      });
      setMessage("Global Municipal Logo reset to default vector seal.");
    } catch (err: any) {
      setErrorMessage("Failed to reset global logo to default vector seal.");
      handleFirestoreError(err, OperationType.UPDATE, "settings/global_logo");
    } finally {
      setGlobalLogoUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden" id="settings-admin-panel">
      {/* Settings Header */}
      <div className="bg-slate-900 text-white p-6 flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-900 rounded-xl">
            <Settings className="w-5 h-5 text-white animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight">IT Administration Panel</h3>
            <p className="text-slate-400 text-xs mt-0.5">Define property tracks, sub-types, and dynamic form configurations</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors"
        >
          Exit Settings
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-slate-50 px-6 py-2 border-b border-slate-100 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab("LIST");
            setEditingCategoryId(null);
            setErrorMessage("");
            setMessage("");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "LIST"
              ? "bg-indigo-900 text-white shadow-sm shadow-indigo-100"
              : "text-slate-600 hover:bg-slate-200/50"
          }`}
        >
          Active Property Tracks
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("CREATE");
            setEditingCategoryId(null);
            setTrackName("");
            setTrackDesc("");
            setRawSubTypes("");
            setAttributes([{ slug: "section_block", label: "Section / Block Name", type: "text", required: true }]);
            setErrorMessage("");
            setMessage("");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "CREATE" && !editingCategoryId
              ? "bg-indigo-900 text-white shadow-sm shadow-indigo-100"
              : "text-slate-600 hover:bg-slate-200/50"
          }`}
        >
          <Plus className="w-3.5 h-3.5" /> Create New Track
        </button>
        {editingCategoryId && (
          <button
            type="button"
            onClick={() => setActiveTab("EDIT")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "EDIT"
                ? "bg-indigo-900 text-white shadow-sm shadow-indigo-100"
                : "text-slate-600 hover:bg-slate-200/50"
            }`}
          >
            <Edit className="w-3.5 h-3.5" /> Edit Track ({trackName})
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setActiveTab("USERS");
            setEditingCategoryId(null);
            setErrorMessage("");
            setMessage("");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "USERS"
              ? "bg-indigo-950 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-200/50"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Staff Roles & Users
        </button>
        <button
          type="button"
          onClick={handleOpenAgreementTab}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "AGREEMENT"
              ? "bg-indigo-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-200/50"
          }`}
          id="agreement-template-tab-btn"
        >
          <FileText className="w-3.5 h-3.5 text-amber-500" /> Lease Indenture Template
        </button>
        <button
          type="button"
          onClick={handleOpenAllocationTab}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "ALLOCATION"
              ? "bg-indigo-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-200/50"
          }`}
          id="allocation-template-tab-btn"
        >
          <FileText className="w-3.5 h-3.5 text-emerald-500" /> Allocation Letter Template
        </button>
        <button
          type="button"
          onClick={handleOpenSmsTab}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "SMS"
              ? "bg-indigo-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-200/50"
          }`}
          id="sms-templates-tab-btn"
        >
          <Smartphone className="w-3.5 h-3.5 text-sky-500" /> SMS notification templates
        </button>
        <button
          type="button"
          onClick={handleOpenRatesTab}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "RENT_RATES"
              ? "bg-indigo-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-200/50"
          }`}
          id="rent-rates-tab-btn"
        >
          <Settings className="w-3.5 h-3.5 text-indigo-500" /> Central Rent Rates
        </button>
        <button
          type="button"
          onClick={handleOpenBillTemplateTab}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "BILL_TEMPLATE"
              ? "bg-indigo-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-200/50"
          }`}
          id="rent-bill-template-tab-btn"
        >
          <Printer className="w-3.5 h-3.5 text-indigo-500" /> Rent Bill Template
        </button>
        <button
          type="button"
          onClick={handleOpenGlobalSignatureTab}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "GLOBAL_SIGNATURE"
              ? "bg-indigo-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-200/50"
          }`}
          id="global-signature-tab-btn"
        >
          <PenTool className="w-3.5 h-3.5 text-amber-500" /> Global Authorized Signatory
        </button>
      </div>

      {/* Content area */}
      <div className="p-6">
        
        {errorMessage && (
          <div className="bg-red-50 text-red-800 border border-red-100 p-4 rounded-2xl text-xs mb-4 flex items-start gap-1.5">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {message && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-4 rounded-2xl text-xs mb-4 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* Tab: LIST OF TRACKS */}
        {activeTab === "LIST" && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs text-slate-500 flex gap-2 text-left">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <p>
                Dynamic EAV Model: Creating property tracks dynamically adds them to the live registry forms immediately. IT admins can create customizable categories without writing new code or modifying database tables.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map(cat => (
                <div 
                  key={cat.id} 
                  className="bg-white border border-slate-150 rounded-2xl p-5 hover:shadow-md transition-shadow relative flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{cat.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">ID: {cat.id}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(cat)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                          title="Edit Track"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="text-slate-300 hover:text-red-500 transition-colors p-1"
                          title="Delete Category"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{cat.description}</p>

                    <div className="mt-4 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Housing / Store variants</span>
                      <div className="flex flex-wrap gap-1">
                        {cat.subTypes.map(sub => (
                          <span key={sub} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-medium">
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Custom Attribute Fields ({cat.attributes.length})</span>
                    <div className="grid grid-cols-2 gap-2">
                      {cat.attributes.map(attr => (
                        <div key={attr.slug} className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded text-[10px] border border-slate-100">
                          <span className="text-slate-600 font-medium truncate max-w-[100px]" title={attr.label}>
                            {attr.label}
                          </span>
                          <span className="text-[8px] bg-indigo-50 text-indigo-700 px-1 rounded uppercase font-bold">
                            {attr.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: CREATE NEW TRACK */}
        {(activeTab === "CREATE" || activeTab === "EDIT") && (
          <form onSubmit={handleSaveTrack} className="space-y-6 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Track Category Name</label>
                <input
                  type="text"
                  required
                  disabled={!!editingCategoryId && (editingCategoryId === "market_stores" || editingCategoryId === "market_stores___shed" || editingCategoryId === "staff_bungalows" || editingCategoryId === "assembly_grounds")}
                  value={trackName}
                  onChange={e => setTrackName(e.target.value)}
                  placeholder="e.g. Lorry Park Spaces"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 disabled:bg-slate-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Space Variants (Comma-separated list)</label>
                <input
                  type="text"
                  required
                  value={rawSubTypes}
                  onChange={e => setRawSubTypes(e.target.value)}
                  placeholder="e.g. Standard Slot, VIP Lane, Cargo Zone"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">Track Description</label>
              <textarea
                value={trackDesc}
                onChange={e => setTrackDesc(e.target.value)}
                placeholder="Brief summary of category purposes..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 h-16 resize-none"
              />
            </div>

            {/* Custom Attributes creation area */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-650 animate-pulse" /> Define Custom Form Fields
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Attributes will render dynamically as custom fields during registration</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddAttribute}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Field
                </button>
              </div>

              <div className="space-y-3">
                {attributes.map((attr, idx) => (
                  <div 
                    key={idx} 
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-200/60 items-end"
                  >
                    {/* Attribute Field Label */}
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Field Label (UI name)</label>
                      <input
                        type="text"
                        required
                        value={attr.label}
                        onChange={e => handleUpdateAttribute(idx, "label", e.target.value)}
                        placeholder="e.g. Power Meter ID"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                      />
                    </div>

                    {/* Attribute Database Slug */}
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Database Slug (lowercase)</label>
                      <input
                        type="text"
                        required
                        value={attr.slug}
                        onChange={e => handleUpdateAttribute(idx, "slug", e.target.value)}
                        placeholder="e.g. power_meter_id"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none font-mono"
                      />
                    </div>

                    {/* Attribute Input Type */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Input Type</label>
                      <select
                        value={attr.type}
                        onChange={e => handleUpdateAttribute(idx, "type", e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                      >
                        <option value="text">Text Input</option>
                        <option value="number">Numeric</option>
                        <option value="select">Selection Dropdown</option>
                      </select>
                    </div>

                    {/* Extra Settings depending on type */}
                    <div className="md:col-span-3 space-y-1">
                      {attr.type === "select" ? (
                        <>
                          <label className="text-[10px] font-bold text-slate-500">Dropdown Options (Comma list)</label>
                          <input
                            type="text"
                            required
                            value={attr.options ? attr.options.join(", ") : ""}
                            onChange={e => handleUpdateAttribute(idx, "options", e.target.value.split(",").map(o => o.trim()))}
                            placeholder="e.g. Zone A, Zone B"
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                          />
                        </>
                      ) : (
                        <label className="flex items-center gap-1.5 py-2.5 select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={attr.required}
                            onChange={e => handleUpdateAttribute(idx, "required", e.target.checked)}
                          />
                          <span className="text-[11px] font-bold text-slate-500">Required Field</span>
                        </label>
                      )}
                    </div>

                    {/* Delete Attribute */}
                    <div className="md:col-span-1 text-center">
                      <button
                        type="button"
                        disabled={attributes.length === 1}
                        onClick={() => handleRemoveAttribute(idx)}
                        className="p-2 text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Buttons */}
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("LIST");
                  setEditingCategoryId(null);
                  setErrorMessage("");
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5 shadow-indigo-100"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : editingCategoryId ? "Save Changes" : "Save Custom Track"}
              </button>
            </div>
          </form>
        )}

        {/* Tab: STAFF ROLES & USERS */}
        {activeTab === "USERS" && (() => {
          const pendingUsers = users.filter(u => u.status === "PENDING");
          const activeUsers = users.filter(u => u.status === "ACTIVE" || !u.status);

          const getRoleBadgeStyle = (role: UserRole) => {
            switch (role) {
              case "SUPER_USER":
                return "bg-purple-50 text-purple-700 border-purple-200";
              case "REGISTRAR":
                return "bg-blue-50 text-blue-700 border-blue-200";
              case "LEASING_OFFICER":
                return "bg-amber-50 text-amber-700 border-amber-200";
              case "FINANCIAL_OFFICER":
                return "bg-emerald-50 text-emerald-700 border-emerald-200";
            }
          };

          const getRoleLabel = (role: UserRole) => {
            switch (role) {
              case "SUPER_USER":
                return "Super User";
              case "REGISTRAR":
                return "Registrar Clerk";
              case "LEASING_OFFICER":
                return "Leasing Officer";
              case "FINANCIAL_OFFICER":
                return "Treasury Cashier";
            }
          };

          return (
            <div className="space-y-6 text-left animate-fade-in">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs text-slate-500 flex gap-2">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-700">Role-Based Access Control (RBAC) & Activation Ledger</p>
                  <p className="mt-1 leading-relaxed">
                    Review and authorize registrations, assign functional municipality roles, and activate accounts. 
                    Users are authorized to perform actions matching their exact responsibilities: Registrar Clerk, Leasing Officer, or Treasury Cashier.
                  </p>
                </div>
              </div>

              {/* SECTION A: PENDING REVIEW */}
              <div className="bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden animate-pulse-slow">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-amber-50/40">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                      Pending Registration Requests ({pendingUsers.length})
                    </h4>
                  </div>
                  <span className="text-[9px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">Review Required</span>
                </div>

                {pendingUsers.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs font-medium">
                    No pending registration requests to review. New registrations will appear here in real-time.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pendingUsers.map(u => {
                      const currentAssignedRole = assignedRoles[u.email] || u.role;
                      return (
                        <div key={u.email} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-amber-50/10">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800">{u.name}</p>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{u.email}</p>
                            <p className="text-[10px] text-slate-500 mt-1">
                              Requested Role: <strong className="text-indigo-600 uppercase font-mono text-[9px] bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">{getRoleLabel(u.role)}</strong>
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Assign Final Role</label>
                              <select
                                value={currentAssignedRole}
                                onChange={e => setAssignedRoles(prev => ({ ...prev, [u.email]: e.target.value as UserRole }))}
                                className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10"
                              >
                                <option value="REGISTRAR">Registrar Clerk</option>
                                <option value="LEASING_OFFICER">Leasing Officer</option>
                                <option value="FINANCIAL_OFFICER">Treasury Cashier</option>
                                <option value="SUPER_USER">Super User</option>
                              </select>
                            </div>

                            <div className="flex items-center gap-2 pt-4 md:pt-0">
                              <button
                                type="button"
                                onClick={() => handleApproveUser(u, currentAssignedRole)}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow shadow-emerald-100 transition-colors"
                              >
                                Approve & Activate
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectUser(u)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-colors border border-rose-200/50"
                              >
                                Reject Request
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION B: ACTIVE ROLES */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* How staff get added */}
                <div className="lg:col-span-5 bg-white border border-slate-150 p-5 rounded-2xl space-y-3 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                    <User className="w-4 h-4 text-indigo-700" />
                    How Staff Accounts Are Added
                  </h4>
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-[11px] text-slate-500 flex gap-2">
                    <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Staff can no longer be pre-provisioned from this panel — for security, every account must be created by the staff member themselves via the login screen's "Register" or "Sign in with Google" option first. It will then appear above under <strong>Pending Registration Requests</strong>, where you approve it, assign its final role, and activate it.
                    </p>
                  </div>
                </div>

                {/* Users List */}
                <div className="lg:col-span-7 bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Authorized Active Staff ({activeUsers.length})
                    </h4>
                    <span className="text-[9px] text-slate-400 font-mono">Live Sync</span>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                    {activeUsers.map(u => {
                      const isCoreAdmin = u.email.toLowerCase() === "edwinaikins@gmail.com";

                      return (
                        <div key={u.email} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{u.name}</p>
                            <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">{u.email}</p>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            {isCoreAdmin ? (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getRoleBadgeStyle(u.role)}`}>
                                {getRoleLabel(u.role)}
                              </span>
                            ) : (
                              <select
                                value={u.role}
                                onChange={async (e) => {
                                  const newRole = e.target.value as UserRole;
                                  if (!u.uid) {
                                    setErrorMessage("Could not locate the account UID for this staff user.");
                                    return;
                                  }
                                  try {
                                    await setDoc(doc(db, "users", u.uid), { ...u, role: newRole });
                                    setMessage(`Successfully updated role of ${u.name} to ${getRoleLabel(newRole)}.`);
                                    onUpdate();
                                  } catch (err) {
                                    setErrorMessage("Failed to update user role.");
                                  }
                                }}
                                className="px-2 py-0.5 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 outline-none bg-white focus:border-indigo-500"
                              >
                                <option value="REGISTRAR">Registrar Clerk</option>
                                <option value="LEASING_OFFICER">Leasing Officer</option>
                                <option value="FINANCIAL_OFFICER">Treasury Cashier</option>
                                <option value="SUPER_USER">Super User</option>
                              </select>
                            )}

                            <button
                              type="button"
                              disabled={isCoreAdmin}
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-all disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-300"
                              title={isCoreAdmin ? "Cannot delete core admin account" : "Remove Staff Account"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {activeTab === "AGREEMENT" && (
          <form onSubmit={handleSaveAgreementTemplate} className="space-y-6 text-left animate-fade-in" id="agreement-template-editor-form">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs text-slate-500 flex gap-2 text-left mb-4">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-700">Dynamic Tenancy Indenture Template Builder</p>
                <p className="mt-0.5">
                  Customize the legal language, terms, and authority seals of the Indenture Tenancy Agreement. You can use dynamic brackets like <code className="bg-slate-200 px-1 rounded font-mono text-indigo-600 font-bold">[DURATION]</code>, <code className="bg-slate-200 px-1 rounded font-mono text-indigo-600 font-bold">[START_DATE]</code>, <code className="bg-slate-200 px-1 rounded font-mono text-indigo-600 font-bold">[COMBINED_RENT]</code>, <code className="bg-slate-200 px-1 rounded font-mono text-indigo-600 font-bold">[YEARLY_RENT]</code>, and <code className="bg-slate-200 px-1 rounded font-mono text-indigo-600 font-bold">[CATEGORY]</code> which will be replaced automatically with real allocation data when printing!
                </p>
              </div>
            </div>

            {/* Global Municipal Logo Upload Block */}
            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4 mb-4" id="global-logo-uploader-card">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Upload className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Global Municipal Assembly Logo & Seal
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                Upload your official municipal logo or seal here. This uploaded logo will automatically sync to all printable indenture templates, allocation letters, invoice bills, the staff portal dashboard, and the main login page!
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
                <div className="shrink-0 bg-slate-50 p-2.5 rounded-2xl border border-slate-150 flex items-center justify-center relative w-20 h-20">
                  <MunicipalLogo size={60} />
                </div>
                
                <div className="space-y-2 text-left flex-1 w-full">
                  <div className="flex flex-wrap gap-2">
                    <label className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-850 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-all shadow-sm active:scale-95 inline-flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      {globalLogoUploading ? "Uploading Seal..." : "Upload Logo Image"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleGlobalLogoUpload}
                        disabled={globalLogoUploading}
                        className="hidden"
                      />
                    </label>
                    {globalLogoUrl && (
                      <button
                        type="button"
                        onClick={handleResetGlobalLogo}
                        disabled={globalLogoUploading}
                        className="px-3 py-1.5 border border-red-250 hover:bg-red-50 text-red-600 text-[10px] font-bold rounded-lg transition-all active:scale-95"
                      >
                        Reset to Vector Seal
                      </button>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-400 font-mono">
                    Supports high-contrast transparent PNG, JPEG, or SVG up to 250KB.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-xs">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Lessor Official Title</label>
                <input
                  type="text"
                  required
                  value={templateLessorTitle}
                  onChange={e => setTemplateLessorTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500 font-semibold"
                />
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Signing Authority / Office Title</label>
                <input
                  type="text"
                  required
                  value={templateOfficeTitle}
                  onChange={e => setTemplateOfficeTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500 font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Lessor Address / Box Details</label>
              <input
                type="text"
                required
                value={templateBoxAddress}
                onChange={e => setTemplateBoxAddress(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Lessor Indenture Introduction (Parties Clause)</label>
              <textarea
                rows={3}
                required
                value={templateLessorDesc}
                onChange={e => setTemplateLessorDesc(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500 resize-y"
              />
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Legal Recitals Opening (WHEREAS Clause)</label>
              <textarea
                rows={3}
                required
                value={templateRecitals}
                onChange={e => setTemplateRecitals(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500 resize-y"
              />
            </div>

            {/* Dynamic Terms List */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Covenants & Tenancy Rules ({templateTermsList.length})
                </h4>
                <button
                  type="button"
                  onClick={handleAddTerm}
                  className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Rule Clause
                </button>
              </div>

              <div className="space-y-3">
                {templateTermsList.map((term, idx) => (
                  <div key={idx} className="flex gap-2.5 items-start">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px] shrink-0 mt-2">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <textarea
                        rows={2}
                        required
                        value={term}
                        onChange={e => handleUpdateTerm(idx, e.target.value)}
                        placeholder={`Rule clause ${idx + 1}...`}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500 resize-y"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTerm(idx)}
                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-xl shrink-0 mt-2 transition-colors"
                      title="Remove Clause"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {templateTermsList.length === 0 && (
                  <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                    No customized tenancy rule clauses defined. Click 'Add Rule Clause' above to build dynamic covenants!
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Closing Witness Statement (IN WITNESS WHEREOF Clause)</label>
              <textarea
                rows={2}
                required
                value={templateWitnessStatement}
                onChange={e => setTemplateWitnessStatement(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500 resize-y"
              />
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Footer Statutory Authority / Act Marks</label>
              <input
                type="text"
                required
                value={templateStatutoryText}
                onChange={e => setTemplateStatutoryText(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleResetAgreementTemplate}
                className="px-4 py-2.5 border border-slate-250 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all active:scale-95"
              >
                Reset to Standard Default
              </button>
              <button
                type="submit"
                disabled={templateSaving}
                className="px-5 py-2.5 bg-indigo-900 hover:bg-indigo-850 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {templateSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Saving Template Ledger...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Agreement Template</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {activeTab === "SMS" && (
          <form onSubmit={handleSaveSmsTemplates} className="space-y-6 text-left animate-fade-in" id="sms-templates-editor-form">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs text-slate-500 flex gap-2 text-left mb-4">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-700">Dynamic SMS Notification Customizer</p>
                <p className="mt-0.5">
                  Customize the SMS notification content dispatched upon key applicant lifecycle triggers. You can use dynamic bracket placeholders like <code className="bg-slate-200 px-1 rounded font-mono text-indigo-600 font-bold">{"{firstName}"}</code> or <code className="bg-slate-200 px-1 rounded font-mono text-indigo-600 font-bold">{"{assetCode}"}</code> which are replaced automatically!
                </p>
                <p className="mt-1.5 font-bold text-indigo-700">
                  💡 Note: The system automatically customizes terminology ("Market Store or Shed" or "Bungalow") based on the applicant's track category!
                </p>
              </div>
            </div>

            {/* Registration SMS Template */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-sky-500" />
                  Applicant Registration Notification Template
                </h4>
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">
                  Trigger: registration save
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Message Text</label>
                <textarea
                  rows={3}
                  required
                  value={smsRegTemplate}
                  onChange={e => setSmsRegTemplate(e.target.value)}
                  placeholder="Dear {firstName}, you have successfully registered... ID: {id}."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500 resize-y"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Allowed Placeholders:</span>
                  <code className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{"{firstName}"}</code>
                  <code className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{"{id}"}</code>
                </div>
              </div>
            </div>

            {/* Allocation SMS Template */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                  Space Allocation Notification Template
                </h4>
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">
                  Trigger: asset assignment
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Message Text</label>
                <textarea
                  rows={3}
                  required
                  value={smsAllocTemplate}
                  onChange={e => setSmsAllocTemplate(e.target.value)}
                  placeholder="Dear {firstName}, a space has been successfully allocated... Code: {assetCode}."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500 resize-y"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Allowed Placeholders:</span>
                  <code className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{"{firstName}"}</code>
                  <code className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{"{assetCode}"}</code>
                </div>
              </div>
            </div>

            {/* Payment SMS Template */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-purple-500" />
                  Payment Installment Notification Template
                </h4>
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">
                  Trigger: installment payment
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Message Text</label>
                <textarea
                  rows={3}
                  required
                  value={smsPayTemplate}
                  onChange={e => setSmsPayTemplate(e.target.value)}
                  placeholder="Dear {firstName}, payment received of {amountPaid} GHS... Receipt: {manualReceiptNo}."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500 resize-y"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Allowed Placeholders:</span>
                  <code className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{"{firstName}"}</code>
                  <code className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{"{amountPaid}"}</code>
                  <code className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{"{manualReceiptNo}"}</code>
                  <code className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{"{assetCode}"}</code>
                  <code className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{"{remainingBalance}"}</code>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={smsSaving}
                className="px-5 py-2.5 bg-indigo-900 hover:bg-indigo-850 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {smsSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Saving SMS Template Ledger...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save SMS Templates</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {activeTab === "ALLOCATION" && (
          <form onSubmit={handleSaveAllocationTemplate} className="space-y-6 text-left animate-fade-in" id="allocation-letter-editor-form">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs text-slate-500 flex gap-2 text-left mb-4">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-700">Allocation Letter Template Customizer</p>
                <p className="mt-0.5">
                  Design and configure the global blueprint template for official Allocation Letters issued to approved applicants. These values are synchronized instantly and used when generating the physical print-ready layout for applicants.
                </p>
              </div>
            </div>

            {/* Letter Header Section */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-4 shadow-sm">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                Official Letterhead details
              </h4>

              {/* Logo Upload Interface */}
              <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Official Letterhead Logo</span>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {allocLogoUrl ? (
                    <div className="relative border border-slate-200 p-2 rounded-xl bg-white shrink-0 shadow-sm">
                      <img 
                        src={allocLogoUrl} 
                        alt="Custom Logo Preview" 
                        className="h-16 w-auto object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => setAllocLogoUrl("")}
                        className="absolute -top-1.5 -right-1.5 bg-red-100 text-red-600 p-1.5 rounded-full hover:bg-red-200 transition-colors shadow-sm"
                        title="Remove custom logo (revert to National Emblem)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 p-3 rounded-xl bg-white w-20 h-20 shrink-0">
                      <span className="text-[8px] font-extrabold text-slate-400 text-center uppercase tracking-wider">Default SVG Emblem</span>
                    </div>
                  )}

                  <div className="flex-1 text-center sm:text-left space-y-2">
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Upload a customized emblem or assembly logo. If empty, the system defaults to rendering the formal NAMA/National Emblem vector seal automatically.
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-[10px] font-bold text-slate-700 rounded-lg cursor-pointer transition-colors shadow-sm inline-block">
                        <span>Select Logo File</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleLogoUpload} 
                          className="hidden" 
                        />
                      </label>
                      {allocLogoUrl && (
                        <button
                          type="button"
                          onClick={() => setAllocLogoUrl("")}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-[10px] font-bold text-red-600 rounded-lg transition-colors border border-red-100"
                        >
                          Reset to Default
                        </button>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-400 block font-mono">Accepts PNG/JPG under 250KB for cloud ledger space optimization.</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 text-xs">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Primary Title (Assembly Name)</label>
                  <input
                    type="text"
                    required
                    value={allocTitle}
                    onChange={e => setAllocTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500"
                    placeholder="e.g. NSAWAM ADOAGYIRI MUNICIPAL ASSEMBLY"
                  />
                </div>
                <div className="space-y-1.5 text-xs">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Secondary Sub-title (Office/Department)</label>
                  <input
                    type="text"
                    required
                    value={allocSubTitle}
                    onChange={e => setAllocSubTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500"
                    placeholder="e.g. OFFICE OF THE MUNICIPAL ASSEMBLY"
                  />
                </div>
                <div className="space-y-1.5 text-xs md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Contact Address & Box Location</label>
                  <input
                    type="text"
                    required
                    value={allocBoxAddress}
                    onChange={e => setAllocBoxAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500"
                    placeholder="e.g. P.O. BOX 45, NSAWAM, EASTERN REGION, GHANA"
                  />
                </div>
              </div>
            </div>

            {/* Subject and Salutation */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-4 shadow-sm">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                Subject & Salutation
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 text-xs md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Letter Subject</label>
                  <input
                    type="text"
                    required
                    value={allocLetterSubject}
                    onChange={e => setAllocLetterSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500 font-bold"
                    placeholder="e.g. LETTER OF ALLOCATION OF MUNICIPAL PHYSICAL ASSET"
                  />
                </div>
                <div className="space-y-1.5 text-xs col-span-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Salutation</label>
                  <input
                    type="text"
                    required
                    value={allocSalutation}
                    onChange={e => setAllocSalutation(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500"
                    placeholder="e.g. Dear Sir/Madam,"
                  />
                </div>
              </div>
            </div>

            {/* Letter Body Text */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-4 shadow-sm">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                Letter Body & Paragraphs
              </h4>
              <div className="space-y-4">
                <div className="space-y-1.5 text-xs">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">First Paragraph (Approval/Introduction)</label>
                  <textarea
                    rows={3}
                    required
                    value={allocIntroduction}
                    onChange={e => setAllocIntroduction(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500 resize-y"
                    placeholder="Write first introductory paragraph..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-xs">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Asset Details Section Header</label>
                    <input
                      type="text"
                      required
                      value={allocDetailsIntro}
                      onChange={e => setAllocDetailsIntro(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Conditions Intro Phrase</label>
                    <input
                      type="text"
                      required
                      value={allocConditionsIntro}
                      onChange={e => setAllocConditionsIntro(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Conditions list section */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-4 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Allocation Conditions & Regulations
                </h4>
                <button
                  type="button"
                  onClick={() => setAllocConditionsList([...allocConditionsList, ""])}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3 h-3" /> Add Condition
                </button>
              </div>
              <div className="space-y-3">
                {allocConditionsList.map((condition, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <span className="font-mono text-xs text-slate-400 mt-2.5 w-4 shrink-0">{idx + 1}.</span>
                    <textarea
                      rows={2}
                      value={condition}
                      onChange={(e) => {
                        const updated = [...allocConditionsList];
                        updated[idx] = e.target.value;
                        setAllocConditionsList(updated);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500 resize-none"
                      placeholder={`Enter condition description ${idx + 1}...`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setAllocConditionsList(allocConditionsList.filter((_, i) => i !== idx));
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors mt-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {allocConditionsList.length === 0 && (
                  <p className="text-slate-400 text-xs italic">No conditions added. Click "Add Condition" above.</p>
                )}
              </div>
            </div>

            {/* Instructions & Concluding Remarks */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-4 shadow-sm">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                Instructions & Conclusion
              </h4>
              <div className="space-y-4">
                <div className="space-y-1.5 text-xs">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Instructions (Stage 3 Procedure)</label>
                  <textarea
                    rows={2}
                    required
                    value={allocInstructions}
                    onChange={e => setAllocInstructions(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500 resize-y"
                    placeholder="Instruct applicant how to proceed to signing stage..."
                  />
                </div>
                <div className="space-y-1.5 text-xs">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Concluding Remarks</label>
                  <input
                    type="text"
                    required
                    value={allocConcludingRemarks}
                    onChange={e => setAllocConcludingRemarks(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:border-indigo-500"
                    placeholder="Concluding greeting..."
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={allocSaving}
                className="px-5 py-2.5 bg-indigo-900 hover:bg-indigo-850 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {allocSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Saving Allocation Template...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Allocation Template</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Central Rent Rates Tab */}
        {activeTab === "RENT_RATES" && (
          <form onSubmit={handleSaveRentRates} className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm space-y-5 text-left animate-slide-up" id="rent-rates-settings-form">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Settings className="w-4.5 h-4.5 text-indigo-900" /> Central Rent Rates Setup
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal font-sans">
                Set a central point to update standard monthly rent rates for all Store, Shed, and Assembly Grounds spaces across the entire municipality. Allocations, billing cycles, and agreement documents will reference these values.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Store Monthly Rent (GHS)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
                    value={storeRentValue}
                    onChange={e => setStoreRentValue(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold font-sans outline-none transition-all placeholder:text-slate-400"
                    placeholder="e.g. 150"
                  />
                  <div className="absolute right-3 top-2.5 text-[10px] font-mono text-slate-400 font-bold">GHS / mo</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Shed Monthly Rent (GHS)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
                    value={shedRentValue}
                    onChange={e => setShedRentValue(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold font-sans outline-none transition-all placeholder:text-slate-400"
                    placeholder="e.g. 80"
                  />
                  <div className="absolute right-3 top-2.5 text-[10px] font-mono text-slate-400 font-bold">GHS / mo</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Grounds Space Rent (GHS)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
                    value={groundsRentValue}
                    onChange={e => setGroundsRentValue(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold font-sans outline-none transition-all placeholder:text-slate-400"
                    placeholder="e.g. 100"
                  />
                  <div className="absolute right-3 top-2.5 text-[10px] font-mono text-slate-400 font-bold">GHS / mo</div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={ratesSaving}
                className="px-5 py-2.5 bg-indigo-900 hover:bg-indigo-850 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {ratesSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Saving Rent Rates...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Rent Rates</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Rent Bill Template Tab */}
        {activeTab === "BILL_TEMPLATE" && (
          <form onSubmit={handleSaveRentBillTemplate} className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm space-y-5 text-left animate-slide-up" id="rent-bill-template-settings-form">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Printer className="w-4.5 h-4.5 text-indigo-900" /> Rent Demand Notice Bill Template
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal font-sans">
                Customize the layout, header titles, and billing conditions printed on the official Rent Bill & Demand Notices. You can upload a custom municipal or department logo to replace the default icon.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left 2 columns: Form fields */}
              <div className="md:col-span-2 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Assembly / Municipal Title</label>
                  <input
                    type="text"
                    required
                    value={billTitle}
                    onChange={e => setBillTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold font-sans outline-none transition-all placeholder:text-slate-400"
                    placeholder="e.g. Nsawam Adoagyiri Municipal Assembly"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Department / Directorate Sub-header</label>
                  <input
                    type="text"
                    required
                    value={billSubTitle}
                    onChange={e => setBillSubTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold font-sans outline-none transition-all placeholder:text-slate-400"
                    placeholder="e.g. Finance & Estate Management Department"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Official Box Address & Contact Details</label>
                  <input
                    type="text"
                    required
                    value={billBoxAddress}
                    onChange={e => setBillBoxAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold font-sans outline-none transition-all placeholder:text-slate-400"
                    placeholder="e.g. P.O. BOX 45, NSAWAM, EASTERN REGION, GHANA"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Payment Instructions & Guidelines</label>
                  <textarea
                    rows={6}
                    required
                    value={billPaymentGuidelines}
                    onChange={e => setBillPaymentGuidelines(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold font-sans outline-none transition-all placeholder:text-slate-400"
                    placeholder="Provide detailed instructions on how the citizen should pay their annual lease bill..."
                  />
                  <p className="text-[9px] text-slate-400">These guidelines will appear inside the printed bill's bottom terms panel.</p>
                </div>
              </div>

              {/* Right column: Logo Upload & Customization */}
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 border border-slate-150 rounded-2xl flex flex-col items-center text-center space-y-4">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Official Logo</span>
                  
                  <div className="w-24 h-24 border border-dashed border-slate-300 rounded-2xl bg-white flex items-center justify-center relative overflow-hidden group">
                    {billLogoUrl ? (
                      <>
                        <img src={billLogoUrl} alt="Bill Custom Logo" className="max-w-full max-h-full object-contain p-2" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => setBillLogoUrl("")}
                          className="absolute inset-0 bg-red-600/95 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
                        >
                          Remove Logo
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-semibold px-2">No custom logo</span>
                    )}
                  </div>

                  <div className="w-full">
                    <label className="block">
                      <span className="sr-only">Choose logo file</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBillLogoUpload}
                        className="block w-full text-[10px] text-slate-500
                          file:mr-2 file:py-1.5 file:px-3
                          file:rounded-xl file:border-0
                          file:text-[10px] file:font-bold
                          file:bg-indigo-50 file:text-indigo-700
                          hover:file:bg-indigo-100
                          cursor-pointer"
                      />
                    </label>
                    <p className="text-[9px] text-slate-400 mt-2">Max size: 250KB. PNG, JPG or SVG format.</p>
                  </div>
                </div>

                {/* Print Preview Sample */}
                <div className="p-4 border border-indigo-100 bg-indigo-50/30 rounded-2xl space-y-2 text-slate-600">
                  <h4 className="text-[10px] font-extrabold text-indigo-900 uppercase">Interactive Template Editor</h4>
                  <p className="text-[10px] leading-relaxed">
                    Changes made here sync across the secure ledger immediately. Next time any officer prints a demand notice, this layout configuration will be dynamically applied.
                  </p>
                </div>

                {/* Global Signature Callout / Shortcut */}
                <div className="p-4 border border-amber-100 bg-amber-50/40 rounded-2xl space-y-2 text-slate-700 animate-pulse">
                  <h4 className="text-[10px] font-extrabold text-amber-900 uppercase flex items-center gap-1">✍️ Global Authorized Signatory</h4>
                  <p className="text-[10px] leading-relaxed text-slate-600">
                    Need to configure the central signatory officer identity and digital signature used on official bills, letters, and indenture agreements?
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenGlobalSignatureTab}
                    className="w-full mt-2 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-md active:scale-95"
                  >
                    <PenTool className="w-3.5 h-3.5" /> Configure Global Signature Now
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={billSaving}
                className="px-5 py-2.5 bg-indigo-900 hover:bg-indigo-850 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {billSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Saving Rent Bill Template...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Rent Bill Template</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {activeTab === "GLOBAL_SIGNATURE" && (
          <form onSubmit={handleSaveGlobalSignature} className="space-y-6 text-left animate-fade-in font-sans">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <PenTool className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">Global Authorized Signatory Settings</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Configure the central officer identity and authorized digital signature. This signature and name will be used across all official documents, including **Allocation Letters**, **Lease Indenture Agreements**, and **Rent Bill Demand Notices**.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Signatory Officer Name</label>
                  <input
                    type="text"
                    required
                    value={sigName}
                    onChange={(e) => setSigName(e.target.value)}
                    className="w-full px-4 py-2 text-xs border border-slate-250 rounded-xl focus:ring-1 focus:ring-indigo-550 focus:border-indigo-550 focus:outline-none bg-white text-slate-800"
                    placeholder="e.g. Mr. Jasper Adenyo"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Official Title / Designation</label>
                  <input
                    type="text"
                    required
                    value={sigTitle}
                    onChange={(e) => setSigTitle(e.target.value)}
                    className="w-full px-4 py-2 text-xs border border-slate-250 rounded-xl focus:ring-1 focus:ring-indigo-550 focus:border-indigo-550 focus:outline-none bg-white text-slate-800"
                    placeholder="e.g. Municipal Coordinating Director"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Central Authorized Signature</label>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <SignaturePad
                    label="Draw or Upload Authorized Digital Signature"
                    placeholderText="Sign inside this box or upload a signature file"
                    initialValue={sigImg}
                    onSave={(dataUrl) => setSigImg(dataUrl)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-xl transition-colors active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sigSaving}
                className="px-5 py-2.5 bg-indigo-900 hover:bg-indigo-850 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {sigSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Saving Settings...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Global Signatory Settings</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>

      {/* Category Deletion Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" id="delete-category-modal">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-left space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-50 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold tracking-tight">Delete Property Track?</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete the category track <strong className="text-slate-800 font-semibold">"{deleteConfirmName}"</strong>? 
              Existing registrations under this track may experience schema disconnects and dynamic form field matching issues.
            </p>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[11px] text-amber-800 flex gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>This operation cannot be undone. Please ensure you have backed up any relevant on-site application data first.</span>
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteConfirmName("");
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeDeleteCategory}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow shadow-red-100 transition-colors"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
