import mongoose from "mongoose";

const statusSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  key: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  color: {
    type: String,
    default: "bg-gray-100 text-gray-800",
  },
  order: {
    type: Number,
    default: 0,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  employer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: function() {
      return !this.isDefault;
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamps on save
statusSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Generate key from name if not provided
statusSchema.pre("save", function (next) {
  if (!this.key) {
    this.key = this.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }
  next();
});

const Status = mongoose.model("Status", statusSchema);

export default Status;