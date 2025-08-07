import { Router } from 'express';
import { signup } from '../controllers/accountController';

const router = Router();

router.post('/', signup);

export default router;