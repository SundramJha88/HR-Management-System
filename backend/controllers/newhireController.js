const NewHire = require('../models/Newhire');
const Counter = require('../models/Counter');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

exports.submit = async (req, res) => {
  try {
    const creatorId = req.user.id;
    const payload = req.body;
    const role = String(payload.role || 'employee').toLowerCase();
    const name = (payload.name || `${payload.firstName || ''} ${payload.lastName || ''}`).trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const mobile = String(payload.mobile || '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    if (!email) return res.status(400).json({ error: 'email required' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already in use' });
    const counter = await Counter.findOneAndUpdate(
      { key: 'employeeId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const employeeId = `VAAU${String(counter.seq).padStart(4, '0')}`;
    const plainPassword = String(payload.password || '').trim() || `Vaau@${crypto.randomBytes(4).toString('hex')}`;
    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash(plainPassword, salt);
    const newHireEntry = await NewHire.create({
      userId: creatorId,
      employeeId,
      role,
      name,
      email,
      mobile,
      ...payload
    });
    const user = await User.create({
      employeeId,
      name,
      email,
      mobile,
      role,
      password,
      active: true,
      department: payload.department || null
    });
    return res.status(201).json({ message: 'New Hire created', newHire: newHireEntry, user, initialPassword: plainPassword });
  } catch (err) {
    console.error('newhire submit error:', err);
    return res.status(500).json({
      message: 'Error submitting New Hire form',
      error: err.message
    });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const entries = await NewHire.find({ userId }).sort({ createdAt: -1 });

    return res.json({
      data: entries
    });
  } catch (err) {
    console.error('newhire getHistory error:', err);
    return res.status(500).json({
      message: 'Error fetching New Hire history',
      error: err.message
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await NewHire.findOne({ _id: id });

    if (!entry) {
      return res.status(404).json({
        message: 'New Hire entry not found'
      });
    }

    return res.json({
      data: entry
    });
  } catch (err) {
    console.error('newhire getById error:', err);
    return res.status(500).json({
      message: 'Error fetching New Hire entry',
      error: err.message
    });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const formData = req.body;
    const entry = await NewHire.findOne({ _id: id });
    if (!entry) return res.status(404).json({ message: 'New Hire entry not found' });
    const prevEmployeeId = entry.employeeId;
    const nextRole = formData.role || entry.role;
    const nextName = formData.name || entry.name;
    const nextEmail = formData.email || entry.email;
    const nextMobile = formData.mobile || entry.mobile;
    if (nextEmail && nextEmail !== entry.email) {
      const dupe = await User.findOne({ email: nextEmail, employeeId: { $ne: prevEmployeeId } });
      if (dupe) return res.status(400).json({ error: 'Email already in use' });
    }
    Object.assign(entry, formData, { employeeId: prevEmployeeId });
    const saved = await entry.save();
    const user = await User.findOne({ employeeId: prevEmployeeId });
    if (user) {
      user.department = formData.department || user.department;
      user.name = nextName;
      user.email = nextEmail;
      user.mobile = nextMobile;
      user.role = nextRole;
      if (formData.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(String(formData.password), salt);
      }
      await user.save();
    }
    return res.json({ message: 'Updated', data: saved });
  } catch (err) {
    console.error('newhire update error:', err);
    return res.status(500).json({
      message: 'Error updating New Hire form',
      error: err.message
    });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await NewHire.findOneAndDelete({ _id: id });

    if (!entry) {
      return res.status(404).json({
        message: 'New Hire entry not found'
      });
    }

    return res.json({
      message: 'New Hire entry deleted successfully'
    });
  } catch (err) {
    console.error('newhire delete error:', err);
    return res.status(500).json({
      message: 'Error deleting New Hire entry',
      error: err.message
    });
  }
};

exports.getByEmployeeId = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const entry = await NewHire.findOne({ employeeId });
    if (entry) return res.json(entry);
    const user = await User.findOne({ employeeId });
    if (!user) return res.status(404).json({ error: 'Not found' });
    const parts = String(user.name || '').trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    return res.json({
      employeeId: user.employeeId,
      role: user.role,
      name: user.name,
      firstName,
      lastName,
      knownAs: user.name,
      email: user.email || '',
      mobile: user.mobile || '',
      department: user.department || ''
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.updateByEmployeeId = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const formData = req.body;
    const entry = await NewHire.findOne({ employeeId });
    if (!entry) return res.status(404).json({ error: 'Not found' });
    const nextEmployeeId = String(formData.employeeId || employeeId).trim();
    const nextRole = formData.role || entry.role;
    const nextName = formData.name || entry.name;
    const nextEmail = formData.email || entry.email;
    const nextMobile = formData.mobile || entry.mobile;
    if (nextEmail && nextEmail !== entry.email) {
      const dupe = await User.findOne({ email: nextEmail, employeeId: { $ne: employeeId } });
      if (dupe) return res.status(400).json({ error: 'Email already in use' });
    }
    if (nextEmployeeId !== employeeId) {
      const dupeIdUser = await User.findOne({ employeeId: nextEmployeeId });
      const dupeIdHire = await NewHire.findOne({ employeeId: nextEmployeeId });
      if (dupeIdUser || dupeIdHire) return res.status(400).json({ error: 'Employee ID already in use' });
    }
    Object.assign(entry, formData, { employeeId: nextEmployeeId });
    const saved = await entry.save();
    const user = await User.findOne({ employeeId });
    if (user) {
      user.employeeId = nextEmployeeId;
      user.department = formData.department || user.department;
      user.name = nextName;
      user.email = nextEmail;
      user.mobile = nextMobile;
      user.role = nextRole;
      if (formData.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(String(formData.password), salt);
      }
      await user.save();
    }
    return res.json({ message: 'Updated', data: saved });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.listAll = async (req, res) => {
  try {
    const role = String(req.user.role || '').toLowerCase();
    let filter = {};
    if (role === 'hr') filter.role = { $in: ['employee','hr'] };
    const data = await NewHire.find(filter).sort({ createdAt: -1 });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
};
