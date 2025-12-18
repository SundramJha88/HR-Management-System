const router = require("express").Router();
const auth = require("../middleware/auth");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");

router.post("/punchin", auth, async (req, res) => {
  try {
    const { date, time, timeIso } = req.body;
    if (!date || !time) return res.status(400).json({ error: "date and time required" });

    const approvedLeave = await Leave.findOne({ userId: req.user.id, date, status: "approved" });
    if (approvedLeave) {
      return res.status(400).json({ error: "Punch-in blocked due to approved leave" });
    }

    await Attendance.findOneAndUpdate(
      { userId: req.user.id, date },
      { userId: req.user.id, date, punchIn: time, punchInIso: timeIso || new Date().toISOString() },
      { upsert: true, new: true }
    );
    return res.json({ message: "Punch In Recorded" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/punchout", auth, async (req, res) => {
  try {
    const { date, time, totalHours, forceHalfDay } = req.body;
    if (!date || !time) return res.status(400).json({ error: "date and time required" });

    const att = await Attendance.findOne({ userId: req.user.id, date });
    let status = "present";
    if (forceHalfDay) status = "halfday";
    else if (totalHours) {
      const hh = parseInt((totalHours || "00:00:00").split(":")[0]) || 0;
      if (hh >= 9) status = "overtime";
      else if (hh >= 8) status = "present";
      else if (hh >= 5) status = "halfday";
      else status = "early";
    }

    await Attendance.findOneAndUpdate(
      { userId: req.user.id, date },
      { userId: req.user.id, date, punchOut: time, totalHours: totalHours || "", status },
      { upsert: true, new: true }
    );
    return res.json({ message: "Punch Out Recorded" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/history", auth, async (req, res) => {
  try {
    const data = await Attendance.find({ userId: req.user.id }).sort({ date: -1 });
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
