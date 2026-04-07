import { Router } from 'express';
import { createMessage } from '../controllers/server/messageController';

const router = Router();

router.post('/', createMessage);

export default router;