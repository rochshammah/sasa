// server/routes.ts

import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { authMiddleware, generateToken, type AuthRequest } from "./middleware/auth";
import { insertUserSchema, insertJobSchema, insertMessageSchema, insertRatingSchema } from "@shared/schema";
import { ZodError } from "zod";
import { eq, desc } from "drizzle-orm"; // Added for existing logic review

// Helper function to validate request body for a successful sign-up
function validateRole(role: string): role is 'requester' | 'provider' | 'admin' {
    return role === 'requester' || role === 'provider' || role === 'admin';
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time chat
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const clients = new Map<string, WebSocket>();

  wss.on('connection', (ws: WebSocket, req) => {
    let userId: string | null = null;

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'auth') {
          userId = data.userId;
          if (userId) {
            clients.set(userId, ws);
          }
        } else if (data.type === 'message' && userId) {
          // Broadcast to other user in conversation
          const msg = await storage.createMessage({
            ...data.payload,
            senderId: userId,
          });

          // Get job to find other user
          const job = await storage.getJob(data.payload.jobId);
          const otherUserId = job.requesterId === userId ? job.providerId : job.requesterId;

          if (otherUserId && clients.has(otherUserId)) {
            clients.get(otherUserId)?.send(JSON.stringify({ type: 'message', payload: msg }));
          }

          // Send confirmation back to sender
          ws.send(JSON.stringify({ type: 'message_sent', payload: msg }));
        }
      } catch (error) {
        console.error('WebSocket Error:', error);
      }
    });

    ws.on('close', () => {
      if (userId) {
        clients.delete(userId);
      }
    });
  });

  // ==================== AUTH ROUTES ====================

  // ⭐ FIX 2: Implement the sign-up route
  app.post('/auth/signup', async (req, res) => {
    try {
        // 1. Validate request body against Zod schema
        const validatedData = insertUserSchema.parse(req.body);

        // Optional: Perform additional role validation if necessary
        if (!validateRole(validatedData.role)) {
             return res.status(400).json({ message: 'Invalid role specified' });
        }

        // 2. Check if user already exists
        const existingUser = await storage.getUserByEmail(validatedData.email);
        if (existingUser) {
            return res.status(409).json({ 
                message: 'User with this email already exists' 
            });
        }

        // 3. Hash the password securely (bcrypt is in your package.json)
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(validatedData.password, saltRounds);

        // 4. Create the new user in the database
        const newUser = await storage.createUser({
            // Exclude the plaintext 'password' and use the hashed value
            ...validatedData,
            passwordHash,
        });

        // 5. Generate JWT token for immediate login
        const token = generateToken({
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
        });

        // 6. Send success response (without the password hash)
        const { passwordHash: _, ...userWithoutHash } = newUser;
        res.status(201).json({
            token,
            user: userWithoutHash,
            message: 'Sign up successful! Welcome to JobTradeSasa.',
        });

    } catch (error: any) {
        // Handle Zod validation errors (400) and other server errors (500)
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors: error.issues 
            });
        }
        console.error('Sign-up Error:', error);
        res.status(500).json({ 
            message: 'Internal Server Error during sign-up' 
        });
    }
  });


  // ==================== USER ROUTES ====================

  app.get('/api/users/me', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/users/me', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { name, phone, bio } = req.body;
      const updated = await storage.updateUser(req.user!.id, {
        name,
        phone,
        bio,
      });

      if (!updated) {
        return res.status(404).json({ message: 'User not found' });
      }

      const { passwordHash: _, ...userWithoutPassword } = updated;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== CATEGORY ROUTES ====================

  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== RATING ROUTES ====================

  app.post('/api/ratings', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const validatedData = insertRatingSchema.parse(req.body);
      
      const rating = await storage.createRating({
        ...validatedData,
        fromUserId: req.user!.id,
      });

      res.json(rating);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/ratings/:providerId', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const ratings = await storage.getProviderRatings(req.params.providerId);
      res.json(ratings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // ==================== JOB ROUTES ====================
  // (Note: Other job routes like POST /api/jobs and GET /api/jobs/:id should be implemented here too)

  return httpServer;
}
