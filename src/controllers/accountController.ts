import { Request, Response, NextFunction } from 'express';
import { loginAccount, createAccount, getUserId } from '../db/accountDatabase';
import { Verbosity, createLogger} from "../config/debug"
import { log } from 'console';

const logger = createLogger("accountController", "controller");

export async function login(req: Request, res: Response, next: NextFunction) {
    try {
        const { username, hash } = req.body;
        const isValid = await loginAccount(username, hash);
        
        if (isValid) {
            req.session.userId = await getUserId(username);
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
        const { username, hash } = req.body;
        logger.log(`Received signup request from ${username}`, Verbosity.MEDIUM);
        const isValid = await createAccount(username, hash);
        logger.log(`Account creation for ${username} returned ${isValid}`, Verbosity.HIGH);
        if (isValid) {
            req.session.userId = await getUserId(username);
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
