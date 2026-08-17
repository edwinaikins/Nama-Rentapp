import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { rateLimit } from "express-rate-limit";
import { initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { sendWigalV3Sms, normalizeGhanaPhoneNumber } from "./src/services/wigalSmsUtility";

// Load environment variables (quiet: dotenv's own console self-promotion is noise in prod logs)
dotenv.config({ quiet: true });

const app = express();
const PORT = 3000;

// Enable large JSON payloads for Base64 image transfers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Firebase Admin SDK, initialized for ID-token verification only. Verifying
// a token just checks its signature against Google's public certs for this
// project, so no service-account private key/secret is required — only the
// project ID (which is already public in the client-side Firebase config).
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "other-496818";
const adminApp = initializeAdminApp({ projectId: FIREBASE_PROJECT_ID });

// Require a valid, current Firebase Auth ID token on protected endpoints.
// This does NOT check Firestore role/status (that would mean an extra
// round trip on every request) — it only proves the caller is a signed-in
// Firebase user, which is enough to close the "open, unauthenticated relay"
// gap. Firestore's own rules remain the authority on role-based access.
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || "";
  const match = /^Bearer (.+)$/.exec(authHeader);
  if (!match) {
    return res.status(401).json({ success: false, error: "Missing or malformed Authorization header." });
  }
  try {
    const decoded = await getAuth(adminApp).verifyIdToken(match[1]);
    (req as any).uid = decoded.uid;
    next();
  } catch (err) {
    console.warn("[Auth] ID token verification failed:", err);
    return res.status(401).json({ success: false, error: "Invalid or expired session token." });
  }
}

// Rate limit: caps volume on the SMS relay regardless of which authenticated
// account is calling it, since SMS sends cost real money via Wigal.
const smsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many SMS requests. Please wait a moment and try again." },
});

// API Routes

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Live Workflow Execution Engine - Deterministic Local Validation (No Gemini API usage for registration as requested)
app.post("/api/process-workflow", async (req, res) => {
  try {
    const {
      firstName,
      surname,
      gender,
      contactNumber,
      address,
      ghanaCardNumber,
      photo, // Base64 image string (or empty)
      categoryId,
      categoryName,
      subType,
      rawAttributes, // Map of attribute_slug -> value
      attributeDefinitions, // Array of { slug, label, type, options, required }
    } = req.body;

    // Validate request body
    if (!firstName || !surname || !gender || !contactNumber || !address || !ghanaCardNumber || !categoryId || !subType) {
      return res.status(400).json({
        valid: false,
        errors: ["Missing core biological, address, gender, contact, or asset-track details in submission."],
      });
    }

    const errors: string[] = [];
    const normalizedAttributes: Record<string, any> = {};

    // Basic contact number validation (must be 10 digits)
    if (!contactNumber.trim()) {
      errors.push("Contact number is required.");
    } else {
      const digitsOnly = contactNumber.replace(/\D/g, "");
      if (digitsOnly.length !== 10) {
        errors.push("Contact number must be exactly 10 digits.");
      }
    }

    // Basic address validation
    if (!address.trim()) {
      errors.push("Residential or business address is required.");
    }

    // Basic regex for Ghana Card: GHA-XXXXXXXXX-X where X is digit/alphanumeric
    const ghanaCardRegex = /^GHA-\d{9}-\d$/;
    if (!ghanaCardRegex.test(ghanaCardNumber)) {
      errors.push("Ghana Card Number must follow the official format: GHA-XXXXXXXXX-X (e.g. GHA-123456789-0).");
    }

    // Check dynamic attributes
    if (attributeDefinitions && Array.isArray(attributeDefinitions)) {
      for (const def of attributeDefinitions) {
        const val = rawAttributes?.[def.slug];
        if (def.required && (val === undefined || val === null || String(val).trim() === "")) {
          errors.push(`Field "${def.label}" is required for track "${categoryName}".`);
        } else if (val !== undefined && val !== null) {
          if (def.type === "number") {
            const num = Number(val);
            if (isNaN(num)) {
              errors.push(`Field "${def.label}" must be a valid number.`);
            } else {
              normalizedAttributes[def.slug] = num;
            }
          } else if (def.type === "select" && def.options && def.options.length > 0) {
            if (!def.options.includes(val)) {
              errors.push(`Field "${def.label}" must be one of: ${def.options.join(", ")}.`);
            } else {
              normalizedAttributes[def.slug] = val;
            }
          } else {
            normalizedAttributes[def.slug] = String(val).trim();
          }
        }
      }
    }

    return res.json({
      valid: errors.length === 0,
      errors,
      normalizedAttributes: {
        ...normalizedAttributes,
        firstName: firstName.trim(),
        surname: surname.trim(),
        address: address.trim()
      },
      verificationSummary: `[Local Validation Engine] Automatically processed Ghana Card: ${ghanaCardRegex.test(ghanaCardNumber) ? "VALID" : "INVALID"}. Verified ${Object.keys(normalizedAttributes).length} dynamic attributes for ${subType} (${categoryName}).`,
    });
  } catch (error) {
    console.error("Workflow Engine Processing Error:", error);
    res.status(500).json({
      valid: false,
      errors: [
        error instanceof Error ? error.message : "Internal workflow engine error during validation processing.",
      ],
    });
  }
});

// Resilient SMS Notification Proxy Endpoint for Wigal (frog.wigal.com.gh)
// Locked down: requires a signed-in staff session and is rate-limited,
// since an open relay here would let anyone send billable SMS traffic.
app.post("/api/send-sms", requireAuth, smsRateLimiter, async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || typeof to !== "string" || !message || typeof message !== "string") {
      return res.status(400).json({ success: false, error: "Missing recipient (to) or message content" });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return res.status(400).json({ success: false, error: "Message content cannot be empty." });
    }
    if (trimmedMessage.length > 918) {
      // 918 chars = 6 concatenated GSM-7 SMS segments, a generous ceiling
      // for any templated notification this app sends.
      return res.status(400).json({ success: false, error: "Message content is too long (max 918 characters)." });
    }

    // A valid normalized Ghana number is always "233" + 9 digits (12 digits total).
    const normalizedTo = normalizeGhanaPhoneNumber(to);
    if (!/^233\d{9}$/.test(normalizedTo)) {
      return res.status(400).json({ success: false, error: "Recipient phone number is not a valid Ghanaian number." });
    }

    const username = process.env.WIGAL_USERNAME || process.env.WIGAL_CLIENT_ID || "edwinaikins@gmail.com";
    const senderId = process.env.WIGAL_SENDER_ID || "NAMA";
    const msgId = `sms_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    console.log(`[Wigal SMS v3] Sending message via username: ${username}, senderId: ${senderId} with msgId: ${msgId}`);

    const result = await sendWigalV3Sms(normalizedTo, trimmedMessage, msgId, senderId);

    console.log(`[Wigal SMS v3] Gateway response status: ${result.statusCode}`, result.data);

    return res.json({
      success: result.success,
      status: result.statusCode,
      clientId: username,
      senderId: senderId,
      data: result.data,
      error: result.error
    });
  } catch (error: any) {
    console.error("[Wigal SMS v3] Proxy Integration Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to transmit SMS message"
    });
  }
});

// Configure Vite or Production Static Asset Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nsawam Asset Manager server listening on http://localhost:${PORT}`);
  });
}

startServer();
