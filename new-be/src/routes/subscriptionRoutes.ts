import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import {
  createSubscription,
  deleteSubscriptionDetail,
  generateSubscriptionDokuPaymentLink,
  generateSubscriptionInvoice,
  handleSubscriptionDokuCallbackResult,
  handleSubscriptionDokuNotification,
  listSubscription,
  listSubscriptionDetail,
  lunasiSubscriptionDetail,
  updateSubscriptionDetailStatus,
  updateSubscriptionDetail,
} from '../controllers/subscriptionController';

const router = Router();

router.get('/doku/result', handleSubscriptionDokuCallbackResult);
router.post('/doku/notify', handleSubscriptionDokuNotification);

router.use(authenticate);

router.get('/', listSubscription);
router.post('/', createSubscription);
router.get('/detail', listSubscriptionDetail);
router.patch('/detail/:id', updateSubscriptionDetail);
router.delete('/detail/:id', deleteSubscriptionDetail);
router.patch('/detail/:id/status', updateSubscriptionDetailStatus);
router.post('/detail/:id/invoice/generate', generateSubscriptionInvoice);
router.post('/detail/:id/doku/payment-link', generateSubscriptionDokuPaymentLink);
router.patch('/detail/:id/lunas', lunasiSubscriptionDetail);

export default router;
