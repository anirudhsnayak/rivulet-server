import { Request, Response, NextFunction } from 'express';
import { getMembersInServerDB } from '../../db/rivulet-main/memberDatabase';
import { createLogger, Verbosity } from '../../config/debug';

const logger = createLogger("memberController", "controller");

export async function getMembersInServer(req: Request, res: Response, next: NextFunction) {
    try {
        const serverId = parseInt(req.query.serverId as string);
        if (isNaN(serverId)){
            logger.log(`Error: invalid server ID.`, Verbosity.HIGH);
            return res.status(400).json({ message: 'Invalid server ID' });
        }
        const members = await getMembersInServerDB(serverId);
        logger.log(`Members retrieved for server ID: ${serverId}`, Verbosity.MEDIUM);
        res.status(200).json({ members: members });
    } catch (error) {
        logger.log(`Error retrieving members: ${error}`, Verbosity.LOW);
        next(error);
    }
}