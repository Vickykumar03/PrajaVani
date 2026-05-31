const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const { protect, restrictTo } = require('../middleware/auth');

const getSortOrder = (filter) => {
  switch (filter) {
    case 'recent': return { createdAt: -1 };
    case 'earlier': return { createdAt: 1 };
    case 'long': return { createdAt: 1 }; // oldest first = longest pending
    default: return { createdAt: -1 };
  }
};

// GET municipality dashboard - all complaints with advanced filters
router.get('/dashboard', protect, restrictTo('municipality'), async (req, res) => {
  try {
    const { filter = 'recent', category, status, severity, page = 1, limit = 20 } = req.query;
    const query = {};
    if (category) query.category = category;
    if (status) query.status = status;
    if (severity) query.severity = severity;
    const sort = getSortOrder(filter);

    const complaints = await Complaint.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('reportedBy', 'name email phone ward')
      .lean();

    const total = await Complaint.countDocuments(query);

    // Stats
    const stats = await Complaint.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const categoryStats = await Complaint.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true, complaints, total,
      page: parseInt(page), pages: Math.ceil(total / limit),
      stats: stats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      categoryStats: categoryStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {})
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH update complaint status (municipality)
router.patch('/:id/status', protect, restrictTo('municipality'), async (req, res) => {
  try {
    const { status, municipalityNotes } = req.body;
    if (!['pending', 'in_progress', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    const update = { status, municipalityNotes };
    if (status === 'resolved') update.resolvedAt = new Date();
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('reportedBy', 'name email');
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    res.json({ success: true, message: `Status updated to ${status}`, complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET statistics
router.get('/stats', protect, restrictTo('municipality'), async (req, res) => {
  try {
    const totalComplaints = await Complaint.countDocuments();
    const pendingCount = await Complaint.countDocuments({ status: 'pending' });
    const inProgressCount = await Complaint.countDocuments({ status: 'in_progress' });
    const resolvedCount = await Complaint.countDocuments({ status: 'resolved' });
    const verifiedDone = await Complaint.countDocuments({ workVerificationStatus: 'verified_done' });
    const notDone = await Complaint.countDocuments({ workVerificationStatus: 'not_done' });

    const categoryBreakdown = await Complaint.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } } } }
    ]);

    res.json({
      success: true,
      stats: { totalComplaints, pendingCount, inProgressCount, resolvedCount, verifiedDone, notDone, categoryBreakdown }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
