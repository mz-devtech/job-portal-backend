import stripe from '../config/stripe.js';
import Plan from '../models/Plan.js';
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';

// @desc    Create payment intent
// @route   POST /api/payments/create-intent
// @access  Private
export const createPaymentIntent = async (req, res) => {
  try {
    const { planId, amount, currency = 'usd', billingCycle = 'monthly' } = req.body;
    const userId = req.user.id;

    console.log('💳 [PAYMENT] Creating payment intent:', { planId, amount, currency, billingCycle });

    // Get plan details
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
    }

    // Check if plan is active
    if (!plan.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This plan is not available',
      });
    }

    // Validate amount matches plan price
    const expectedAmount = billingCycle === 'monthly' ? plan.price : (plan.priceYearly || plan.price * 12);
    if (amount !== expectedAmount) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount',
      });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        planId: plan._id.toString(),
        planName: plan.name,
        userId: userId.toString(),
        billingCycle,
      },
    });

    console.log('✅ [PAYMENT] Payment intent created:', paymentIntent.id);

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('❌ [PAYMENT] Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Confirm payment and create subscription
// @route   POST /api/payments/confirm
// @access  Private
export const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const userId = req.user.id;

    console.log('✅ [PAYMENT] Confirming payment:', paymentIntentId);

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment not successful',
      });
    }

    // Get metadata
    const { planId, billingCycle } = paymentIntent.metadata;

    // Get plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
    }

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date();
    
    if (billingCycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Create subscription in database
    const subscription = await Subscription.create({
      user: userId,
      plan: planId,
      planName: plan.name,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      billingCycle,
      status: 'active',
      startDate,
      endDate,
      paymentIntentId: paymentIntent.id,
      paymentMethod: 'card',
      metadata: paymentIntent.metadata,
    });

    // Update user with subscription
    await User.findByIdAndUpdate(userId, {
      subscription: subscription._id,
      subscriptionStatus: 'active',
      subscriptionEndDate: endDate,
    });

    console.log('✅ [PAYMENT] Subscription created:', subscription._id);

    res.status(201).json({
      success: true,
      message: 'Payment confirmed and subscription created',
      subscription,
    });
  } catch (error) {
    console.error('❌ [PAYMENT] Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Get saved cards
// @route   GET /api/payments/cards
// @access  Private
export const getSavedCards = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('💳 [PAYMENT] Fetching saved cards for user:', userId);

    // Get user's Stripe customer ID
    const user = await User.findById(userId);
    
    if (!user.stripeCustomerId) {
      return res.status(200).json({
        success: true,
        cards: [],
      });
    }

    // Retrieve payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
    });

    const cards = paymentMethods.data.map(pm => ({
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
      isDefault: pm.metadata?.isDefault === 'true',
    }));

    console.log('✅ [PAYMENT] Saved cards fetched:', cards.length);

    res.status(200).json({
      success: true,
      cards,
    });
  } catch (error) {
    console.error('❌ [PAYMENT] Get saved cards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch saved cards',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Save card for future use
// @route   POST /api/payments/cards
// @access  Private
// @desc    Save card for future use
// @route   POST /api/payments/cards
// @access  Private
export const saveCard = async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    const userId = req.user.id;

    console.log('💳 [PAYMENT] Saving card for user:', userId);
    console.log('💳 [PAYMENT] PaymentMethod ID:', paymentMethodId);

    // Get user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Create Stripe customer if not exists
    if (!user.stripeCustomerId) {
      console.log('🆕 [PAYMENT] Creating new Stripe customer for user:', user.email);
      
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || user.username || user.email,
        metadata: {
          userId: userId.toString(),
        },
      });

      user.stripeCustomerId = customer.id;
      await user.save();
      
      console.log('✅ [PAYMENT] Stripe customer created:', customer.id);
    }

    try {
      // First, check if payment method is already attached to a customer
      try {
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
        console.log('💳 [PAYMENT] Payment method retrieved:', paymentMethod.id);
        console.log('💳 [PAYMENT] Currently attached to customer:', paymentMethod.customer);
        
        // If already attached to this customer, just set as default if needed
        if (paymentMethod.customer === user.stripeCustomerId) {
          console.log('✅ [PAYMENT] Card already attached to customer');
          
          // Set as default payment method
          await stripe.customers.update(user.stripeCustomerId, {
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          });
          
          return res.status(200).json({
            success: true,
            message: 'Card already saved and set as default',
            card: {
              id: paymentMethod.id,
              brand: paymentMethod.card.brand,
              last4: paymentMethod.card.last4,
              exp_month: paymentMethod.card.exp_month,
              exp_year: paymentMethod.card.exp_year,
            },
          });
        }
        
        // If attached to another customer, cannot use it
        if (paymentMethod.customer && paymentMethod.customer !== user.stripeCustomerId) {
          return res.status(400).json({
            success: false,
            message: 'This card is already saved to another account',
          });
        }
      } catch (retrieveError) {
        // Payment method might be expired or invalid
        console.log('⚠️ [PAYMENT] Could not retrieve payment method:', retrieveError.message);
      }

      // Attach payment method to customer
      console.log('📎 [PAYMENT] Attaching payment method to customer:', user.stripeCustomerId);
      
      const attachedPaymentMethod = await stripe.paymentMethods.attach(
        paymentMethodId,
        {
          customer: user.stripeCustomerId,
        }
      );

      console.log('✅ [PAYMENT] Payment method attached successfully');

      // Set as default payment method
      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      console.log('✅ [PAYMENT] Default payment method set');

      res.status(200).json({
        success: true,
        message: 'Card saved successfully',
        card: {
          id: attachedPaymentMethod.id,
          brand: attachedPaymentMethod.card.brand,
          last4: attachedPaymentMethod.card.last4,
          exp_month: attachedPaymentMethod.card.exp_month,
          exp_year: attachedPaymentMethod.card.exp_year,
        },
      });
      
    } catch (stripeError) {
      console.error('❌ [PAYMENT] Stripe error:', stripeError);
      
      // Handle specific Stripe errors
      if (stripeError.code === 'resource_missing') {
        return res.status(400).json({
          success: false,
          message: 'Payment method not found or expired',
        });
      }
      
      if (stripeError.code === 'payment_method_unexpected_state') {
        return res.status(400).json({
          success: false,
          message: 'This payment method cannot be saved',
        });
      }
      
      throw stripeError;
    }
  } catch (error) {
    console.error('❌ [PAYMENT] Save card error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save card',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Delete saved card
// @route   DELETE /api/payments/cards/:cardId
// @access  Private
export const deleteCard = async (req, res) => {
  try {
    const { cardId } = req.params;
    const userId = req.user.id;

    console.log('🗑️ [PAYMENT] Deleting card:', cardId);

    // Get user
    const user = await User.findById(userId);

    if (!user.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Detach payment method from customer
    await stripe.paymentMethods.detach(cardId);

    console.log('✅ [PAYMENT] Card deleted successfully');

    res.status(200).json({
      success: true,
      message: 'Card deleted successfully',
    });
  } catch (error) {
    console.error('❌ [PAYMENT] Delete card error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete card',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Stripe webhook handler
// @route   POST /api/payments/webhook
// @access  Public
export const stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ [WEBHOOK] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('✅ [WEBHOOK] Received event:', event.type);

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('💰 [WEBHOOK] PaymentIntent succeeded:', paymentIntent.id);
      break;
      
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('❌ [WEBHOOK] PaymentIntent failed:', failedPayment.id);
      break;
      
    case 'customer.subscription.updated':
      const subscription = event.data.object;
      console.log('🔄 [WEBHOOK] Subscription updated:', subscription.id);
      break;
      
    case 'customer.subscription.deleted':
      const canceledSubscription = event.data.object;
      console.log('🛑 [WEBHOOK] Subscription canceled:', canceledSubscription.id);
      break;
      
    default:
      console.log(`ℹ️ [WEBHOOK] Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
};

