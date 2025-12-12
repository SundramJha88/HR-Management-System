const Leave = require("../models/Leave");
const Attendance = require("../models/Attendance");

exports.applyLeave = async (req, res) => {
  try {
    const { date, reason } = req.body;
    if (!date) return res.status(400).json({ error: "date required" });

    const leave = await Leave.findOneAndUpdate(
      { userId: req.user.id, date },
      { userId: req.user.id, date, reason, status: "pending", appliedAt: new Date() },
      { upsert: true, new: true }
    );

    await Attendance.findOneAndUpdate(
      { userId: req.user.id, date },
      { userId: req.user.id, date, status: "leave" },
      { upsert: true }
    );

    res.json({ message: "Leave applied", leave });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.history = async (req, res) => {
  try {
    const data = await Leave.find({ userId: req.user.id }).sort({ date: -1 });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
