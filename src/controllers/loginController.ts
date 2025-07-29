import { Request, Response, NextFunction } from 'express';
import { checkLoginValidity } from '../db/login';

export async function login(req: Request, res: Response, next: NextFunction) {
    try {
        const { username, hash } = req.body;
        const isValid = await checkLoginValidity(username, hash);
        
        if (isValid) {
        res.status(200).json({ message: 'Login successful' });
        } else {
        res.status(401).json({ message: 'Invalid username or password' });
        }
    } catch (error) {
        next(error);
    }
}
