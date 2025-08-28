import { Request, Response, NextFunction } from 'express';
import { createChannelDB, removeChannelDB } from '../../db/server/channelDatabase';

export async function createChannel(req: Request, res: Response, next: NextFunction) {
    try {
        const { channelName, serverId } = req.body;
        let response = await createChannelDB(channelName, serverId);
        console.log('Channel created:', JSON.stringify(response));
        if (!response) return res.status(500).json({ message: 'Channel creation failed' });
        res.status(200).json({ channel: response });
    } catch (error) {
        next(error);
    }
}

//TODO: make this a delete request with params
export async function removeChannel(req: Request, res: Response, next: NextFunction) {
    try {
        const { serverId, channelId } = req.body;
        let response = await removeChannelDB(channelId, serverId);
        console.log('Channel removed:', JSON.stringify(response));
        if (!response) return res.status(500).json({ message: 'Channel removal failed' });
        res.status(200).json({ channel: response });
    } catch (error) {
        next(error);
    }
}