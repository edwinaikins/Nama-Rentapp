import { db, handleFirestoreError, OperationType } from "../firebase";
import { SmsLog } from "../types";
import { setDoc, doc } from "firebase/firestore";

/**
 * Formats a registration template replacing placeholder keywords.
 */
export function formatRegistrationSms(template: string, data: { firstName: string; id: string }): string {
  return template
    .replace(/{firstName}/gi, data.firstName)
    .replace(/{id}/gi, data.id);
}

/**
 * Formats an allocation template replacing placeholder keywords.
 */
export function formatAllocationSms(template: string, data: { firstName: string; assetCode: string }): string {
  return template
    .replace(/{firstName}/gi, data.firstName)
    .replace(/{assetCode}/gi, data.assetCode);
}

/**
 * Formats a payment template replacing placeholder keywords.
 */
export function formatPaymentSms(template: string, data: { 
  firstName: string; 
  amountPaid: number | string; 
  manualReceiptNo: string; 
  assetCode: string; 
  remainingBalance: number | string; 
}): string {
  return template
    .replace(/{firstName}/gi, data.firstName)
    .replace(/{amountPaid}/gi, String(data.amountPaid))
    .replace(/{manualReceiptNo}/gi, data.manualReceiptNo)
    .replace(/{assetCode}/gi, data.assetCode)
    .replace(/{remainingBalance}/gi, String(data.remainingBalance));
}

/**
 * Customizes the SMS message based on the applicant's tracking category.
 * - For Market Stores & Sheds (market_stores / market_stores___shed): Use "Market Store or Shed" instead of "Physical Space" or "Space".
 * - For Staff Bungalows & Housing (staff_bungalows): Use "Bungalow" instead of "Physical Space" or "Space".
 */
export function customizeSmsForTrack(message: string, categoryId?: string): string {
  if (!categoryId) return message;

  if (categoryId === "market_stores" || categoryId === "market_stores___shed") {
    let customized = message;
    customized = customized.replace(/\bphysical\s+space\b/gi, "Market Store or Shed");
    customized = customized.replace(/\bSpace\b/g, "Market Store or Shed");
    customized = customized.replace(/\bspace\b/g, "Market Store or Shed");
    return customized;
  }

  if (categoryId === "staff_bungalows") {
    let customized = message;
    customized = customized.replace(/\bphysical\s+space\b/gi, "Bungalow");
    customized = customized.replace(/\bSpace\b/g, "Bungalow");
    customized = customized.replace(/\bspace\b/g, "Bungalow");
    return customized;
  }

  if (categoryId === "assembly_grounds") {
    let customized = message;
    customized = customized.replace(/\bphysical\s+space\b/gi, "Grounds Space");
    customized = customized.replace(/\bSpace\b/g, "Grounds Space");
    customized = customized.replace(/\bspace\b/g, "Grounds Space");
    return customized;
  }

  return message;
}

/**
 * Sends an SMS message via our server-side Wigal proxy and logs the result to Firestore.
 * This ensures full persistent tracking and audit history of all notifications.
 */
export async function sendSMSAndLog(to: string, message: string, categoryId?: string): Promise<SmsLog> {
  const customizedMessage = customizeSmsForTrack(message, categoryId);
  const logId = `sms_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const sentAt = new Date().toISOString();

  let status: "SUCCESS" | "FAILED" = "FAILED";
  let statusCode = 500;
  let gatewayError: string | undefined;
  let clientId: number | string | undefined;
  let senderId: number | string | undefined;

  try {
    const response = await fetch("/api/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, message: customizedMessage })
    });

    statusCode = response.status;
    const result = await response.json();

    if (response.ok && result.success) {
      status = "SUCCESS";
    } else {
      status = "FAILED";
      gatewayError = result.error || (result.data && result.data.message) || "Gateway validation failed";
    }

    // Map additional diagnostics returned by our proxy
    clientId = result.clientId;
    senderId = result.senderId;

  } catch (err: any) {
    status = "FAILED";
    gatewayError = err.message || "Network transmission failed";
  }

  const log: SmsLog = {
    id: logId,
    to,
    message: customizedMessage,
    sentAt,
    status,
    statusCode,
    ...(gatewayError && { error: gatewayError }),
    ...(clientId && { clientId }),
    ...(senderId && { senderId })
  };

  // Persist the log trace to Firestore
  try {
    await setDoc(doc(db, "sms_logs", logId), log);
    console.log(`[SMS Logger] Successfully saved trace record for logId: ${logId}`);
  } catch (dbErr) {
    // Gracefully capture but throw standard firestore error context
    handleFirestoreError(dbErr, OperationType.CREATE, `sms_logs/${logId}`);
  }

  return log;
}
