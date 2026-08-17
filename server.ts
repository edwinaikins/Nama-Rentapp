import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { sendWigalV3Sms } from "./src/services/wigalSmsUtility";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Enable large JSON payloads for Base64 image transfers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

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
app.post("/api/send-sms", async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ success: false, error: "Missing recipient (to) or message content" });
    }

    const username = process.env.WIGAL_USERNAME || process.env.WIGAL_CLIENT_ID || "edwinaikins@gmail.com";
    const senderId = process.env.WIGAL_SENDER_ID || "NAMA";
    const msgId = `sms_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    console.log(`[Wigal SMS v3] Sending message via username: ${username}, senderId: ${senderId} with msgId: ${msgId}`);

    const result = await sendWigalV3Sms(to, message, msgId, senderId);

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
