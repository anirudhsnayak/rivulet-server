import { Request, Response, NextFunction } from 'express';
import { createLogger, Verbosity } from '../../config/debug';
import { createMessageDB } from '../../db/rivulet-main/messageDatabase';
import { getMessagesByChannelIdDB } from '../../db/rivulet-main/messageDatabase';

const logger = createLogger("messageController", "controller");

export async function createMessage(req : Request, res: Response, next: NextFunction) {
    try {
        const { serverId, channelId, messageText } = req.body;
        const userId = req.session.userId;
        if (!userId) {
            logger.log(`Error: attempted to create message without a logged in user.`, Verbosity.HIGH);
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const newMessage = await createMessageDB(serverId, channelId, userId, messageText);
        logger.log(`Message created: ${JSON.stringify(newMessage)}`, Verbosity.MEDIUM);
        res.status(200).json({ message: newMessage });
    }
    catch (error) {
        logger.log(`Error creating message: ${error}`, Verbosity.LOW);
        next(error);
    }
}

export async function getMessagesByChannelId(req: Request, res: Response, next: NextFunction) {
    try {
        const serverId = parseInt(req.query.serverId as string);
        const channelId = parseInt(req.query.channelId as string);
        if (isNaN(serverId) || isNaN(channelId)) {
            logger.log(`Error: invalid server ID or channel ID.`, Verbosity.HIGH);
            return res.status(400).json({ message: 'Invalid server ID or channel ID' });
        }  
        const messages = await getMessagesByChannelIdDB(serverId, channelId);
        logger.log(`Messages retrieved for server ID: ${serverId}, channel ID: ${channelId}`, Verbosity.MEDIUM);
        res.status(200).json({ messages: messages });
    }
    catch (error) {
        logger.log(`Error retrieving messages: ${error}`, Verbosity.LOW);
        next(error);
    }
}