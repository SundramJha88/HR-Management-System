const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");

exports.getAllUsers = async (req, res) => {
  try {
    const role = String(req.user.role || '').toLowerCase();
    const filter = role === 'hr' ? { role: { $in: ['employee','hr'] } } : {};
    const users = await User.find(filter, "-password").sort({ createdAt: -1 });
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

exports.updateUserStatus = async (req, res) => {
  try {
    const { active } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (String(user.role).toLowerCase() === "admin") {
      return res.status(400).json({ error: "Cannot change status for admin user" });
    }
    user.active = !!active;
    await user.save();
    return res.json({ id: user._id, active: user.active });
  } catch (err) {
    console.error("updateUserStatus error:", err);
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
    const role = String(req.user.role || '').toLowerCase();
    const filter = role === 'hr' ? { role: { $in: ['employee','hr'] } } : {};
    const users = await User.find(filter, "-password").sort({ createdAt: -1 });
    const ids = users.map(u => u._id);
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const atts = await Attendance.find({ date: todayKey, userId: { $in: ids } })
      .populate("userId", "name email role department employeeId");
    const attMap = new Map();
    for (const a of atts) {
      attMap.set(String(a.userId?._id || a.userId), a);
    }
    const rows = users.map(u => {
      const a = attMap.get(String(u._id));
      const statusRaw = a ? String(a.status || '').toLowerCase() : 'absent';
      const status = statusRaw === 'early' ? 'Early punchout' : statusRaw || 'absent';
      return {
        userId: {
          name: u.name,
          email: u.email || '',
          role: u.role,
          department: u.department || null,
          employeeId: u.employeeId || ''
        },
        status
      };
    });
    return res.json(rows);
  } catch (err) {
    console.error("getAttendanceReport error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
};

exports.getLeaveReport = async (req, res) => {
  try {
    const leaves = await Leave.find({})
      .populate("userId", "name email role department employeeId")
      .sort({ date: -1 })
      .limit(500);
    const rows = Array.isArray(leaves) ? leaves.filter(l => l && l.userId) : [];
    return res.json(rows);
  } catch (err) {
    console.error("getLeaveReport error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
};
