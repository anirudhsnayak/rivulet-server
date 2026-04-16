import { Request, Response, NextFunction } from 'express';
import { createLogger, Verbosity } from '../../config/debug';
import { createInviteCodeDB, createServerDB, getInviteCodeByServerIdDB, getServersByUserIdDB, joinServerByInviteCodeDB} from "../../db/rivulet-main/serverDatabase";

const logger = createLogger("serverController", "controller");

export async function createServer(req: Request, res: Response, next: NextFunction) {
    if (!req.session.userId) {
        logger.log(`Error: attempted to create server without a logged in user.`, Verbosity.HIGH);
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        // Implementation for creating a server
        const { serverName } = req.body;
        const ownerId = req.session.userId;
        
        // Call database function to create server  
        const newServer = await createServerDB(serverName, ownerId);
        const userServers = await getServersByUserIdDB(ownerId);
        res.status(200).json({ servers: userServers, created_server_id: newServer.server_id });
        logger.log(`Server created: ${JSON.stringify(newServer)}`, Verbosity.MEDIUM);
    } catch (error) {
        logger.log(`Error creating server: ${error}`, Verbosity.LOW);
        next(error);
    }
}

export async function joinServerFromInvite(req: Request, res: Response, next: NextFunction) {
    logger.log(`Received request to join server from invite: ${JSON.stringify(req.body)}`, Verbosity.MEDIUM);
    if (!req.session.userId) {
        logger.log(`Error: attempted to join server without a logged in user.`, Verbosity.HIGH);
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {        // Implementation for joining a server from an invite
        const { invite_code } = req.body;
        const userId = req.session.userId;
        
        // Call database function to join server using invite code
        const joinedServer = await joinServerByInviteCodeDB(invite_code, userId);
        const userServers = await getServersByUserIdDB(userId);
        res.status(200).json({ servers: userServers });
        logger.log(`User ${userId} joined server: ${JSON.stringify(joinedServer)}`, Verbosity.MEDIUM);
    } catch (error) {
        logger.log(`Error joining server: ${error}`, Verbosity.LOW);
        next(error);
    }
}

function generateRandomInviteCode(length: number = 16): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    return result;
}

export async function getServerInviteCode(req: Request, res: Response, next: NextFunction) {
    if (!req.session.userId) {
        logger.log(`Error: attempted to get invite code without a logged in user.`, Verbosity.HIGH);
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const { serverId } = req.body;
        if (isNaN(serverId)) {
            logger.log(`Error: invalid server ID.`, Verbosity.HIGH);
            return res.status(400).json({ message: 'Invalid server ID' });
        }
        const inviteCode = await getInviteCodeByServerIdDB(serverId);
        if(!inviteCode) {
            const newInviteCode = generateRandomInviteCode(16);
            await createInviteCodeDB(serverId, newInviteCode);
            res.status(200).json({ inviteCode: newInviteCode });
            logger.log(`Generated new invite code for server ID ${serverId}: ${newInviteCode}`, Verbosity.MEDIUM);
            return;
        }
        res.status(200).json({ inviteCode: inviteCode });
        logger.log(`Retrieved invite code for server ID ${serverId}: ${inviteCode}`, Verbosity.MEDIUM);
    } catch (error) {
        logger.log(`Error generating invite code: ${error}`, Verbosity.LOW);
        next(error);
    }
}