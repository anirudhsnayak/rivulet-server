import { Request, Response, NextFunction } from 'express';
import { createLogger, Verbosity } from '../../config/debug';
import { createMessageDB } from '../../db/server/messageDatabase';

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