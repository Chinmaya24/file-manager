const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

function loadEnvFileIfPresent(envFilePath) {
  if (!fs.existsSync(envFilePath)) return;

  const raw = fs.readFileSync(envFilePath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadEnvFileIfPresent(path.resolve(__dirname, ".env"));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "client")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "index.html"));
});

const upload = multer({ dest: "uploads/" });

const normalizePrivateKey = (str) => {
  if (!str) return str;
  let key = str;
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
};

const auth = new google.auth.GoogleAuth({
  credentials: {
    type: process.env.GOOGLE_TYPE || "service_account",
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY || ""),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
    universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN,
  },
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const EDITOR_ROLES = new Set(["owner", "organizer", "fileOrganizer", "writer"]);
let folderAccessCheckPromise = null;

function logGoogleApiError(source, err) {
  console.error(`[${source}] Google API error message:`, err?.message || err);
  if (err?.response?.data) {
    console.error(`[${source}] Google API response data:`, JSON.stringify(err.response.data, null, 2));
  }
  if (Array.isArray(err?.errors) && err.errors.length > 0) {
    console.error(`[${source}] Google API errors array:`, JSON.stringify(err.errors, null, 2));
  }
  if (err?.code) {
    console.error(`[${source}] Google API status code:`, err.code);
  }
}

async function verifyFolderEditorAccess() {
  if (!FOLDER_ID) throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID in environment");
  if (!SERVICE_ACCOUNT_EMAIL) throw new Error("Missing GOOGLE_CLIENT_EMAIL in environment");

  const resp = await drive.permissions.list({
    fileId: FOLDER_ID,
    fields: "permissions(role,type,emailAddress)",
    pageSize: 100,
    supportsAllDrives: true,
  });

  const permissions = resp.data.permissions || [];
  const match = permissions.find(
    (p) => (p.emailAddress || "").toLowerCase() === SERVICE_ACCOUNT_EMAIL.toLowerCase()
  );

  if (!match) {
    throw new Error(`Service account ${SERVICE_ACCOUNT_EMAIL} has no permission on folder ${FOLDER_ID}`);
  }

  if (!EDITOR_ROLES.has(match.role)) {
    throw new Error(`Service account role '${match.role}' is insufficient. Writer or higher required.`);
  }
}

async function ensureFolderAccessVerified() {
  if (!folderAccessCheckPromise) {
    folderAccessCheckPromise = verifyFolderEditorAccess();
  }
  return folderAccessCheckPromise.catch((err) => {
    folderAccessCheckPromise = null;
    throw err;
  });
}

// ✅ CREATE - Upload
app.post("/upload", upload.single("file"), async (req, res) => {
  const tempPath = req.file?.path;
  try {
    if (!FOLDER_ID) {
      return res.status(500).json({ success: false, error: "Missing configuration", reason: "GOOGLE_DRIVE_FOLDER_ID not set" });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    console.log(`[Upload] fileName="${req.file.originalname}" mimeType="${req.file.mimetype}" size=${req.file.size}`);
    await ensureFolderAccessVerified();

    const fileMetadata = { name: req.file.originalname, parents: [FOLDER_ID] };
    const media = { mimeType: req.file.mimetype, body: fs.createReadStream(req.file.path) };

    const response = await drive.files.create({ resource: fileMetadata, media, fields: "id, name" });
    return res.json({ success: true, file: response.data });
  } catch (err) {
    logGoogleApiError("Upload", err);
    return res.status(500).json({ success: false, error: "Upload failed", reason: err?.message || "unknown" });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
  }
});

// ✅ READ - List files
app.get("/files", async (req, res) => {
  try {
    if (!FOLDER_ID) {
      return res.status(500).json({ success: false, error: "Missing configuration", reason: "GOOGLE_DRIVE_FOLDER_ID not set" });
    }
    const response = await drive.files.list({
      q: `'${FOLDER_ID}' in parents`,
      fields: "files(id, name)",
    });
    return res.json({ files: response.data.files || [] });
  } catch (err) {
    logGoogleApiError("ListFiles", err);
    return res.status(500).json({ success: false, error: "List failed", reason: err?.message || "unknown" });
  }
});

// ✅ DELETE
app.delete("/delete/:id", async (req, res) => {
  try {
    const fileId = req.params.id;
    if (!fileId) {
      return res.status(400).json({ success: false, error: "Missing file ID" });
    }
    console.log(`[Delete] fileId="${fileId}"`);
    await ensureFolderAccessVerified();
    await drive.files.delete({ fileId });
    return res.json({ success: true, message: "File deleted successfully", fileId });
  } catch (err) {
    logGoogleApiError("Delete", err);
    return res.status(500).json({ success: false, error: "Delete failed", reason: err?.message || "unknown" });
  }
});

// ✅ UPDATE - Rename
app.put("/rename", async (req, res) => {
  try {
    const { id, newName } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: "Missing file ID" });
    }
    if (!newName || typeof newName !== "string" || newName.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Invalid new name" });
    }
    console.log(`[Rename] fileId="${id}" newName="${newName}"`);
    await drive.files.update({ fileId: id, resource: { name: newName.trim() } });
    return res.json({ success: true, message: "Renamed successfully" });
  } catch (err) {
    logGoogleApiError("Rename", err);
    return res.status(500).json({ success: false, error: "Rename failed", reason: err?.message || "unknown" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});