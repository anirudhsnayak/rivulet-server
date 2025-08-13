import { Router } from 'express';
import { getUserModel } from '../controllers/userController';

const router = Router();

router.post('/', getUserModel);

export default router;