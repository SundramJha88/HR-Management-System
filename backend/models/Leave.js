const mongoose = require("mongoose");

const LeaveSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true },
  reason: { type: String },
  status: { type: String, default: "pending" }
}, { timestamps: true });

LeaveSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Leave", LeaveSchema);
