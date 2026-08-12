import { Request, Response, NextFunction } from 'express';
import { loginAccount, createAccount, getUserId } from '../db/accountDatabase';
import { Verbosity, createLogger} from "../config/debug"
import { streams } from '../sse/streams';
import { text, fail } from '../services/permissions';

function credentials(body: any) {
    text(body?.username, 50);
    if (typeof body?.hash !== 'string' || !/^[a-f0-9]{64}$/i.test(body.hash)) fail(400, 'Expected a SHA-256 hash');
}
async function startSession(req: Request, userId: number) {
    const previousSessionId = req.sessionID;
    await new Promise<void>((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    await streams.disconnectSession(previousSessionId);
    req.session.userId = userId;
    await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
}

const logger = createLogger("accountController", "controller");

export async function login(req: Request, res: Response, next: NextFunction) {
    try {
        credentials(req.body);
        const { username, hash } = req.body;
        const isValid = await loginAccount(username, hash);
        
        if (isValid) {
            await startSession(req, await getUserId(username));
            logger.log(`User ${username} logged in with id ${req.session.userId}`, Verbosity.MEDIUM);
            res.status(200).json({ message: 'Login successful' });
        } else {
            logger.log(`Invalid username or password for user: ${username}`, Verbosity.LOW);
            res.status(401).json({ message: 'Invalid username or password' });
        }
    } catch (error) {
        logger.log(`Error during login: ${error}`, Verbosity.LOW);
        next(error);
    }
}

export async function signup(req: Request, res: Response, next: NextFunction) {
    try {
        credentials(req.body);
        const { username, hash } = req.body;
        logger.log(`Received signup request from ${username}`, Verbosity.MEDIUM);
        const isValid = await createAccount(username, hash);
        logger.log(`Account creation for ${username} returned ${isValid}`, Verbosity.HIGH);
        if (isValid) {
            await startSession(req, await getUserId(username));
            logger.log(`User ${username} signed up with id ${req.session.userId}`, Verbosity.MEDIUM);
            res.status(200).json({ message: 'Signup successful' });
        } else {
            logger.log(`Error creating account for user: ${username}`, Verbosity.LOW);
            res.status(401).json({ message: 'Invalid username or password' }); 
        }
    } catch (error) {
        logger.log(`Error during signup: ${error}`, Verbosity.LOW);
        next(error);
    }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
    try {
        const sessionId = req.sessionID;
        await new Promise<void>((resolve, reject) => req.session.destroy(err => err ? reject(err) : resolve()));
        await streams.disconnectSession(sessionId);
        res.clearCookie('connect.sid');
        logger.log(`User logged out successfully`, Verbosity.MEDIUM);
        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        logger.log(`Error during logout: ${error}`, Verbosity.LOW);
        next(error);
    }
}
