import { Request, Response, NextFunction } from 'express';
import { createLogger, Verbosity } from '../../config/debug';
import { createServerDB, getServersByUserId } from "../../db/server/serverDatabase";

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
        const userServers = await getServersByUserId(ownerId);
        res.status(200).json({ servers: userServers, created_server_id: newServer.server_id });
        logger.log(`Server created: ${JSON.stringify(newServer)}`, Verbosity.MEDIUM);
    } catch (error) {
        logger.log(`Error creating server: ${error}`, Verbosity.LOW);
        next(error);
    }
}