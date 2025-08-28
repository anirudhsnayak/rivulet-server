import { Router } from 'express';
import { handleSse } from '../sse/sseHandler';

const router = Router();

router.get('/events', handleSse);

export default router;