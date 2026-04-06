import { Router } from 'express';
import { createChannel, removeChannel, getChannels } from '../controllers/server/channelController';

const router = Router();

router.post('/', createChannel);
router.delete('/', removeChannel);
router.get('/', getChannels);


export default router;