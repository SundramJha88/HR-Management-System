const router = require("express").Router();
const auth = require("../middleware/auth");
const Leave = require("../models/Leave");

router.post("/apply", auth, async (req, res) => {
  try {
    const { date, reason } = req.body;
    if (!date) return res.status(400).json({ error: "date required" });

    await Leave.findOneAndUpdate(
      { userId: req.user.id, date },
      { userId: req.user.id, date, reason },
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

module.exports = router;
