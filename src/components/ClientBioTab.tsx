import React, { useState } from "react";
import { Application, Category, PortalUser } from "../types";
import { User, Building, PenTool, Check, X, Camera, Image, AlertCircle, Save } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";

interface ClientBioTabProps {
  application: Application;
  category: Category | undefined;
  currentUser: PortalUser | null;
  onUpdate: () => void;
}

const SIMULATED_PORTRAITS = [
  {
    name: "Kofi Mensah (Male Applicant)",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80"
  },
  {
    name: "Ama Serwaa (Female Applicant)",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"
  },
  {
    name: "Emmanuel Osei (Staff Applicant)",
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80"
  }
];

export default function ClientBioTab({ application, category, currentUser, onUpdate }: ClientBioTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing form states
  const [editFirstName, setEditFirstName] = useState("");
  const [editSurname, setEditSurname] = useState("");
  const [editGender, setEditGender] = useState<"Male" | "Female">("Male");
  const [editContactNumber, setEditContactNumber] = useState("");
  const [editGhanaCardNumber, setEditGhanaCardNumber] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editSubType, setEditSubType] = useState("");
  const [editAttributes, setEditAttributes] = useState<Record<string, any>>({});
  const [editPhoto, setEditPhoto] = useState<string>("");

  const handleStartEditing = () => {
    setEditFirstName(application.firstName || "");
    setEditSurname(application.surname || "");
    setEditGender(application.gender || "Male");
    setEditContactNumber(application.contactNumber || "");
    setEditGhanaCardNumber(application.ghanaCardNumber || "");
    setEditAddress(application.address || "");
    setEditSubType(application.subType || "");
    setEditAttributes(application.attributes || {});
    setEditPhoto(application.photo || "");
    setError(null);
    setIsEditing(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Firestore caps a whole document at ~1MB, and this base64-encoded
    // photo lives inline on the application document. Base64 inflates raw
    // size by ~33%, so the old 3MB limit would silently fail to save
    // around 700KB in — this cap keeps the encoded upload comfortably
    // under that ceiling.
    if (file.size > 650 * 1024) {
      setError("Photo file size exceeds 650KB. This photo is stored inline on the application record, which has a hard ~1MB Firestore limit — please use a smaller/compressed photo.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setEditPhoto(base64);
    };
    reader.onerror = () => {
      setError("Error reading the photo file.");
    };
    reader.readAsDataURL(file);
  };

  const handleAttributeChange = (slug: string, value: any) => {
    setEditAttributes(prev => ({
      ...prev,
      [slug]: value
    }));
  };

  const handleSave = async () => {
    setError(null);

    // Validation
    if (!editFirstName.trim() || !editSurname.trim()) {
      setError("Please enter both First Name and Surname.");
      return;
    }

    const cleanedContact = editContactNumber.replace(/\D/g, "");
    if (cleanedContact.length !== 10) {
      setError("Contact Number must be exactly 10 digits.");
      return;
    }

    const ghanaCardRegex = /^GHA-\d{9}-\d$/;
    if (!ghanaCardRegex.test(editGhanaCardNumber.trim().toUpperCase())) {
      setError("Ghana Card Number must match standard format: GHA-XXXXXXXXX-X (e.g. GHA-123456789-0).");
      return;
    }

    if (!editAddress.trim()) {
      setError("Please enter a valid address.");
      return;
    }

    setIsSaving(true);

    try {
      const appDocRef = doc(db, "applications", application.id);
      
      const payload: Partial<Application> = {
        firstName: editFirstName.trim(),
        surname: editSurname.trim(),
        gender: editGender,
        contactNumber: editContactNumber.trim(),
        ghanaCardNumber: editGhanaCardNumber.trim().toUpperCase(),
        address: editAddress.trim(),
        subType: editSubType,
        attributes: editAttributes,
        photo: editPhoto || undefined,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(appDocRef, payload);
      setIsSaving(false);
      setIsEditing(false);
      onUpdate();
    } catch (err: any) {
      setIsSaving(false);
      setError("Failed to save changes. Please check permissions or network.");
      handleFirestoreError(err, OperationType.UPDATE, `applications/${application.id}`);
    }
  };

  return (
    <div className="p-6 text-left animate-fade-in" id="client-bio-tab">
      
      {/* Header Controls for Editing */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-800">
            {isEditing ? "Modify Applicant Bio-Details" : "Applicant Bio-Credentials"}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {isEditing 
              ? "Update demographic info, portrait, or custom EAV track attributes." 
              : "Verifiable credentials and attributes assigned during registration."}
          </p>
        </div>
        
        {/* Toggle Edit Button */}
        {!isEditing ? (
          <button
            onClick={handleStartEditing}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            id="edit-bio-btn"
          >
            <PenTool className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit Bio Details</span>
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-all"
              disabled={isSaving}
              id="cancel-bio-btn"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-indigo-900 hover:bg-indigo-850 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5"
              disabled={isSaving}
              id="save-bio-btn"
            >
              {isSaving ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Error message banner */}
      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-center gap-2" id="bio-error-banner">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Photo & Primary Bio Data */}
        <div className="md:col-span-5 space-y-4">
          
          {/* Portrait Photo log */}
          <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex flex-col items-center">
            <div className="aspect-square w-full rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 shadow-inner relative group max-w-[240px] mx-auto">
              {editPhoto || (!isEditing && application.photo) ? (
                <img
                  src={isEditing ? editPhoto : application.photo}
                  referrerPolicy="no-referrer"
                  alt="Applicant Portrait"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${application.firstName}+${application.surname}`;
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 p-4 text-center">
                  <User className="w-16 h-16 stroke-1" />
                  <span className="text-xs font-semibold">No Image Logged</span>
                </div>
              )}
              <div className="absolute top-2 left-2 bg-slate-900/60 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full text-[10px] font-mono">
                PHOTO LOG
              </div>
            </div>

            {/* Editing Controls for Portrait */}
            {isEditing && (
              <div className="w-full mt-4 space-y-3 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600 flex items-center gap-1">
                    <Image className="w-3.5 h-3.5 text-indigo-900" /> Upload Image
                  </span>
                  <label className="cursor-pointer text-indigo-900 hover:text-indigo-850 font-bold">
                    Browse
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <span className="font-semibold text-slate-500 block">Or Select Simulated:</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SIMULATED_PORTRAITS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEditPhoto(p.url)}
                        className={`group relative rounded-lg overflow-hidden aspect-square border-2 transition-all ${
                          editPhoto === p.url ? "border-indigo-900 scale-95" : "border-transparent hover:border-slate-300"
                        }`}
                        title={p.name}
                      >
                        <img
                          src={p.url}
                          referrerPolicy="no-referrer"
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bio Data Card */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Bio Fields</h4>
            
            {!isEditing ? (
              // Display Mode
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-slate-200/40 pb-1.5">
                  <span className="text-slate-400 font-medium">Applicant Name</span>
                  <span className="text-slate-800 font-semibold">{application.firstName} {application.surname}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/40 pb-1.5">
                  <span className="text-slate-400 font-medium">Gender</span>
                  <span className="text-slate-800 font-semibold">{application.gender}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/40 pb-1.5">
                  <span className="text-slate-400 font-medium">Contact Number</span>
                  <span className="text-slate-800 font-semibold font-mono">{application.contactNumber || "N/A"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/40 pb-1.5">
                  <span className="text-slate-400 font-medium">Ghana Card No</span>
                  <span className="text-slate-800 font-mono font-semibold">{application.ghanaCardNumber}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/40 pb-1.5">
                  <span className="text-slate-400 font-medium">Residential Address</span>
                  <span className="text-slate-800 font-semibold text-right max-w-[60%] truncate">{application.address || "N/A"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/40 pb-1.5">
                  <span className="text-slate-400 font-medium">Track Category</span>
                  <span className="text-slate-800 font-semibold">{category?.name || "Dynamic Track"}</span>
                </div>
                <div className="flex justify-between pb-0.5">
                  <span className="text-slate-400 font-medium">Space Variant</span>
                  <span className="text-slate-800 font-semibold">{application.subType}</span>
                </div>
              </div>
            ) : (
              // Editing Mode
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">First Name</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={e => setEditFirstName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Surname</label>
                  <input
                    type="text"
                    value={editSurname}
                    onChange={e => setEditSurname(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Gender</label>
                    <select
                      value={editGender}
                      onChange={e => setEditGender(e.target.value as "Male" | "Female")}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 font-semibold outline-none focus:border-indigo-500"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Space Variant</label>
                    <select
                      value={editSubType}
                      onChange={e => setEditSubType(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 font-semibold outline-none focus:border-indigo-500"
                    >
                      {category?.subTypes.map(st => (
                        <option key={st} value={st}>{st}</option>
                      )) || <option value={editSubType}>{editSubType}</option>}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Contact Number</label>
                  <input
                    type="tel"
                    value={editContactNumber}
                    onChange={e => setEditContactNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 font-semibold outline-none focus:border-indigo-500"
                    placeholder="0XXXXXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Ghana Card Number</label>
                  <input
                    type="text"
                    value={editGhanaCardNumber}
                    onChange={e => setEditGhanaCardNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 font-semibold outline-none focus:border-indigo-500"
                    placeholder="GHA-123456789-0"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Residential/Business Address</label>
                  <textarea
                    rows={2}
                    value={editAddress}
                    onChange={e => setEditAddress(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Category-specific Dynamic Attributes */}
        <div className="md:col-span-7">
          <div className="bg-indigo-50/30 border border-indigo-100/60 p-5 rounded-2xl space-y-4 h-full">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
              <Building className="w-4 h-4 text-indigo-600" />
              <span>Track Dynamic Attributes</span>
            </h4>

            {category?.attributes && category.attributes.length > 0 ? (
              <div className="space-y-4">
                {category.attributes.map(attr => {
                  const val = isEditing ? editAttributes[attr.slug] : application.attributes?.[attr.slug];
                  
                  return (
                    <div key={attr.slug} className="space-y-1 text-xs">
                      <span className="text-slate-400 font-bold block capitalize">
                        {attr.label}
                        {attr.required && <span className="text-red-500 ml-0.5">*</span>}
                      </span>

                      {!isEditing ? (
                        // Display Mode Attribute
                        <div className="font-mono bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-slate-800 font-semibold flex justify-between items-center shadow-sm">
                          <span>{val !== undefined && val !== null ? String(val) : "Not Configured"}</span>
                          <span className="text-[9px] uppercase bg-slate-100 px-1.5 py-0.5 rounded text-slate-400">
                            {attr.type}
                          </span>
                        </div>
                      ) : (
                        // Editing Mode Attribute
                        <div className="relative">
                          {attr.type === "select" ? (
                            <select
                              value={val || ""}
                              onChange={e => handleAttributeChange(attr.slug, e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold outline-none focus:border-indigo-500"
                            >
                              <option value="">-- Select Option --</option>
                              {attr.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : attr.type === "number" ? (
                            <input
                              type="number"
                              value={val !== undefined ? val : ""}
                              onChange={e => handleAttributeChange(attr.slug, e.target.value === "" ? "" : Number(e.target.value))}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 font-semibold outline-none focus:border-indigo-500"
                            />
                          ) : (
                            <input
                              type="text"
                              value={val || ""}
                              onChange={e => handleAttributeChange(attr.slug, e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold outline-none focus:border-indigo-500"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center p-6 text-slate-400 text-xs">
                No custom EAV attributes configured for this category track.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
