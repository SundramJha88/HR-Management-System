const router = require("express").Router();
const auth = require("../middleware/auth");
const multer = require("multer");
const Document = require("../models/Document");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.post("/upload", auth, upload.single("doc"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded!" });

    const newDoc = new Document({
      userId: req.user.id,
      fileName: req.file.filename,
      filePath: req.file.path,
      fileType: req.file.mimetype
    });

    await newDoc.save();
    res.json({ message: "Document uploaded!", document: newDoc });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/mydocs", auth, async (req, res) => {
  try {
    const docs = await Document.find({ userId: req.user.id }).sort({ uploadedAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
