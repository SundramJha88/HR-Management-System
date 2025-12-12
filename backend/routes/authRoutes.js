const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "secret123";

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    if (!name || !password) return res.status(400).json({ error: "Name and password required" });

    if (email) {
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ error: "Email already in use" });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const user = await User.create({
      name,
      email,
      password: hash,
      role: role || 'employee',
      department: department || null
    });
    return res.json({
      message: "Registered",
      id: user._id,
      name: user.name,
      role: user.role,
      department: user.department
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    let user = await User.findOne({ email });
    if (!user) user = await User.findOne({ name: email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isHashed = typeof user.password === "string" && /^\$2[aby]\$/.test(user.password);
    let ok = false;
    if (isHashed) {
      ok = await bcrypt.compare(password, user.password);
    } else {
      ok = password === user.password;
      if (ok) {
        try {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(password, salt);
          await user.save();
        } catch (e) {}
      }
    }

    if (!ok) return res.status(400).json({ error: "Wrong password" });

    const role = String(user.role || "employee").toLowerCase();
    const token = jwt.sign(
      { id: user._id, name: user.name, role, department: user.department },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      id: user._id,
      name: user.name,
      role,
      department: user.department
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id, "-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new passwords are required' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    user.password = hash;
    await user.save();

    return res.json({ message: 'Password updated' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
