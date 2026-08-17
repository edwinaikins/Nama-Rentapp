import { Application, Category, Asset, SmsLog } from "../types";

function escapeCSVValue(val: any): string {
  if (val === null || val === undefined) return "";
  let str = "";
  if (typeof val === "object") {
    str = JSON.stringify(val);
  } else {
    str = String(val);
  }
  // CSV formula injection guard: a value starting with =, +, -, @, or a
  // leading tab/CR can execute as a formula (or trigger a DDE payload) when
  // the exported file is opened in Excel/Sheets. Prefixing with a single
  // quote forces spreadsheet apps to treat it as plain text while leaving
  // the visible value effectively unchanged.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  // If value contains a comma, newline, or double quote, escape it
  if (str.includes(",") || str.includes("\n") || str.includes("\r") || str.includes('"')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function getAttributeValue(app: Application, key: string): string {
  if (!app) return "";
  
  // Normalize key to standard case variants
  const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const snakeKey = key.replace(/([A-Z])/g, (g) => `_${g[0].toLowerCase()}`);
  const keysToTry = Array.from(new Set([key, camelKey, snakeKey, key.toLowerCase(), key.toUpperCase()]));
  
  // Check within dynamic attributes first
  if (app.attributes && typeof app.attributes === "object") {
    for (const k of keysToTry) {
      if (app.attributes[k] !== undefined && app.attributes[k] !== null) {
        return String(app.attributes[k]);
      }
    }
    
    // Fallback: Case-insensitive search on keys
    const lowerTarget = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const k of Object.keys(app.attributes)) {
      if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === lowerTarget) {
        return String(app.attributes[k]);
      }
    }
  }

  // Check top level of application object next
  const anyApp = app as any;
  for (const k of keysToTry) {
    if (anyApp[k] !== undefined && anyApp[k] !== null) {
      return String(anyApp[k]);
    }
  }

  // Fallback: Case-insensitive search on top level keys
  const lowerTargetDirect = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const k of Object.keys(anyApp)) {
    if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === lowerTargetDirect) {
      return String(anyApp[k]);
    }
  }

  return "";
}

export function downloadFile(content: string, filename: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportApplicationsToCSV(applications: Application[], categories: Category[]) {
  const headers = [
    "Application ID",
    "First Name",
    "Surname",
    "Gender",
    "Contact Number",
    "Address",
    "Ghana Card Number",
    "Category Track",
    "Sub Type",
    "goods_type",
    "market_block",
    "next_of_kin",
    "Status",
    "Assigned Asset Code",
    "Base Rent (GHS)",
    "Lease Duration",
    "Signed At",
    "Signature Name",
    "Yearly Rent (GHS)",
    "Lease Start",
    "Lease End",
    "Payment Mode",
    "Payment Reference",
    "Payment Logged At",
    "Created At"
  ];

  const rows = applications.map(app => {
    const cat = categories.find(c => c.id === app.categoryId);
    return [
      app.id,
      app.firstName,
      app.surname,
      app.gender,
      app.contactNumber,
      app.address,
      app.ghanaCardNumber,
      cat ? cat.name : app.categoryId,
      app.subType,
      getAttributeValue(app, "goods_type"),
      getAttributeValue(app, "market_block"),
      getAttributeValue(app, "next_of_kin"),
      app.status,
      app.assetCode || "Unassigned",
      app.baseRent || "",
      app.leaseDuration || "",
      app.signedAt || "",
      app.signatureName || "",
      app.yearlyRent || "",
      app.leaseStart || "",
      app.leaseEnd || "",
      app.paymentMode || "",
      app.paymentRef || "",
      app.paymentLoggedAt || "",
      app.createdAt
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(escapeCSVValue).join(","))
  ].join("\r\n");

  downloadFile(csvContent, `Nsawam_Applicants_${new Date().toISOString().split('T')[0]}.csv`, "text/csv;charset=utf-8;");
}

export function exportAssetsToCSV(assets: Asset[], categories: Category[]) {
  const headers = [
    "Asset Code",
    "Asset Name / Location",
    "Category Track",
    "Sub Type",
    "Status",
    "Base Rent (GHS/month)",
    "Assigned Application ID",
    "Assigned Occupant Name",
    "Notes / Specifications",
    "Created At"
  ];

  const rows = assets.map(asset => {
    const cat = categories.find(c => c.id === asset.categoryId);
    return [
      asset.id,
      asset.name,
      cat ? cat.name : asset.categoryId,
      asset.subType,
      asset.status,
      asset.baseRent || "",
      asset.assignedApplicationId || "None",
      asset.assignedOccupantName || "None",
      asset.notes || "",
      asset.createdAt
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(escapeCSVValue).join(","))
  ].join("\r\n");

  downloadFile(csvContent, `Nsawam_Assets_${new Date().toISOString().split('T')[0]}.csv`, "text/csv;charset=utf-8;");
}

export function exportSmsLogsToCSV(smsLogs: SmsLog[]) {
  const headers = [
    "Log ID",
    "Recipient Phone",
    "Message Content",
    "Sent At",
    "Status",
    "Gateway Status Code",
    "Error Details"
  ];

  const rows = smsLogs.map(log => [
    log.id,
    log.to,
    log.message,
    log.sentAt,
    log.status,
    log.statusCode,
    log.error || ""
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(escapeCSVValue).join(","))
  ].join("\r\n");

  downloadFile(csvContent, `Nsawam_SMS_Logs_${new Date().toISOString().split('T')[0]}.csv`, "text/csv;charset=utf-8;");
}

export function exportCompleteRegistryToJSON(data: {
  applications: Application[];
  categories: Category[];
  assets: Asset[];
  smsLogs: SmsLog[];
}) {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, `Nsawam_Full_Registry_Backup_${new Date().toISOString().split('T')[0]}.json`, "application/json;charset=utf-8;");
}
