import { Router } from 'express';
import { createMessage, getMessagesByChannelId } from '../controllers/rivulet-main/messageController';

const router = Router();

router.post('/', createMessage);
router.get('/', getMessagesByChannelId);

export default router;