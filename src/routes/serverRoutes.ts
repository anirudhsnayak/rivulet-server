
import { Router } from 'express';
import { createServer, getServerInviteCode, joinServerFromInvite } from '../controllers/rivulet-main/serverController';

const router = Router();
router.post('/', createServer);
router.post('/join', joinServerFromInvite);
router.post('/invite', getServerInviteCode);
export default router;