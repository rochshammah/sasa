import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Validate JWT_SECRET exists
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable must be set');
}

const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function generateToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
