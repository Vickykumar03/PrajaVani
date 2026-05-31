const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const { protect, restrictTo } = require('../middleware/auth');

// Get sort filter helper
const getSortOrder = (filter) => {
  switch (filter) {
    case 'recent': return { createdAt: -1 };
    case 'earlier': return { createdAt: 1 };
    case 'long': return { updatedAt: 1 }; // oldest unresolved
    default: return { createdAt: -1 };
  }
};

// GET all complaints (public board)
router.get('/', async (req, res) => {
  try {
    const { filter = 'recent', category, status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (category) query.category = category;
    if (status) query.status = status;
    const sort = getSortOrder(filter);
    const complaints = await Complaint.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('reportedBy', 'name ward')
      .lean();
    const total = await Complaint.countDocuments(query);
    res.json({ success: true, complaints, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single complaint
router.get('/:id', async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('reportedBy', 'name ward email')
      .lean();
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    res.json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create complaint
router.post('/', protect, async (req, res) => {
  try {
    const { title, description, category, severity, location, images } = req.body;
    if (!location || !location.coordinates || location.coordinates.length !== 2) {
      return res.status(400).json({ success: false, message: 'Valid location coordinates are required.' });
    }
    const complaint = await Complaint.create({
      title, description, category, severity,
      location: {
        type: 'Point',
        coordinates: location.coordinates,
        address: location.address,
        ward: location.ward,
        city: location.city,
        state: location.state
      },
      images: images || [],
      reportedBy: req.user._id,
      workDoneVotes: { yes: [], no: [] }
    });
    await complaint.populate('reportedBy', 'name ward');
    res.status(201).json({ success: true, message: 'Complaint filed successfully!', complaint });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST upvote complaint
router.post('/:id/upvote', protect, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    const userId = req.user._id;
    const alreadyUpvoted = complaint.upvotes.includes(userId);
    if (alreadyUpvoted) {
      complaint.upvotes.pull(userId);
    } else {
      complaint.upvotes.push(userId);
    }
    await complaint.save();
    res.json({ success: true, upvotes: complaint.upvotes.length, upvoted: !alreadyUpvoted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST vote on work done (citizens only)
router.post('/:id/vote-work', protect, restrictTo('citizen'), async (req, res) => {
  try {
    const { vote } = req.body; // 'yes' or 'no'
    if (!['yes', 'no'].includes(vote)) {
      return res.status(400).json({ success: false, message: 'Vote must be yes or no.' });
    }
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    if (complaint.status !== 'resolved') {
      return res.status(400).json({ success: false, message: 'Can only vote on resolved complaints.' });
    }
    const userId = req.user._id;
    // Remove from both arrays first
    complaint.workDoneVotes.yes.pull(userId);
    complaint.workDoneVotes.no.pull(userId);
    // Add new vote
    complaint.workDoneVotes[vote].push(userId);
    // Update verification status
    const yesCount = complaint.workDoneVotes.yes.length;
    const noCount = complaint.workDoneVotes.no.length;
    const total = yesCount + noCount;
    if (total >= 1) {
      complaint.workVerificationStatus = yesCount > noCount ? 'verified_done' : 'not_done';
    }
    await complaint.save();
    res.json({
      success: true,
      message: 'Vote recorded!',
      workVerificationStatus: complaint.workVerificationStatus,
      votes: { yes: yesCount, no: noCount }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET my complaints
router.get('/my/list', protect, async (req, res) => {
  try {
    const { filter = 'recent' } = req.query;
    const sort = getSortOrder(filter);
    const complaints = await Complaint.find({ reportedBy: req.user._id })
      .sort(sort)
      .lean();
    res.json({ success: true, complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
