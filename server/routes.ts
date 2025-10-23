// server/routes.ts

import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { authMiddleware, generateToken, type AuthRequest } from "./middleware/auth";
import { insertUserSchema, insertJobSchema, insertMessageSchema, insertRatingSchema } from "@shared/schema";
import { ZodError } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time chat (Original Complex Logic - PRESERVED)
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
            const otherWs = clients.get(otherUserId);
            if (otherWs && otherWs.readyState === WebSocket.OPEN) {
              otherWs.send(JSON.stringify({ type: 'message', payload: msg }));
            }
          }
          // Send confirmation back to sender
          ws.send(JSON.stringify({ type: 'message_sent', payload: msg }));
        }
      } catch (error) {
        console.error('WebSocket error:', error);
      }
    });

    ws.on('close', () => {
      if (userId) {
        clients.delete(userId);
      }
    });
  });

  // ==================== AUTH ROUTES (FIXED & IMPROVED) ====================
  
  // ⭐ FIX 2a: Implement robust Sign-Up logic
  app.post('/api/auth/signup', async (req, res) => {
    try {
      // 1. Validate request body against Zod schema
      const validatedData = insertUserSchema.parse(req.body);

      // 2. Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(409).json({ message: 'User with this email already exists' });
      }

      // 3. Hash the password securely
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(validatedData.password, saltRounds);

      // 4. Create the new user in the database
      const newUser = await storage.createUser({
          ...validatedData,
          passwordHash,
      });

      // 5. Create provider profile if role is provider
      if (newUser.role === 'provider') {
        await storage.createProvider({
          userId: newUser.id,
          serviceCategories: [],
          serviceAreaRadiusMeters: 10000, 
        });
      }

      // 6. Generate JWT token for immediate login
      const token = generateToken({
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
      });

      // 7. Send success response (without the password hash)
      const { passwordHash: _, ...userWithoutHash } = newUser;
      res.status(201).json({
          token,
          user: userWithoutHash,
          message: 'Sign up successful! Welcome to JobTradeSasa.',
      });

    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: error.issues 
        });
      }
      console.error('Sign-up Error:', error);
      res.status(500).json({ message: 'Internal Server Error during sign-up' });
    }
  });


  // ⭐ FIX 2b: Implement robust Login logic
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const user = await storage.getUserByEmail(email);
      
      // 1. Check if user exists
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // 2. Compare password hash
      const isValid = await bcrypt.compare(password, user.passwordHash);
      
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // 3. Generate token
      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      // 4. Send success response (without the password hash)
      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json({
        token,
        user: userWithoutPassword,
        message: 'Login successful!',
      });
      
    } catch (error: any) {
      console.error('Login Error:', error);
      res.status(500).json({ message: 'Internal Server Error during login' });
    }
  });


  // ==================== USER ROUTES (ORIGINAL - PRESERVED) ====================

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

  // ==================== CATEGORY ROUTES (ORIGINAL - PRESERVED) ====================

  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== RATING ROUTES (ORIGINAL - PRESERVED) ====================

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
  
  // (Assuming other job routes and logic are present here)

  return httpServer;
}
