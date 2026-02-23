import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  createPaymentIntent,
  confirmPayment,
  getSavedCards,
  saveCard,
  deleteCard,
  stripeWebhook,
} from '../controllers/paymentController.js';

const router = express.Router();

// Public webhook endpoint (no auth)
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// Protected routes
router.use(protect);

// Payment intent
router.post('/create-intent', createPaymentIntent);
router.post('/confirm', confirmPayment);

// Card management
router.get('/cards', getSavedCards);
router.post('/cards', saveCard);
router.delete('/cards/:cardId', deleteCard);


export default router;