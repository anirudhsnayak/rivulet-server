import { Router } from 'express';
import { createChannel, removeChannel } from '../controllers/server/channelController';

const router = Router();

router.post('/', createChannel);
router.delete('/', removeChannel);

export default router;