import { Router } from 'express';
import { createMessage, getMessagesByChannelId } from '../controllers/rivulet-main/messageController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

router.post('/', requireAuth, createMessage);
router.get('/', requireAuth, getMessagesByChannelId);

export default router;