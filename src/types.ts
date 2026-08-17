export interface AttributeDefinition {
  slug: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[]; // Allowed options for select type
  required: boolean;
}

export interface Category {
  id: string; // e.g., "market_stores", "staff_bungalows"
  name: string; // e.g., "Market Stores"
  description: string;
  subTypes: string[]; // e.g., ["Store", "Shed"] or ["2-Bedroom Semi-Detached", "Executive Bungalow"]
  attributes: AttributeDefinition[];
  createdAt: string;
}

export type AssetStatus = "VACANT" | "RESERVED" | "OCCUPIED";

export interface Asset {
  id: string; // The unique asset code/id, e.g. NAMA-ST-001
  assetCode?: string; // Standard formatted code, e.g. NAMA/ST/001
  name: string; // Description or location, e.g. "Store #001"
  categoryId: string; // Reference to Category ID
  subType: string; // Specific sub-type from the Category Track
  status: AssetStatus; // VACANT, RESERVED, OCCUPIED
  baseRent?: number; // Standard rent rate in GHS per month
  assignedApplicationId?: string | null; // Occupant application/registration ID
  assignedOccupantName?: string | null; // Occupant name
  notes?: string; // Standard condition or extra specs
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStatus =
  | "PENDING_ALLOCATION"   // Stage 1: Registration Complete
  | "RESERVED"             // Stage 2: Matched with Vacant Asset Code
  | "AWAITING_PAYMENT"     // Stage 3: Tenancy Agreement locked & signed
  | "OCCUPIED";            // Stage 4: Payment logged & Tenancy Active

export interface PaymentRecord {
  id: string;
  amountPaid: number;
  manualReceiptNo: string;
  paymentDate: string;
  paymentMode: "Mobile Money" | "Bank Deposit" | "Salary Deduction" | "Cash";
  notes?: string;
}

export interface Application {
  id: string;
  categoryId: string;
  subType: string;
  firstName: string;
  surname: string;
  gender: "Male" | "Female";
  contactNumber: string;
  address: string;
  ghanaCardNumber: string; // GHA-XXXXXXXXX-X
  photo?: string; // Base64 passport photo string
  attributes: Record<string, any>; // Key-Value pair dynamic attributes (EAV mapping)
  status: ApplicationStatus;
  
  // Lifecycle variables appended along stages
  assetCode?: string; // e.g., NMA-MKT-B12 or NMA-BUNG-04
  leaseDuration?: string; // e.g., "1 Year", "2 Years"
  baseRent?: number; // Rent rate in GHS
  signedAt?: string; // ISO string when signed
  signatureName?: string; // Authorized signatory name
  
  // Allocation Letter fields
  allocationLetterRef?: string;
  allocationLetterDate?: string;
  allocationLetterSignee?: string;
  allocationLetterSigneeTitle?: string;
  allocationLetterIssuedAt?: string;
  allocationLetterPrinted?: boolean;
  allocationLetterPrintedAt?: string;
  allocationSignatureImg?: string; // Base64 signature for Allocation Letter
  leaseSignatureImg?: string; // Base64 signature for Lease Agreement
  signAllocationManually?: boolean;
  signLeaseManually?: boolean;
  
  paymentMode?: "Mobile Money" | "Bank Deposit" | "Salary Deduction" | "Cash";
  paymentRef?: string; // transaction reference / receipt number
  paymentLoggedAt?: string;

  // Yearly rent & Installment tracking
  yearlyRent?: number; // Yearly calculated rent due (typically baseRent * 12)
  leaseStart?: string; // Lease start date
  leaseEnd?: string; // Lease end date (1 year later, updated on renewals)
  currentLeaseYear?: number; // e.g. 1 for first year, 2 for second year renewal
  payments?: PaymentRecord[]; // List of logged installments
  assignedAssets?: string[]; // Array of assigned asset codes
  scannedAgreementUrl?: string; // Base64 data url of the signed agreement
  scannedAgreementUploadedAt?: string; // ISO date string of upload
  scannedAllocationLetterUrl?: string; // Base64 data url of the scanned allocation letter
  scannedAllocationLetterUploadedAt?: string; // ISO date string of upload of allocation letter
  rentBillNo?: string;
  rentBillDate?: string;
  rentBillDueDate?: string;
  signBillManually?: boolean;

  createdAt: string;
  updatedAt: string;
}

export type UserRole = "REGISTRAR" | "LEASING_OFFICER" | "FINANCIAL_OFFICER" | "SUPER_USER";

export interface PortalUser {
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  status?: "PENDING" | "ACTIVE" | "REJECTED";
}

export interface Setting {
  id: string; // e.g. "agreement_template"
  lessorTitle: string;
  officeTitle: string;
  boxAddress: string;
  lessorDesc: string;
  recitals: string;
  termsList: string[];
  witnessStatement: string;
  statutoryText: string;
}

export interface AllocationLetterSetting {
  id: string; // "allocation_letter_template"
  title: string;
  subTitle: string;
  boxAddress: string;
  letterSubject: string;
  salutation: string;
  introduction: string;
  detailsIntro: string;
  conditionsIntro: string;
  conditionsList: string[];
  instructions: string;
  concludingRemarks: string;
  logoUrl?: string; // Base64 or URL for custom logo
}

export interface SmsTemplatesSetting {
  id: string; // "sms_templates"
  registration: string;
  allocation: string;
  payment: string;
}

export interface RentRatesSetting {
  id: string; // "rent_rates"
  storeRentRate: number;
  shedRentRate: number;
  groundsRentRate?: number;
}

export interface RentBillTemplateSetting {
  id: string; // "rent_bill_template"
  title: string;
  subTitle: string;
  boxAddress: string;
  logoUrl?: string; // Custom uploaded logo or base64 URL
  paymentGuidelines: string;
}

export interface GlobalSignatureSetting {
  id: string; // "global_signature"
  signeeName: string;
  signeeTitle: string;
  signatureImg: string; // Base64 signature image
}

export interface SmsLog {
  id: string;
  to: string;
  message: string;
  sentAt: string;
  status: "SUCCESS" | "FAILED";
  statusCode: number;
  error?: string;
  clientId?: number | string;
  senderId?: number | string;
}

