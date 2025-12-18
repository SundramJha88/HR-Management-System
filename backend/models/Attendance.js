const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true },
  punchIn: { type: String },
  punchInIso: { type: String },
  punchOut: { type: String }, 
  punchOutIso: { type: String },
  totalHours: { type: String }, 
  status: { type: String, enum: ["present","halfday","overtime","leave","absent","pending","missedout","early"], default: "present" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

AttendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

AttendanceSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Attendance", AttendanceSchema);
