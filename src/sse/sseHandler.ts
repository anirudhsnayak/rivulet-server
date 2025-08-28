import { Request, Response } from 'express';

export async function handleSse(req: Request, res: Response) {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });
    res.flushHeaders();

    const sendEvent = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent({ message: 'Connected to SSE' });

    const keepAliveInterval = setInterval(() => {
        res.write(': keep-alive\n\n');
    }, 15000);

    req.on('close', () => {
        clearInterval(keepAliveInterval);
        console.log('SSE connection closed');
    });

    // For demonstration, send a test event every 10 seconds
    const testEventInterval = setInterval(() => {
        sendEvent({ timestamp: new Date().toISOString() });
    }, 10000);

    req.on('close', () => {
        clearInterval(testEventInterval);
    });
}