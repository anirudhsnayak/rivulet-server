
import { Router } from 'express';
import { createServer, getServerInviteCode, joinServerFromInvite, leaveServer } from '../controllers/rivulet-main/serverController';

const router = Router();
router.post('/', createServer);
router.post('/join', joinServerFromInvite);
router.post('/invite', getServerInviteCode);
router.post('/leave', leaveServer);
export default router;