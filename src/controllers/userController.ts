import { Request, Response, NextFunction } from 'express';
import { getServersByUserId } from '../db/serverDatabase';

export async function getUserModel(req: Request, res: Response, next: NextFunction) {
    try {
        const { userId } = req.body;
        const servers = await getServersByUserId(userId);
        if (!servers) {
            return res.status(404).json({ message: 'No servers found for this user' });
        }
        res.status(200).json({ servers });
    } catch (error) {
        next(error);
    }
}