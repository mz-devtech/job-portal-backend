import Subscription from '../models/Subscription.js';
import Plan from '../models/Plan.js';
import User from '../models/User.js';
import stripe from '../config/stripe.js';

// @desc    Get user subscriptions
// @route   GET /api/subscriptions
// @access  Private
export const getSubscriptions = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('📋 [SUBSCRIPTION] Fetching subscriptions for user:', userId);

    const subscriptions = await Subscription.find({ user: userId })
      .populate('plan')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    console.error('❌ [SUBSCRIPTION] Get subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Get single subscription
// @route   GET /api/subscriptions/:id
// @access  Private
export const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const subscription = await Subscription.findOne({
      _id: id,
      user: userId,
    }).populate('plan');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
    }

    res.status(200).json({
      success: true,
      subscription,
    });
  } catch (error) {
    console.error('❌ [SUBSCRIPTION] Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Create subscription (after successful payment)
// @route   POST /api/subscriptions
// @access  Private
export const createSubscription = async (req, res) => {
  try {
    const {
      planId,
      paymentIntentId,
      amount,
      billingCycle,
    } = req.body;

    const userId = req.user.id;

    console.log('➕ [SUBSCRIPTION] Creating subscription:', { planId, paymentIntentId });

    // Get plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    
    if (billingCycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Check for existing active subscription
    const existingSubscription = await Subscription.findOne({
      user: userId,
      status: 'active',
      endDate: { $gt: new Date() },
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active subscription',
      });
    }

    // Create subscription
    const subscription = await Subscription.create({
      user: userId,
      plan: planId,
      planName: plan.name,
      amount,
      billingCycle,
      status: 'active',
      startDate,
      endDate,
      paymentIntentId,
      paymentMethod: 'card',
    });

    // Update user
    await User.findByIdAndUpdate(userId, {
      subscription: subscription._id,
      subscriptionStatus: 'active',
      subscriptionEndDate: endDate,
    });

    console.log('✅ [SUBSCRIPTION] Subscription created:', subscription._id);

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      subscription,
    });
  } catch (error) {
    console.error('❌ [SUBSCRIPTION] Create subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Cancel subscription
// @route   PUT /api/subscriptions/:id/cancel
// @access  Private
export const cancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log('🛑 [SUBSCRIPTION] Canceling subscription:', id);

    const subscription = await Subscription.findOne({
      _id: id,
      user: userId,
      status: 'active',
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Active subscription not found',
      });
    }

    // Update subscription
    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    await subscription.save();

    // Update user
    await User.findByIdAndUpdate(userId, {
      subscriptionStatus: 'cancelled',
    });

    console.log('✅ [SUBSCRIPTION] Subscription canceled:', id);

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      subscription,
    });
  } catch (error) {
    console.error('❌ [SUBSCRIPTION] Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Check subscription status
// @route   GET /api/subscriptions/status
// @access  Private
// @desc    Check subscription status
// @route   GET /api/subscriptions/status
// @access  Private
export const checkSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check for active subscription that hasn't expired
    const activeSubscription = await Subscription.findOne({
      user: userId,
      status: 'active',
      endDate: { $gt: new Date() },
    }).populate('plan');

    // Auto-update expired subscriptions
    if (!activeSubscription) {
      // Find any subscriptions that are marked active but have expired
      const expiredSubscriptions = await Subscription.find({
        user: userId,
        status: 'active',
        endDate: { $lte: new Date() },
      });

      if (expiredSubscriptions.length > 0) {
        // Update them to expired
        for (const sub of expiredSubscriptions) {
          sub.status = 'expired';
          await sub.save();
        }

        // Update user
        await User.findByIdAndUpdate(userId, {
          subscriptionStatus: 'expired',
        });
      }
    }

    res.status(200).json({
      success: true,
      hasActiveSubscription: !!activeSubscription,
      subscription: activeSubscription,
    });
  } catch (error) {
    console.error('❌ [SUBSCRIPTION] Check status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check subscription status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};