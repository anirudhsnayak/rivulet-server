import { Request, Response, NextFunction } from 'express';
import { getServersByUserId } from '../db/server/serverDatabase';

export async function getUserModel(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.session.userId
        if (!userId) return res.status(401).json({ message: 'User not authenticated' });
        console.log(`Fetching user model for user id: ${userId}`);

        const servers = await getServersByUserId(userId);
        if (!servers) return res.status(404).json({ message: 'No servers found for this user' });
        req.session.currentServerId = servers.length > 0 ? servers[0].server_id : undefined;

        res.status(200).json({ servers: servers });
    } catch (error) {
        next(error);
    }
}