const router = require("express").Router();
const auth = require("../middleware/auth");
const checkRole = require("../middleware/roleCheck");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");

router.post("/apply", auth, async (req, res) => {
  try {
    const { date, reason } = req.body;
    if (!date) return res.status(400).json({ error: "date required" });

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (date === todayKey) {
      if (now.getHours() >= 9) {
        return res.status(400).json({ error: "Same-day leave must be applied before 09:00" });
      }
    }

    await Leave.findOneAndUpdate(
      { userId: req.user.id, date },
      { userId: req.user.id, date, reason, status: "pending" },
      { upsert: true, new: true }
    );

    return res.json({ message: "Leave Applied" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const leaves = await Leave.find({ userId: req.user.id }).sort({ date: -1 });
    return res.json(leaves);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/pending", auth, checkRole(["hr","admin"]), async (req, res) => {
  try {
    const leaves = await Leave.find({ status: "pending" })
      .populate("userId", "name email role department employeeId")
      .sort({ createdAt: -1 });
    const rows = Array.isArray(leaves) ? leaves.filter(l => l && l.userId) : [];
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/approve", auth, checkRole(["hr","admin"]), async (req, res) => {
  try {
    const leave = await Leave.findByIdAndUpdate(req.params.id, { status: "approved" }, { new: true });
    if (!leave) return res.status(404).json({ error: "Leave not found" });
    await Attendance.findOneAndUpdate(
      { userId: leave.userId, date: leave.date },
      { userId: leave.userId, date: leave.date, status: "leave" },
      { upsert: true }
    );
    return res.json({ message: "Approved", leave });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/reject", auth, checkRole(["hr","admin"]), async (req, res) => {
  try {
    const leave = await Leave.findByIdAndUpdate(req.params.id, { status: "rejected" }, { new: true });
    if (!leave) return res.status(404).json({ error: "Leave not found" });
    return res.json({ message: "Rejected", leave });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
