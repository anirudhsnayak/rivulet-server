
import { Router } from 'express';
import { createServer } from '../controllers/rivulet-main/serverController';

const router = Router();
router.post('/', createServer);
export default router;