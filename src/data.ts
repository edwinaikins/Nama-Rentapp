import { Category, Application, Asset, Setting, SmsTemplatesSetting, AllocationLetterSetting, RentRatesSetting, RentBillTemplateSetting, GlobalSignatureSetting } from "./types";

// Note: the placeholder DEFAULT_SEED_USERS scaffolding (a hardcoded
// edwin@zamsonia.com SUPER_USER account among others) that used to live
// here has been removed — it was dead code once the Firestore RBAC rewrite
// replaced client-side auto-seeding with real self-registration + admin
// approval. If a document with that old placeholder email still exists in
// Firestore, delete it from the Firebase Console — it's not created by the
// app anymore.

export const DEFAULT_SEED_CATEGORIES: Category[] = [
  {
    id: "market_stores___shed",
    name: "Market Stores & Shed",
    description: "Public commercial spaces leased to trading citizens.",
    subTypes: ["Market Store", "Market Shed"],
    attributes: [
      {
        slug: "market_block",
        label: "Market Section / Block Code",
        type: "text",
        required: true
      },
      {
        slug: "goods_type",
        label: "Type of Goods Sold",
        type: "select",
        options: ["Perishables", "Dry Goods", "Electronics", "Clothing", "Other Goods"],
        required: true
      }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: "staff_bungalows",
    name: "Staff Bungalows & Housing",
    description: "Internal assembly residential housing assigned to staff.",
    subTypes: ["2-Bedroom Semi-Detached", "Executive Bungalow", "Single Room Self-Contained"],
    attributes: [
      {
        slug: "staff_number",
        label: "Municipal Staff ID Number",
        type: "text",
        required: true
      },
      {
        slug: "department",
        label: "Department Name",
        type: "text",
        required: true
      },
      {
        slug: "employment_grade",
        label: "Employment Grade Rank",
        type: "select",
        options: ["Junior Staff", "Senior Staff", "Management", "Executive Directorate"],
        required: true
      }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: "assembly_grounds",
    name: "Assembly Grounds",
    description: "Designated municipal open grounds allocated for market traders to place trading containers, kiosks, or temporary sheds for commercial trading.",
    subTypes: ["Grounds Space"],
    attributes: [
      {
        slug: "ground_location",
        label: "Ground / Zone Location",
        type: "text",
        required: true
      },
      {
        slug: "structure_type",
        label: "Trader Structure / Facility Type",
        type: "select",
        options: ["Trading Container", "Temporary Shed / Kiosk", "Open Ground Plot", "Other Portable Structure"],
        required: true
      },
      {
        slug: "trading_nature",
        label: "Nature of Trade / Commodities Sold",
        type: "text",
        required: false
      },
      {
        slug: "container_size",
        label: "Container / Structure Dimensions",
        type: "select",
        options: ["Standard 10ft Container Space", "Standard 20ft Container Space", "Large 40ft Container Space", "Custom Shed Plot Size"],
        required: false
      }
    ],
    createdAt: new Date().toISOString()
  }
];

export const DEFAULT_SEED_ASSETS: Asset[] = [
  ...Array.from({ length: 92 }, (_, i) => {
    const numStr = String(i + 1).padStart(3, "0");
    const code = `NAMA/ST/${numStr}`;
    const safeDocId = `NAMA-ST-${numStr}`;
    return {
      id: safeDocId,
      assetCode: code,
      name: `Store #${numStr}`,
      categoryId: "market_stores___shed",
      subType: "Market Store",
      status: "VACANT" as const,
      baseRent: 150,
      notes: "",
      createdAt: "2026-07-23T05:00:00.000Z",
      updatedAt: "2026-07-23T05:00:00.000Z"
    };
  })
];

export const DEFAULT_SEED_APPLICATIONS: Application[] = [
  {
    id: "APP-315933",
    firstName: "Andrew",
    surname: "Test",
    gender: "Male",
    contactNumber: "0240000000",
    address: "Nsawam Main Market Area",
    ghanaCardNumber: "GHA-720193821-4",
    photo: "",
    categoryId: "market_stores___shed",
    subType: "Market Store",
    attributes: {
      market_block: "BLOCK A",
      goods_type: "Dry Goods"
    },
    status: "RESERVED",
    assetCode: "NMA-MKT-01",
    createdAt: "2026-06-30T13:26:03.033Z",
    updatedAt: "2026-06-30T13:26:41.143Z"
  }
];

export const DEFAULT_AGREEMENT_TEMPLATE: Setting = {
  id: "agreement_template",
  lessorTitle: "NSAWAM MUNICIPAL ASSEMBLY",
  officeTitle: "OFFICE OF THE MUN. COORDINATING DIRECTOR",
  boxAddress: "P.O. BOX 45, NSAWAM, EASTERN REGION, GHANA",
  lessorDesc: "THE NSAWAM MUNICIPAL ASSEMBLY, represented herein by its authorized administrative municipal delegate (hereinafter referred to as \"the Assembly\") of the one part;",
  recitals: "WHEREAS the Assembly is the lawful controller and administrative caretaker of all municipal spaces and retail market sectors within the Nsawam Municipal Area; and whereas the Tenant has applied for allocation of physical retail/commercial business space(s) and the Assembly has agreed to lease same under the specified terms herein.",
  termsList: [
    "LEASE TERM: This lease is granted for a term of [DURATION], commencing from [START_DATE].",
    "RENT VALUE & PAYMENT COVENANTS: The monthly rent rate under this lease is locked in for the first (1st) year of tenancy only. Thereafter, the rent rate is subject to automatic revision and adjustments each year in accordance with the annual Fee Fixing Resolution guidelines.",
    "USE OF PREMISES: The premises shall be used strictly for commercial/residential purposes as registered under the [CATEGORY] category. No sub-leasing, structural adjustments, or third-party transfer is permitted without written consent from the Mun. Coordinating Director.",
    "MAINTENANCE: The Tenant agrees to maintain the allocated physical space in clean, hygienic, and tenantable condition, respecting all municipal sanitation and safety guidelines.",
    "BYE-LAWS COMPLIANCE: The Tenant is bound by all Nsawam Municipal Assembly bye-laws, health, and licensing criteria. Non-compliance serves as immediate grounds for lease termination and space recovery."
  ],
  witnessStatement: "IN WITNESS WHEREOF the parties have set their hands and municipal stamps the day and year first above written.",
  statutoryText: "⚠️ Authorized by Act of Parliament • Ministry of Local Government & Decentralisation • Republic of Ghana"
};

export const DEFAULT_SMS_TEMPLATES: SmsTemplatesSetting = {
  id: "sms_templates",
  registration: "Dear {firstName}, you have successfully registered as an applicant with Nsawam Municipal Assembly. ID: {id}. We will notify you once a physical space is allocated. Thank you.",
  allocation: "Dear {firstName}, a physical space has been successfully allocated to you by Nsawam Municipal Assembly. Asset Code: {assetCode}. Please visit the Assembly office to finalize the tenancy agreement. Thank you.",
  payment: "Dear {firstName}, we have successfully received your payment of {amountPaid} GHS (Receipt No: {manualReceiptNo}) for Space Code {assetCode}. Your remaining balance is {remainingBalance} GHS. Thank you, Nsawam Municipal Assembly."
};

export const DEFAULT_ALLOCATION_LETTER_TEMPLATE: AllocationLetterSetting = {
  id: "allocation_letter_template",
  title: "NSAWAM ADOAGYIRI MUNICIPAL ASSEMBLY",
  subTitle: "OFFICE OF THE MUNICIPAL ASSEMBLY",
  boxAddress: "P.O. BOX 45, NSAWAM, EASTERN REGION, GHANA",
  letterSubject: "LETTER OF ALLOCATION OF MUNICIPAL PHYSICAL ASSET",
  salutation: "Dear Sir/Madam,",
  introduction: "We are pleased to inform you that your application to secure a municipal physical asset has been approved by the management of the Nsawam Adoagyiri Municipal Assembly (NAMA).",
  detailsIntro: "The details of your allocation are as follows:",
  conditionsIntro: "Please note that this allocation is subject to the following standard regulations and conditions:",
  conditionsList: [
    "You are required to complete the execution of a formal Lease Agreement with the Assembly within fourteen (14) days from the date of this letter.",
    "All applicable rent rates, installment configurations, and payment parameters shall be specified and regulated under the formal Lease Agreement.",
    "No structural changes or subletting of this allocated property is permitted without written authorization from the Municipal Coordinating Director."
  ],
  instructions: "Please present this original allocation document to the Estate Unit at the Municipal Assembly building to proceed to Stage 3: signing of the Tenancy Lease Indenture.",
  concludingRemarks: "We congratulate you on your allocation and look forward to a successful partnership."
};

export const DEFAULT_RENT_RATES: RentRatesSetting = {
  id: "rent_rates",
  storeRentRate: 150,
  shedRentRate: 80,
  groundsRentRate: 100
};

export const DEFAULT_RENT_BILL_TEMPLATE: RentBillTemplateSetting = {
  id: "rent_bill_template",
  title: "Nsawam Adoagyiri Municipal Assembly",
  subTitle: "Finance & Estate Management Department",
  boxAddress: "P.O. BOX 45, NSAWAM, EASTERN REGION, GHANA",
  logoUrl: "",
  paymentGuidelines: "1. Payments are due and payable within thirty (30) days of service of this notice.\n2. All payments must be made to the Nsawam Municipal Assembly Finance Office at the treasury cashier desks, or via official banker's draft.\n3. Please present this bill demand notice at the time of payment to ensure correct credit allocation to your file.\n4. Unsettled rent beyond the 30-day grace period may attract standard administrative surcharges or result in lease review."
};

export const DEFAULT_GLOBAL_SIGNATURE: GlobalSignatureSetting = {
  id: "global_signature",
  signeeName: "Mr. Jasper Adenyo",
  signeeTitle: "Municipal Coordinating Director",
  signatureImg: "" // empty by default, drawn/uploaded by super admin
};


