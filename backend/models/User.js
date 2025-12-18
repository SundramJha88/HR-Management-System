const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'employee', 'hr'],
    default: 'employee'
  },
  employeeId: { type: String, unique: true, sparse: true },
  active: { type: Boolean, default: true },
  mobile: { type: String },
  department: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);
