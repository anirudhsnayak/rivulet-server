import { Request, Response, NextFunction } from 'express';
import { createChannelDB, removeChannelDB, getChannelsByServerIdDB } from '../../db/rivulet-main/channelDatabase';
import { createLogger, Verbosity } from "../../config/debug"

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

export async function getChannels(req: Request, res: Response, next: NextFunction) {
    //only obtaining by server id for now, can add other query params later if needed
    try {
        const serverId = req.query.serverId as string;
        if (!serverId) return res.status(400).json({ message: 'Server ID is required' });
        const channels = await getChannelsByServerIdDB(parseInt(serverId));
        logger.log(`Channels retrieved for server ID ${serverId}`, Verbosity.MEDIUM);
        res.status(200).json({ channels: channels });
    } catch (error) {
        logger.log(`Error retrieving channels: ${error}`, Verbosity.LOW);
        next(error);
    }
}