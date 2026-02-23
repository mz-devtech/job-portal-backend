import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  cancelSubscription,
  checkSubscriptionStatus,
} from '../controllers/subscriptionController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.get('/', getSubscriptions);
router.get('/status', checkSubscriptionStatus);
router.post('/', createSubscription);
router.get('/:id', getSubscriptionById);
router.put('/:id/cancel', cancelSubscription);

export default router;