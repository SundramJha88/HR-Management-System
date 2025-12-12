const NewHire = require('../models/newhire');

exports.submit = async (req, res) => {
  try {
    const userId = req.user.id;
    const formData = req.body;

    const newHireEntry = new NewHire({
      userId,
      ...formData
    });

    await newHireEntry.save();

    return res.status(201).json({
      message: 'New Hire form submitted successfully',
      data: newHireEntry
    });
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
    const userId = req.user.id;

    const entry = await NewHire.findOne({ _id: id, userId });

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
    const userId = req.user.id;
    const formData = req.body;

    const entry = await NewHire.findOneAndUpdate(
      { _id: id, userId },
      formData,
      { new: true }
    );

    if (!entry) {
      return res.status(404).json({
        message: 'New Hire entry not found'
      });
    }

    return res.json({
      message: 'New Hire form updated successfully',
      data: entry
    });
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
    const userId = req.user.id;

    const entry = await NewHire.findOneAndDelete({ _id: id, userId });

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
