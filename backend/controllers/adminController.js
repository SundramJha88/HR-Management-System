const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, "-password").sort({ createdAt: -1 });
    return res.json(users || []);
  } catch (err) {
    console.error("getAllUsers error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id, "-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error("getUserById error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, role, department } = req.body;
    if (!name || !role) {
      return res.status(400).json({ error: "Name and role are required" });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, role, department },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error("updateUser error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("deleteUser error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.getUsersStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const employeeCount = await User.countDocuments({ role: "employee" });
    const hrCount = await User.countDocuments({ role: "hr" });
    const adminCount = await User.countDocuments({ role: "admin" });
    const managerCount = await User.countDocuments({ role: "manager" });
    const supervisorCount = await User.countDocuments({ role: "supervisor" });
    
    return res.json({
      total: totalUsers,
      employee: employeeCount,
      hr: hrCount,
      admin: adminCount,
      manager: managerCount,
      supervisor: supervisorCount
    });
  } catch (err) {
    console.error("getUsersStats error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.getAttendanceReport = async (req, res) => {
  try {
    const attendance = await Attendance.find({})
      .populate("userId", "name email role department")
      .sort({ date: -1 })
      .limit(500);
    return res.json(attendance || []);
  } catch (err) {
    console.error("getAttendanceReport error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
};

exports.getLeaveReport = async (req, res) => {
  try {
    const leaves = await Leave.find({})
      .populate("userId", "name email role department")
      .sort({ date: -1 })
      .limit(500);
    return res.json(leaves || []);
  } catch (err) {
    console.error("getLeaveReport error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
};
