import { Router } from 'express';
import { getMembersInServer } from '../controllers/rivulet-main/memberController';


const router = Router();

router.get('/', getMembersInServer);

export default router;