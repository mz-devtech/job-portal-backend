import mongoose from 'mongoose';

const savedCandidateSchema = new mongoose.Schema({
  employer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  savedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Ensure unique save per employer-candidate pair
savedCandidateSchema.index({ employer: 1, candidate: 1 }, { unique: true });

// Index for faster queries
savedCandidateSchema.index({ employer: 1, savedAt: -1 });
savedCandidateSchema.index({ candidate: 1 });

const SavedCandidate = mongoose.model('SavedCandidate', savedCandidateSchema);

export default SavedCandidate;