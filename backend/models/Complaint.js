const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: 1000
  },
  category: {
    type: String,
    required: true,
    enum: ['pothole', 'road_damage', 'electricity', 'water_shortage', 'drainage', 'streetlight', 'garbage', 'other']
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'rejected'],
    default: 'pending'
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    address: {
      type: String,
      trim: true
    },
    ward: String,
    city: String,
    state: String
  },
  images: [{
    data: String, // base64
    contentType: String
  }],
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  municipalityNotes: {
    type: String,
    trim: true
  },
  resolvedAt: Date,
  // Citizen verification votes
  workDoneVotes: {
    yes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    no: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  // Work completion status based on votes
  workVerificationStatus: {
    type: String,
    enum: ['pending', 'verified_done', 'not_done'],
    default: 'pending'
  },
  upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  complaintId: {
    type: String,
    unique: true
  }
}, {
  timestamps: true
});

// Create 2dsphere index for geospatial queries
complaintSchema.index({ location: '2dsphere' });
complaintSchema.index({ status: 1, createdAt: -1 });
complaintSchema.index({ category: 1 });

// Auto-generate complaint ID
complaintSchema.pre('save', async function(next) {
  if (!this.complaintId) {
    const count = await mongoose.model('Complaint').countDocuments();
    const categoryCode = {
      pothole: 'POT', road_damage: 'RD', electricity: 'ELC',
      water_shortage: 'WTR', drainage: 'DRN', streetlight: 'SL',
      garbage: 'GRB', other: 'OTH'
    };
    const prefix = categoryCode[this.category] || 'CMP';
    this.complaintId = `${prefix}-${Date.now()}-${String(count + 1).padStart(4, '0')}`;
  }
  // Auto-update workVerificationStatus based on votes
  if (this.workDoneVotes) {
    const yesCount = this.workDoneVotes.yes.length;
    const noCount = this.workDoneVotes.no.length;
    const total = yesCount + noCount;
    if (total >= 3) {
      this.workVerificationStatus = yesCount > noCount ? 'verified_done' : 'not_done';
    }
  }
  next();
});

module.exports = mongoose.model('Complaint', complaintSchema);
