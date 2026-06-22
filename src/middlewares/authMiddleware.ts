import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that requires an authenticated session.
 * Returns 401 if `req.session.userId` is not set.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    if (!req.session.userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    next();
}
