import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true,
  },
  planName: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'usd',
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'past_due'],
    default: 'active',
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  cancelledAt: {
    type: Date,
  },
  paymentIntentId: {
    type: String,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'paypal'],
    default: 'card',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
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
subscriptionSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Check if subscription is active
subscriptionSchema.methods.isActive = function () {
  return this.status === 'active' && this.endDate > new Date();
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;