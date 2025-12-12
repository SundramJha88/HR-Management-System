const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  fileType: { type: String, default: "" },
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Document", DocumentSchema);
