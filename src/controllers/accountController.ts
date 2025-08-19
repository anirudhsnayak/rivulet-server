import { Request, Response, NextFunction } from 'express';
import { loginAccount, createAccount, getUserId } from '../db/accountDatabase';

export async function login(req: Request, res: Response, next: NextFunction) {
    try {
        const { username, hash } = req.body;
        const isValid = await loginAccount(username, hash);
        
        if (isValid) {
            res.status(200).json({ message: 'Login successful' });
        
        } else {
            res.status(401).json({ message: 'Invalid username or password' });
        }
    } catch (error) {
        next(error);
    }
}

export async function signup(req: Request, res: Response, next: NextFunction) {
    try {
        const { username, hash } = req.body;
        const isValid = await createAccount(username, hash);
        
        if (isValid) {
            req.session.userId = await getUserId(username);
            res.status(200).json({ message: 'Signup successful' });
        } else {
            res.status(401).json({ message: 'Invalid username or password' }); 
        }
    } catch (error) {
        next(error);
    }
}
