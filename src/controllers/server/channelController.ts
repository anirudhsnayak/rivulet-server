import { Request, Response, NextFunction } from 'express';
import { createChannelDB, removeChannelDB } from '../../db/server/channelDatabase';
import { createLogger, Verbosity } from "../../config/debug"
import { log } from 'console';

const logger = createLogger("channelController", "controller");

export async function createChannel(req: Request, res: Response, next: NextFunction) {
    try {
        const { channelName, serverId } = req.body;
        let response = await createChannelDB(channelName, serverId);
        logger.log(`Channel created: ${JSON.stringify(response)}`, Verbosity.MEDIUM);
        if (!response) return res.status(500).json({ message: 'Channel creation failed' });
        res.status(200).json({ channel: response });
    } catch (error) {
        logger.log(`Error creating channel: ${error}`, Verbosity.LOW);
        next(error);
    }
}

//TODO: make this a delete request with params
export async function removeChannel(req: Request, res: Response, next: NextFunction) {
    try {
        const { serverId, channelId } = req.body;
        let response = await removeChannelDB(channelId, serverId);
        logger.log(`Channel removed: ${JSON.stringify(response)}`, Verbosity.MEDIUM);
        if (!response) return res.status(500).json({ message: 'Channel removal failed' });
        res.status(200).json({ channel: response });
    } catch (error) {
        logger.log(`Error removing channel: ${error}`, Verbosity.LOW);
        next(error);
    }
}