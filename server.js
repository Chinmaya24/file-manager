const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { google } = require("googleapis");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// 🔐 Google Drive Auth
const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/drive"]
});

const drive = google.drive({ version: "v3", auth });

// 📁 YOUR FOLDER ID
const FOLDER_ID = "1jDmlWhqTVTiKWNWxctxgfw9cPrpLSji9";

// ✅ CREATE - Upload to Drive
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const fileMetadata = {
      name: req.file.originalname,
      parents: [FOLDER_ID]
    };

    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(req.file.path)
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id, name"
    });

    fs.unlinkSync(req.file.path);

    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).send("Upload failed");
  }
});

// ✅ READ - List files from Drive
app.get("/files", async (req, res) => {
  try {
    const response = await drive.files.list({
      q: `'${FOLDER_ID}' in parents`,
      fields: "files(id, name)"
    });

    res.json(response.data.files);
  } catch (err) {
    res.status(500).send(err);
  }
});

// ✅ DELETE
app.delete("/delete/:id", async (req, res) => {
  try {
    await drive.files.delete({
      fileId: req.params.id
    });

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).send(err);
  }
});

// ✅ UPDATE (Rename)
app.put("/rename", async (req, res) => {
  try {
    const { id, newName } = req.body;

    await drive.files.update({
      fileId: id,
      resource: { name: newName }
    });

    res.json({ message: "Renamed" });
  } catch (err) {
    res.status(500).send(err);
  }
});

app.listen(3000, () => console.log("Server running on 3000"));