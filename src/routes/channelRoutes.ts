import { Router } from 'express';
import { createChannel, removeChannel, getChannels } from '../controllers/rivulet-main/channelController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

router.post('/', requireAuth, createChannel);
router.delete('/', requireAuth, removeChannel);
router.get('/', requireAuth, getChannels);


export default router;