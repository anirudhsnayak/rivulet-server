import { Router } from 'express';
import { getUserModel } from '../controllers/userController';

const router = Router();

//TODO: make this a get request with params
router.post('/', getUserModel);

export default router;