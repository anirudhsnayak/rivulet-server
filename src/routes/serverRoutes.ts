
import { Router } from 'express';
import { createServer } from '../controllers/server/serverController';

const router = Router();
router.post('/', createServer);
export default router;