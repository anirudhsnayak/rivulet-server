import { Request, Response, NextFunction } from 'express';
import { getServersByUserId } from '../db/serverDatabase';

export async function getUserModel(req: Request, res: Response, next: NextFunction) {
    try {
        const { userId } = req.session;
        console.log(`Fetching user model for user id: ${req.session.userId}`);
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const servers = await getServersByUserId(userId);
        if (!servers) {
            return res.status(404).json({ message: 'No servers found for this user' });
        }
        res.status(200).json({ servers: servers });
    } catch (error) {
        next(error);
    }
}