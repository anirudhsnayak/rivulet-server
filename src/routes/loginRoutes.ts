import { Router } from 'express';
import { login } from '../controllers/accountController';

const router = Router();

router.post('/', login);

export default router;