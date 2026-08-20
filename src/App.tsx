import React, { useState, useEffect } from "react";
import { Category, Application, ApplicationStatus, Asset, PortalUser, UserRole, Setting, SmsLog, SmsTemplatesSetting, AllocationLetterSetting, RentRatesSetting, RentBillTemplateSetting, GlobalSignatureSetting } from "./types";
import { DEFAULT_SEED_CATEGORIES, DEFAULT_SEED_ASSETS, DEFAULT_AGREEMENT_TEMPLATE, DEFAULT_SMS_TEMPLATES, DEFAULT_ALLOCATION_LETTER_TEMPLATE, DEFAULT_RENT_RATES, DEFAULT_RENT_BILL_TEMPLATE, DEFAULT_GLOBAL_SIGNATURE, DEFAULT_SEED_APPLICATIONS } from "./data";
import OverviewDashboard from "./components/OverviewDashboard";
import MunicipalLogo from "./components/MunicipalLogo";
import RegistrationForm from "./components/RegistrationForm";
import SettingsPanel from "./components/SettingsPanel";
import ApplicationDetails from "./components/ApplicationDetails";
import AssetRegistry from "./components/AssetRegistry";
import { db, auth, handleFirestoreError, OperationType } from "./firebase";
import { collection, onSnapshot, query, doc, setDoc, orderBy } from "firebase/firestore";
import { 
  signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail 
} from "firebase/auth";
import { 
  Building2, ShieldAlert, Building, LogIn, CheckCircle,
  HelpCircle, Info, Landmark, HelpCircle as HelpIcon,
  Mail, Lock, User, UserPlus, ArrowLeft, RefreshCw, Eye, EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { setGlobalLogoUrl } from "./utils/logoState";

export default function App() {
  const [currentView, setCurrentView] = useState<"LOGIN" | "DASHBOARD" | "REGISTER" | "SETTINGS" | "DETAILS" | "ASSETS">("LOGIN");
  const [categories, setCategories] = useState<Category[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [agreementTemplate, setAgreementTemplate] = useState<Setting | null>(null);
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplatesSetting | null>(null);
  const [allocationLetterTemplate, setAllocationLetterTemplate] = useState<AllocationLetterSetting | null>(null);
  const [rentRates, setRentRates] = useState<RentRatesSetting | null>(null);
  const [rentBillTemplate, setRentBillTemplate] = useState<RentBillTemplateSetting | null>(null);
  const [globalSignature, setGlobalSignature] = useState<GlobalSignatureSetting | null>(null);
  
  // Auth state
  const [userEmail, setUserEmail] = useState<string | null>(() => {
    return localStorage.getItem("credential_user_email") || null;
  });
  // The signed-in Firebase Auth UID — this, not email, is the key used to
  // look up "my own" staff profile in Firestore (see firestore.rules).
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // User Management RBAC state definitions
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [currentUser, setCurrentUser] = useState<PortalUser | null>(null);
  const [assetsAutoOpenCreate, setAssetsAutoOpenCreate] = useState(false);

  // Email/Password auth states
  const [authMode, setAuthMode] = useState<"SIGN_IN" | "SIGN_UP" | "FORGOT_PASSWORD">("SIGN_IN");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authRole, setAuthRole] = useState<UserRole>("REGISTRAR");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Synchronize Agreement Template from Firestore
  useEffect(() => {
    const templateDocRef = doc(db, "settings", "agreement_template");
    const unsub = onSnapshot(
      templateDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          setAgreementTemplate(docSnap.data() as Setting);
        } else {
          console.log("Seeding default indenture tenancy agreement template...");
          try {
            await setDoc(templateDocRef, DEFAULT_AGREEMENT_TEMPLATE);
            setAgreementTemplate(DEFAULT_AGREEMENT_TEMPLATE);
          } catch (err) {
            console.warn("Failed to seed default agreement template, using local fallback:", err);
            setAgreementTemplate(DEFAULT_AGREEMENT_TEMPLATE);
          }
        }
      },
      (error) => {
        console.warn("Failed to fetch agreement template from Firestore, using local fallback:", error);
        setAgreementTemplate(DEFAULT_AGREEMENT_TEMPLATE);
      }
    );

    return () => unsub();
  }, []);

  // Synchronize SMS Templates from Firestore
  useEffect(() => {
    const templatesDocRef = doc(db, "settings", "sms_templates");
    const unsub = onSnapshot(
      templatesDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          setSmsTemplates(docSnap.data() as SmsTemplatesSetting);
        } else {
          console.log("Seeding default SMS templates...");
          try {
            await setDoc(templatesDocRef, DEFAULT_SMS_TEMPLATES);
            setSmsTemplates(DEFAULT_SMS_TEMPLATES);
          } catch (err) {
            console.warn("Failed to seed default SMS templates, using local fallback:", err);
            setSmsTemplates(DEFAULT_SMS_TEMPLATES);
          }
        }
      },
      (error) => {
        console.warn("Failed to fetch SMS templates from Firestore, using local fallback:", error);
        setSmsTemplates(DEFAULT_SMS_TEMPLATES);
      }
    );

    return () => unsub();
  }, []);

  // Synchronize Allocation Letter Template from Firestore
  useEffect(() => {
    const templateDocRef = doc(db, "settings", "allocation_letter_template");
    const unsub = onSnapshot(
      templateDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          setAllocationLetterTemplate(docSnap.data() as AllocationLetterSetting);
        } else {
          console.log("Seeding default allocation letter template...");
          try {
            await setDoc(templateDocRef, DEFAULT_ALLOCATION_LETTER_TEMPLATE);
            setAllocationLetterTemplate(DEFAULT_ALLOCATION_LETTER_TEMPLATE);
          } catch (err) {
            console.warn("Failed to seed default allocation letter template, using local fallback:", err);
            setAllocationLetterTemplate(DEFAULT_ALLOCATION_LETTER_TEMPLATE);
          }
        }
      },
      (error) => {
        console.warn("Failed to fetch allocation letter template from Firestore, using local fallback:", error);
        setAllocationLetterTemplate(DEFAULT_ALLOCATION_LETTER_TEMPLATE);
      }
    );

    return () => unsub();
  }, []);

  // Synchronize Rent Rates from Firestore
  useEffect(() => {
    const rentRatesDocRef = doc(db, "settings", "rent_rates");
    const unsub = onSnapshot(
      rentRatesDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          const loadedData = docSnap.data() as RentRatesSetting;
          setRentRates({
            groundsRentRate: 100,
            ...loadedData
          });
        } else {
          console.log("Seeding default rent rates...");
          try {
            await setDoc(rentRatesDocRef, DEFAULT_RENT_RATES);
            setRentRates(DEFAULT_RENT_RATES);
          } catch (err) {
            console.warn("Failed to seed default rent rates, using local fallback:", err);
            setRentRates(DEFAULT_RENT_RATES);
          }
        }
      },
      (error) => {
        console.warn("Failed to fetch rent rates from Firestore, using local fallback:", error);
        setRentRates(DEFAULT_RENT_RATES);
      }
    );

    return () => unsub();
  }, []);

  // Synchronize Rent Bill Template from Firestore
  useEffect(() => {
    const templateDocRef = doc(db, "settings", "rent_bill_template");
    const unsub = onSnapshot(
      templateDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          setRentBillTemplate(docSnap.data() as RentBillTemplateSetting);
        } else {
          console.log("Seeding default rent bill template...");
          try {
            await setDoc(templateDocRef, DEFAULT_RENT_BILL_TEMPLATE);
            setRentBillTemplate(DEFAULT_RENT_BILL_TEMPLATE);
          } catch (err) {
            console.warn("Failed to seed default rent bill template, using local fallback:", err);
            setRentBillTemplate(DEFAULT_RENT_BILL_TEMPLATE);
          }
        }
      },
      (error) => {
        console.warn("Failed to fetch rent bill template from Firestore, using local fallback:", error);
        setRentBillTemplate(DEFAULT_RENT_BILL_TEMPLATE);
      }
    );

    return () => unsub();
  }, []);

  // Synchronize Global Logo from Firestore
  useEffect(() => {
    const logoDocRef = doc(db, "settings", "global_logo");
    const unsub = onSnapshot(
      logoDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setGlobalLogoUrl(docSnap.data().logoUrl || "");
        } else {
          setGlobalLogoUrl("");
        }
      },
      (error) => {
        console.warn("Failed to fetch global logo from Firestore:", error);
      }
    );

    return () => unsub();
  }, []);

  // Synchronize Global Signature & Signee info from Firestore
  useEffect(() => {
    const sigDocRef = doc(db, "settings", "global_signature");
    const unsub = onSnapshot(
      sigDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          setGlobalSignature(docSnap.data() as GlobalSignatureSetting);
        } else {
          console.log("Seeding default global signature template...");
          try {
            await setDoc(sigDocRef, DEFAULT_GLOBAL_SIGNATURE);
            setGlobalSignature(DEFAULT_GLOBAL_SIGNATURE);
          } catch (err) {
            console.warn("Failed to seed default global signature, using local fallback:", err);
            setGlobalSignature(DEFAULT_GLOBAL_SIGNATURE);
          }
        }
      },
      (error) => {
        console.warn("Failed to fetch global signature, using local fallback:", error);
        setGlobalSignature(DEFAULT_GLOBAL_SIGNATURE);
      }
    );

    return () => unsub();
  }, []);

  // Synchronize Assets from Firestore in real-time
  useEffect(() => {
    const assetsCol = collection(db, "assets");
    const unsub = onSnapshot(
      assetsCol,
      (snapshot) => {
        const list: Asset[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Asset;
          const safeId = docSnap.id.replace(/\//g, "-");
          const assetObj: Asset = {
            ...data,
            id: safeId,
            assetCode: data.assetCode || (data as any).code || docSnap.id.replace(/-/g, "/"),
          };
          if (assetObj.categoryId === "market_stores___shed" || assetObj.categoryId === "market_stores") {
            if (assetObj.subType === "Store") assetObj.subType = "Market Store";
            if (assetObj.subType === "Shed") assetObj.subType = "Market Shed";
          }
          list.push(assetObj);
        });
        
        // Sort assets by assetCode / number
        list.sort((a, b) => (a.assetCode || a.id).localeCompare(b.assetCode || b.id, undefined, { numeric: true }));

        setAssets(list.length > 0 ? list : DEFAULT_SEED_ASSETS);
        
        // Auto-seed missing assets to Firestore if they don't exist yet
        const existingIds = new Set(list.map((a) => a.id));
        const missing = DEFAULT_SEED_ASSETS.filter((a) => !existingIds.has(a.id));
        if (missing.length > 0) {
          console.log(`Seeding ${missing.length} missing physical assets to Firestore...`);
          missing.forEach(async (asset) => {
            try {
              const safeDocId = asset.id.replace(/\//g, "-");
              await setDoc(doc(db, "assets", safeDocId), {
                ...asset,
                id: safeDocId
              });
            } catch (err) {
              console.warn("Seeding asset warning:", asset.id, err);
            }
          });
        }
      },
      (error) => {
        console.warn("Firestore assets snapshot error:", error);
        setAssets((prev) => (prev.length > 0 ? prev : DEFAULT_SEED_ASSETS));
      }
    );

    return () => unsub();
  }, []);

  // Synchronize dynamic Category Configurations from Firestore in real-time
  useEffect(() => {
    const categoriesCol = collection(db, "categories");
    const unsub = onSnapshot(
      categoriesCol,
      (snapshot) => {
        const list: Category[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as Category;
          if (data.id === "market_stores___shed" || data.id === "market_stores") {
            data.subTypes = data.subTypes.map(sub => {
              if (sub === "Store") return "Market Store";
              if (sub === "Shed") return "Market Shed";
              return sub;
            });
          }
          list.push(data);
        });
        setCategories(list);
        
        // Auto-seed missing default categories to Firestore if not already present or update assembly grounds
        DEFAULT_SEED_CATEGORIES.forEach(async (cat) => {
          const existingCat = list.find(existing => existing.id === cat.id);
          if (!existingCat) {
            try {
              await setDoc(doc(db, "categories", cat.id), cat);
            } catch (err) {
              console.error("Auto-seeding missing category error:", err);
            }
          } else if (cat.id === "assembly_grounds" && existingCat.description !== cat.description) {
            try {
              await setDoc(doc(db, "categories", cat.id), cat, { merge: true });
            } catch (err) {
              console.error("Auto-updating assembly grounds category error:", err);
            }
          }
        });
      },
      (error) => {
        console.warn("Firestore categories snapshot error:", error);
        setCategories((prev) => (prev.length > 0 ? prev : DEFAULT_SEED_CATEGORIES));
      }
    );

    return () => unsub();
  }, []);

  // Helper to safely extract epoch milliseconds from any date/Timestamp object
  const getMs = (dateVal: any): number => {
    if (!dateVal) return 0;
    if (typeof dateVal === "object" && typeof dateVal.toDate === "function") {
      return dateVal.toDate().getTime();
    }
    if (typeof dateVal === "object" && typeof dateVal.seconds === "number") {
      return dateVal.seconds * 1000;
    }
    const t = new Date(dateVal).getTime();
    return isNaN(t) ? 0 : t;
  };

  // Synchronize Applications and Applicants from Firestore in real-time
  useEffect(() => {
    const rawMap = new Map<string, Application>();

    const updateCombinedApplications = () => {
      const list = Array.from(rawMap.values());
      if (list.length === 0) {
        setApplications((prev) => (prev.length > 0 ? prev : DEFAULT_SEED_APPLICATIONS));
      } else {
        // Sort newest first using safe epoch timestamps
        list.sort((a, b) => getMs(b.createdAt) - getMs(a.createdAt));
        setApplications(list);
      }
      setLoading(false);
    };

    const normalizeDoc = (docSnap: any): Application => {
      const rawData = docSnap.data() || {};
      
      // Name parsing fallback
      let firstName = rawData.firstName || rawData.first_name || rawData.applicantFirstName || "";
      let surname = rawData.surname || rawData.lastName || rawData.last_name || rawData.applicantLastName || "";

      if (!firstName || !surname) {
        const fullNameStr = rawData.applicantName || rawData.fullName || rawData.name || rawData.applicant || rawData.occupantName || "";
        if (fullNameStr && typeof fullNameStr === "string") {
          const parts = fullNameStr.trim().split(/\s+/);
          if (!firstName) firstName = parts[0] || "Applicant";
          if (!surname) surname = parts.slice(1).join(" ") || "";
        }
      }

      if (!firstName) firstName = "Applicant";

      // Contact & Identification
      const contactNumber = rawData.contactNumber || rawData.phone || rawData.phoneNumber || rawData.telephone || rawData.contact || rawData.mobile || "";
      const ghanaCardNumber = rawData.ghanaCardNumber || rawData.ghanaCard || rawData.idCard || rawData.nationalId || rawData.cardNo || "GHA-000000000-0";

      // Category ID Normalization
      let catId = rawData.categoryId || rawData.category_id || "market_stores___shed";
      const catLower = String(catId).toLowerCase();
      if (catLower.includes("ground") || catLower.includes("assembly_ground")) {
        catId = "assembly_grounds";
      } else if (catLower.includes("bungalow") || catLower.includes("staff") || catLower.includes("housing")) {
        catId = "staff_bungalows";
      } else if (catLower.includes("market") || catLower.includes("store") || catLower.includes("shed")) {
        catId = "market_stores___shed";
      }

      // SubType Normalization
      let subType = rawData.subType || rawData.sub_type || rawData.spaceType || rawData.unitType || "Market Store";
      if (subType === "Store") subType = "Market Store";
      if (subType === "Shed") subType = "Market Shed";

      // Status Normalization
      let rawStatusStr = String(rawData.status || "PENDING_ALLOCATION").toUpperCase().replace(/[\s-]/g, "_");
      let status: ApplicationStatus = "PENDING_ALLOCATION";
      if (rawStatusStr.includes("RESERVE") || rawStatusStr.includes("ALLOCATED") || rawStatusStr.includes("STAGE2")) {
        status = "RESERVED";
      } else if (rawStatusStr.includes("AGREEMENT") || rawStatusStr.includes("SIGN") || rawStatusStr.includes("PAYMENT") || rawStatusStr.includes("AWAITING") || rawStatusStr.includes("STAGE3")) {
        status = "AWAITING_PAYMENT";
      } else if (rawStatusStr.includes("OCCUPIED") || rawStatusStr.includes("ACTIVE") || rawStatusStr.includes("COMPLETED") || rawStatusStr.includes("STAGE4")) {
        status = "OCCUPIED";
      } else {
        status = "PENDING_ALLOCATION";
      }

      const attributesObj = rawData.attributes || rawData.customAttributes || {};

      const appDoc: Application = {
        ...rawData,
        id: docSnap.id,
        firstName,
        surname,
        gender: rawData.gender || "Male",
        contactNumber,
        address: rawData.address || rawData.residentialAddress || "Nsawam",
        ghanaCardNumber,
        photo: rawData.photo || rawData.photoUrl || rawData.imageUrl || "",
        categoryId: catId,
        subType,
        attributes: attributesObj,
        customAttributes: attributesObj,
        status,
        createdAt: rawData.createdAt || rawData.dateRegistered || rawData.created_at || new Date().toISOString(),
        updatedAt: rawData.updatedAt || rawData.updated_at || new Date().toISOString(),
      };

      return appDoc;
    };

    const subscribeToCollection = (colName: string) => {
      return onSnapshot(
        collection(db, colName),
        (snapshot) => {
          // Use docChanges (not snapshot.forEach) so a deletion is actually
          // reflected: forEach only iterates documents CURRENTLY present,
          // so a removed doc was previously just skipped, leaving its old
          // entry stuck in rawMap forever (a deleted application stayed
          // visible on the dashboard until a full page reload).
          snapshot.docChanges().forEach((change) => {
            if (change.type === "removed") {
              rawMap.delete(change.doc.id);
            } else {
              rawMap.set(change.doc.id, normalizeDoc(change.doc));
            }
          });
          updateCombinedApplications();
        },
        (error) => {
          console.warn(`Firestore ${colName} snapshot warning:`, error);
          setLoading(false);
        }
      );
    };

    const unsub1 = subscribeToCollection("applications");
    const unsub2 = subscribeToCollection("applicants");
    const unsub3 = subscribeToCollection("occupants");
    const unsub4 = subscribeToCollection("tenants");
    const unsub5 = subscribeToCollection("registrations");

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
    };
  }, []);

  // Synchronize SMS Logs from Firestore in real-time
  useEffect(() => {
    const smsLogsCol = collection(db, "sms_logs");
    const unsub = onSnapshot(
      smsLogsCol,
      (snapshot) => {
        const list: SmsLog[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as SmsLog);
        });
        // Sort newest first
        list.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
        setSmsLogs(list);
      },
      (error) => {
        console.warn("Firestore sms_logs snapshot error:", error);
      }
    );

    return () => unsub();
  }, []);

  // Synchronize Portal Users from Firestore in real-time. This list is used
  // for display (Settings > Users) and for pre-auth existence checks
  // (sign-up "already registered?", forgot-password). It is NOT used to
  // resolve the signed-in user's own session — that comes from a direct,
  // UID-keyed doc listener below, which avoids the load-order race this
  // array previously caused.
  useEffect(() => {
    const usersCol = collection(db, "users");
    const unsub = onSnapshot(
      usersCol,
      (snapshot) => {
        const list: PortalUser[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as PortalUser), uid: docSnap.id });
        });
        setUsers(list);
      },
      (error) => {
        console.warn("Firestore users snapshot error:", error);
      }
    );

    return () => unsub();
  }, []);

  // Resolve currentUser directly from my own UID-keyed profile document.
  // This is the ONLY source of truth for "who am I" — no array search, no
  // load-order dependency on the broader `users` collection above.
  useEffect(() => {
    if (!authUid) {
      setCurrentUser(null);
      return;
    }

    const myRef = doc(db, "users", authUid);
    const unsub = onSnapshot(
      myRef,
      async (snap) => {
        if (!snap.exists()) {
          // First time this Firebase Auth account has been seen: self-provision
          // a PENDING profile (lowest privilege role). A Super Admin must then
          // review and activate it, exactly like a brand-new hire. This also
          // covers migrating a pre-existing account into the UID-keyed scheme.
          const authUser = auth.currentUser;
          const email = (authUser?.email || "").trim().toLowerCase();
          const newProfile: PortalUser = {
            email,
            name: authUser?.displayName?.trim() || (email.split("@")[0] || "New Staff"),
            role: "REGISTRAR",
            createdAt: new Date().toISOString(),
            status: "PENDING",
          };
          try {
            await setDoc(myRef, newProfile);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `users/${authUid}`);
            setAuthError("Could not create your staff profile. Please contact a Super Admin.");
            await signOut(auth).catch(() => {});
            setCurrentView("LOGIN");
          }
          // Wait for the next snapshot (the doc we just created) to handle
          // messaging/sign-out uniformly via the PENDING branch below.
          return;
        }

        const profile = { ...(snap.data() as PortalUser), uid: snap.id };

        if (profile.status === "PENDING") {
          setAuthError(`Access Denied: Your staff registration for ${profile.email} is pending review and activation by a Super Admin.`);
          setCurrentUser(null);
          await signOut(auth).catch(() => {});
          setCurrentView("LOGIN");
          return;
        }
        if (profile.status === "REJECTED") {
          setAuthError(`Access Denied: Your registration request for ${profile.email} has been rejected.`);
          setCurrentUser(null);
          await signOut(auth).catch(() => {});
          setCurrentView("LOGIN");
          return;
        }

        setCurrentUser(profile);
        setCurrentView((prev) => (prev === "LOGIN" ? (profile.role === "REGISTRAR" ? "REGISTER" : "DASHBOARD") : prev));
      },
      (error) => {
        console.warn("Firestore own-profile snapshot error:", error);
      }
    );

    return () => unsub();
  }, [authUid]);

  // Force REGISTRAR role to ONLY have access to REGISTER view (no dashboard access)
  useEffect(() => {
    if (currentUser?.role === "REGISTRAR" && currentView !== "REGISTER" && currentView !== "LOGIN") {
      setCurrentView("REGISTER");
    }
  }, [currentUser, currentView]);

  // Listen to Firebase Auth session state. This is the single source of
  // truth for "am I signed in" — it always clears state on sign-out (the
  // previous version had no else branch, which could leave a stale session
  // showing after a token expired or another tab signed out).
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserEmail(user.email);
        setAuthUid(user.uid);
        if (user.email) {
          localStorage.setItem("credential_user_email", user.email);
        }
      } else {
        setUserEmail(null);
        setAuthUid(null);
        setCurrentUser(null);
        localStorage.removeItem("credential_user_email");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real Email/Password Authentication Handlers
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError("Please fill in all required fields.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    
    const emailClean = authEmail.trim().toLowerCase();
    
    try {
      // Attempt standard Firebase Auth sign-in. Session state, profile
      // resolution, and routing are all handled by the onAuthStateChanged /
      // own-profile listeners above — no manual lookup needed here.
      await signInWithEmailAndPassword(auth, emailClean, authPassword);
      setAuthPassword("");
      setAuthSuccess("Signed in successfully via secure Firebase identity node!");
    } catch (err: any) {
      console.warn("Firebase Auth sign-in failed:", err);
      let errMsg = "Invalid email or incorrect password.";
      if (err.code === "auth/invalid-email") {
        errMsg = "The email address is not formatted correctly.";
      } else if (err.code === "auth/user-not-found") {
        errMsg = "No registered staff account found with this email.";
      } else if (err.code === "auth/too-many-requests") {
        errMsg = "Too many attempts. Please wait a moment and try again.";
      }
      setAuthError(errMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword || !authName || !authRole) {
      setAuthError("Please fill in all required registration fields.");
      return;
    }
    if (authPassword.length < 6) {
      setAuthError("Password must be at least 6 characters long.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    
    const emailClean = authEmail.trim().toLowerCase();

    // Check if user already exists in Firestore list
    const userExists = users.some(u => u.email.toLowerCase() === emailClean);
    if (userExists) {
      setAuthError("A staff account with this email address is already registered.");
      setAuthLoading(false);
      return;
    }

    const newUserProfile: PortalUser = {
      email: emailClean,
      name: authName.trim(),
      role: authRole,
      createdAt: new Date().toISOString(),
      status: "PENDING"
    };

    try {
      // 1. Create the real Firebase Auth account. If this fails, stop here —
      // there is no fallback path, so the Firestore profile below must not
      // be written unless the real account actually exists.
      const cred = await createUserWithEmailAndPassword(auth, emailClean, authPassword);

      // 2. Write the staff profile to Firestore, keyed by the new account's
      // own UID (required by firestore.rules — no password stored here).
      await setDoc(doc(db, "users", cred.user.uid), newUserProfile);

      // 3. Sign back out immediately: the account is PENDING, not approved
      // yet, and we don't want a half-authenticated flash of app UI.
      await signOut(auth).catch(() => {});

      setAuthPassword("");
      setAuthSuccess("Staff account successfully registered! Your registration is pending review. A Super Admin must review, assign your municipal role, and activate your account before you can log in.");
      setAuthMode("SIGN_IN");
    } catch (err: any) {
      console.error("Registration error:", err);
      let errMsg = "Failed to register staff account.";
      if (err.code === "auth/email-already-in-use") {
        errMsg = "An account with this email address already exists.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "The email address is not formatted correctly.";
      } else if (err.code === "auth/weak-password") {
        errMsg = "Password is too weak. Please choose a stronger password.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setAuthError(errMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail) {
      setAuthError("Please enter your email address to receive a password reset link.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    
    const emailClean = authEmail.trim().toLowerCase();
    
    // Check if user exists in Firestore
    const matchedUser = users.find(u => u.email.toLowerCase() === emailClean);

    if (!matchedUser) {
      setAuthError("No registered staff account found with this email address.");
      setAuthLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, emailClean);
      setAuthSuccess("A password reset link has been dispatched to your email address! Please check your inbox.");
    } catch (err: any) {
      console.error("Password reset error:", err);
      let errMsg = "Failed to send password reset email.";
      if (err.code === "auth/user-not-found") {
        errMsg = "No Firebase account found for this email. Contact a Super Admin to have your account set up.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "The email address is not formatted correctly.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setAuthError(errMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  // Standard Google Login flow
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setAuthLoading(true);
      setAuthError(null);
      // Session state, profile resolution (including self-provisioning a
      // PENDING profile on first sign-in), and routing are all handled by
      // the onAuthStateChanged / own-profile listeners above.
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      let errMsg = "Google Sign-In popup was blocked or dismissed. Please allow popups for this site, or sign in using your email and password.";
      if (err.code === "auth/unauthorized-domain") {
        errMsg = "Google Sign-In isn't available on this address yet (Google requires a real domain with HTTPS, not a bare IP). Please sign in using your email and password instead.";
      }
      setAuthError(errMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("SignOut issue:", e);
    }
    localStorage.removeItem("credential_user_email");
    setUserEmail(null);
    setAuthUid(null);
    setCurrentUser(null);
    setAuthEmail("");
    setAuthPassword("");
    setAuthName("");
    setAuthError(null);
    setAuthSuccess(null);
    setAuthMode("SIGN_IN");
    setCurrentView("LOGIN");
  };

  const selectedApplication = applications.find(a => a.id === selectedApplicationId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col justify-between">
      
      {/* Top Municipal Banner */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 shrink-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MunicipalLogo size={44} />
            <div className="text-left">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-900 block leading-none">
                Nsawam Municipal Assembly
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-tight mt-1 block">
                Public Asset & Housing Registry
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 text-[10px] font-bold uppercase tracking-tight">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span>Live Portal Sync</span>
            </div>

            {currentUser && currentView !== "LOGIN" && (
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200 shadow-sm ml-2">
                <div className="w-7 h-7 bg-indigo-900 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                  {(currentUser.name || "G").substring(0, 1).toUpperCase()}
                </div>
                <div className="text-left text-xs hidden sm:block">
                  <span className="font-bold text-[11px] text-slate-800 block">
                    {currentUser.name}
                  </span>
                  <span className="text-[9px] font-bold text-indigo-700 uppercase block tracking-wider">
                    {currentUser.role === "REGISTRAR" ? "Registrar Clerk" : currentUser.role}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="ml-1 text-xs text-slate-500 hover:text-red-600 font-bold px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container Stage */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3"
            >
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold">Synchronizing registry databases...</span>
            </motion.div>
          ) : currentView === "LOGIN" ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="max-w-md mx-auto my-6 bg-white rounded-3xl border border-slate-150 shadow-xl overflow-hidden"
            >
              {/* Login Banner */}
              <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-8 text-white text-center relative">
                <div className="mb-4 flex justify-center">
                  <MunicipalLogo size={80} className="drop-shadow-lg" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Municipal Staff Login</h2>
                <p className="text-indigo-200 text-xs mt-1.5 max-w-xs mx-auto">
                  Space Allocation & Internal Staff Housing Management Portal
                </p>
              </div>

              {/* Login Actions */}
              <div className="p-8 space-y-6">
                
                {/* Mode Toggles */}
                <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs font-bold gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("SIGN_IN");
                      setAuthError(null);
                      setAuthSuccess(null);
                    }}
                    className={`flex-1 py-2 text-center rounded-lg transition-all ${
                      authMode === "SIGN_IN"
                        ? "bg-indigo-900 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("SIGN_UP");
                      setAuthError(null);
                      setAuthSuccess(null);
                    }}
                    className={`flex-1 py-2 text-center rounded-lg transition-all ${
                      authMode === "SIGN_UP"
                        ? "bg-indigo-900 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    Register Account
                  </button>
                </div>

                {/* Status messages */}
                {authError && (
                  <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl flex gap-2.5 items-start text-left">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-red-800">Authentication Alert</h4>
                      <p className="text-[11px] text-red-700 leading-normal mt-0.5">{authError}</p>
                    </div>
                  </div>
                )}

                {authSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-2.5 items-start text-left">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-800">Success</h4>
                      <p className="text-[11px] text-emerald-700 leading-normal mt-0.5">{authSuccess}</p>
                    </div>
                  </div>
                )}

                {/* Form Mode Renderers */}
                {authMode === "SIGN_IN" && (
                  <form onSubmit={handleEmailSignIn} className="space-y-4 text-left">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Address
                      </label>
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="e.g. name@nsawam.gov.gh"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-500 font-medium bg-slate-50 transition-all focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-slate-400" /> Password
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode("FORGOT_PASSWORD");
                            setAuthError(null);
                            setAuthSuccess(null);
                          }}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-500 font-medium bg-slate-50 transition-all focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-3 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {authLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Signing In...
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4" /> Sign In with Credentials
                        </>
                      )}
                    </button>
                  </form>
                )}

                {authMode === "SIGN_UP" && (
                  <form onSubmit={handleEmailSignUp} className="space-y-4 text-left">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" /> Full Name
                      </label>
                      <input
                        type="text"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="e.g. Edwin Zamsonia"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-500 font-medium bg-slate-50 transition-all focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Address
                      </label>
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="e.g. name@nsawam.gov.gh"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-500 font-medium bg-slate-50 transition-all focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-400" /> Password (Min 6 chars)
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          minLength={6}
                          className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-500 font-medium bg-slate-50 transition-all focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-3 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {authLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Registering...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" /> Register Staff Account
                        </>
                      )}
                    </button>
                  </form>
                )}

                {authMode === "FORGOT_PASSWORD" && (
                  <form onSubmit={handleForgotPassword} className="space-y-4 text-left">
                    <p className="text-xs text-slate-500 leading-normal mb-1">
                      Enter your registered email address. We will transmit a secure password-reset link to your inbox.
                    </p>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" /> Registered Email Address
                      </label>
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="e.g. name@nsawam.gov.gh"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-500 font-medium bg-slate-50 transition-all focus:bg-white"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-3 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {authLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Sending Reset Link...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" /> Transmit Password Reset Email
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("SIGN_IN");
                        setAuthError(null);
                        setAuthSuccess(null);
                      }}
                      className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                    </button>
                  </form>
                )}

                {/* Google Sign In option */}
                {authMode !== "FORGOT_PASSWORD" && (
                  <>
                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-slate-200"></div>
                      <span className="flex-shrink mx-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                        Or Login With
                      </span>
                      <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                    >
                      <LogIn className="w-4 h-4 text-indigo-900" /> Sign In with Google
                    </button>
                  </>
                )}



              </div>
            </motion.div>
          ) : currentView === "DASHBOARD" ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <OverviewDashboard
                applications={applications}
                categories={categories}
                assets={assets}
                smsLogs={smsLogs}
                onSelectApplication={(app) => {
                  setSelectedApplicationId(app.id);
                  setCurrentView("DETAILS");
                }}
                onNewRegistration={() => setCurrentView("REGISTER")}
                onOpenSettings={() => setCurrentView("SETTINGS")}
                onOpenAssets={() => {
                  setAssetsAutoOpenCreate(false);
                  setCurrentView("ASSETS");
                }}
                currentUser={currentUser}
                users={users}
                onLogout={handleLogout}
                rentRates={rentRates}
                rentBillTemplate={rentBillTemplate}
                globalSignature={globalSignature}
                allocationLetterTemplate={allocationLetterTemplate}
              />
            </motion.div>
          ) : currentView === "REGISTER" ? (
            <motion.div
              key="register"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-3xl mx-auto"
            >
              <RegistrationForm
                categories={categories}
                onSuccess={() => setCurrentView("DASHBOARD")}
                onCancel={() => setCurrentView("DASHBOARD")}
                smsTemplates={smsTemplates}
                currentUser={currentUser}
              />
            </motion.div>
          ) : currentView === "SETTINGS" ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="max-w-4xl mx-auto"
            >
              <SettingsPanel
                categories={categories}
                users={users}
                onUpdate={() => {}}
                onClose={() => setCurrentView("DASHBOARD")}
                agreementTemplate={agreementTemplate}
                smsTemplates={smsTemplates}
                allocationLetterTemplate={allocationLetterTemplate}
                rentRates={rentRates}
                rentBillTemplate={rentBillTemplate}
                globalSignature={globalSignature}
              />
            </motion.div>
          ) : currentView === "ASSETS" ? (
            <motion.div
              key="assets"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <AssetRegistry
                assets={assets}
                categories={categories}
                applications={applications}
                onClose={() => {
                  setAssetsAutoOpenCreate(false);
                  setCurrentView("DASHBOARD");
                }}
                onUpdate={() => {}}
                currentUser={currentUser}
                autoOpenCreate={assetsAutoOpenCreate}
                smsTemplates={smsTemplates}
                rentRates={rentRates}
              />
            </motion.div>
          ) : currentView === "DETAILS" && selectedApplication ? (
            <motion.div
              key="details"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <ApplicationDetails
                application={selectedApplication}
                categories={categories}
                assets={assets}
                onClose={() => setCurrentView("DASHBOARD")}
                onUpdate={() => {}}
                currentUser={currentUser}
                agreementTemplate={agreementTemplate}
                smsTemplates={smsTemplates}
                allocationLetterTemplate={allocationLetterTemplate}
                rentRates={rentRates}
                globalSignature={globalSignature}
                rentBillTemplate={rentBillTemplate}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      {/* Footer credits & authority markings */}
      <footer className="bg-slate-950 text-slate-400 px-6 py-4 text-[10px] shrink-0 font-medium uppercase tracking-wider">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-slate-300 font-bold">Version 2.4.0 (Dynamic EAV)</span>
            <span className="hidden md:inline text-slate-700 border-l border-slate-800 h-3"></span>
            <span>© 2026 Nsawam Municipal Assembly Estate Unit</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
              ID: NMA-ADMIN-AF-2026
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
