import { Router } from 'express';
import { login } from '../controllers/accountController';
import { signup } from '../controllers/accountController';

const router = Router();

router.post('/login', login);
router.post('/signup', signup);

export default router;