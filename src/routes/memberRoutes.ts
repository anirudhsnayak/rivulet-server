import { Router } from 'express';
import { getMembersInServer } from '../controllers/rivulet-main/memberController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', requireAuth, getMembersInServer);

export default router;