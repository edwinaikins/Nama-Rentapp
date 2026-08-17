/**
 * TypeScript / JavaScript integration for Wigal Frog SMS API v3.
 * Separates the core API request logic into a reusable utility.
 */

export interface WigalSmsDestination {
  destination: string; // Recipient phone number
  message: string;     // The text message
  msgid: string;       // Unique message tracking ID
  smstype: "text" | "flash" | "unicode"; // Default is 'text'
}

export interface WigalSmsPayload {
  senderid: string;
  destinations: WigalSmsDestination[];
}

export interface WigalSmsResult {
  success: boolean;
  statusCode: number;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Normalizes phone numbers to standard Ghanaian format (233XXXXXXXXX).
 * Handles numbers with leading 0, plus sign, or already in correct format.
 */
export function normalizeGhanaPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) {
    return "233" + digits.substring(1);
  }
  if (digits.length === 9) {
    return "233" + digits;
  }
  return digits;
}

/**
 * Sends an SMS using the Wigal Frog SMS API v3.
 * 
 * @param to - Recipient's phone number
 * @param messageText - The message content to deliver
 * @param customMsgId - Optional custom unique message tracking ID. If omitted, will auto-generate.
 * @param customSenderId - Optional custom Sender ID. Defaults to env config or "NAMA".
 */
export async function sendWigalV3Sms(
  to: string,
  messageText: string,
  customMsgId?: string,
  customSenderId?: string
): Promise<WigalSmsResult> {
  const normalizedPhone = normalizeGhanaPhoneNumber(to);
  const msgid = customMsgId || `sms_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  // Credentials must come from environment variables — no hardcoded fallback.
  // See .env.example for WIGAL_USERNAME / WIGAL_CLIENT_ID / WIGAL_API_KEY / WIGAL_SENDER_ID.
  const username = process.env.WIGAL_USERNAME || process.env.WIGAL_CLIENT_ID || "edwinaikins@gmail.com";
  const apiKey = process.env.WIGAL_API_KEY;
  const senderId = customSenderId || process.env.WIGAL_SENDER_ID || "NAMA";

  if (!apiKey) {
    throw new Error(
      "WIGAL_API_KEY is not set. Configure it in your environment (see .env.example) before sending SMS."
    );
  }

  const url = "https://frogapi.wigal.com.gh/api/v3/sms/send";

  // ENFORCED PAYLOAD STRUCTURE
  const payload: WigalSmsPayload = {
    senderid: senderId,
    destinations: [
      {
        destination: normalizedPhone,
        message: messageText,
        msgid: msgid,
        smstype: "text"
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "username": username,
        "api-key": apiKey
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    const statusCode = response.status;
    const text = await response.text();

    let responseData: any;
    try {
      responseData = JSON.parse(text);
    } catch {
      responseData = { text };
    }

    if (response.ok && (responseData.status === "ACCEPTD" || responseData.status === "SUCCESS" || responseData.success)) {
      return {
        success: true,
        statusCode,
        message: "Message accepted for processing",
        data: responseData
      };
    } else {
      return {
        success: false,
        statusCode,
        message: responseData.message || "Wigal v3 gateway validation failed",
        data: responseData,
        error: responseData.message || text
      };
    }
  } catch (err: any) {
    console.error("[WigalSmsUtility] API v3 transmission failed:", err);
    return {
      success: false,
      statusCode: 504,
      message: err.message || "Network transmission failed",
      error: err.message || "Timeout or gateway unreachable"
    };
  }
}
