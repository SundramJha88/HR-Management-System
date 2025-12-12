const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    if (!name || !password) return res.status(400).json({ error: 'Name and password required' });

    if (email) {
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ error: 'Email already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const user = await User.create({
      name,
      email,
      password: hash,
      role: role || 'employee',
      department: department || null,
    });

    return res.json({
      message: 'Registered',
      id: user._id,
      name: user.name,
      role: user.role,
      department: user.department,
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    // try by email, then by name
    let user = null;
    if (email) user = await User.findOne({ email });
    if (!user) user = await User.findOne({ name: email });
    if (!user) {
      console.warn(`Login failed: user not found for identifier='${email}'`);
      return res.status(400).json({ error: 'User not found' });
    }

    // Determine if stored password looks like a bcrypt hash
    const isHashed = typeof user.password === 'string' && /^\$2[aby]\$/.test(user.password);
    let ok = false;
    if (isHashed) {
      ok = await bcrypt.compare(password, user.password);
    } else {
      // legacy/plain-text password fallback: accept if equal and then re-hash
      ok = password === user.password;
      if (ok) {
        try {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(password, salt);
          await user.save();
          console.info(`Upgraded plain password to hashed for user=${user._id}`);
        } catch (e) {
          console.error('Error upgrading password hash:', e);
        }
      }
    }

    if (!ok) {
      console.warn(`Login failed: wrong password for user=${user._id}`);
      return res.status(400).json({ error: 'Wrong password' });
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, role: user.role, department: user.department },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      id: user._id,
      name: user.name,
      role: user.role,
      department: user.department,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.changePassword = async (req, res) => {
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
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
