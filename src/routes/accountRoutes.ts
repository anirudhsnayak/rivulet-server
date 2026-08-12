import { Router } from 'express';
import { login, signup, logout } from '../controllers/accountController';
import { requireAuth } from '../middlewares/authMiddleware';
import DB from '../client/DatabaseClient';

const router = Router();

router.post('/login', login);
router.post('/signup', signup);
router.post('/logout', logout);
router.get('/session', requireAuth, async (req, res) => {
    const user = (await DB.query('SELECT user_id,username FROM users WHERE user_id=$1', [req.session.userId])).rows[0];
    if (!user) { res.status(401).json({ message: 'Session user no longer exists' }); return; }
    res.json(user);
});

export default router;
