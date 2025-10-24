import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { authMiddleware, generateToken, type AuthRequest } from "./middleware/auth";
import { insertJobSchema, insertMessageSchema, insertRatingSchema, createUserRequestSchema } from "@shared/schema"; // <--- UPDATED IMPORT
import { ZodError } from 'zod'; 

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
            const otherWs = clients.get(otherUserId);
            if (otherWs && otherWs.readyState === WebSocket.OPEN) {
              otherWs.send(JSON.stringify({ type: 'message', payload: msg }));
            }
          }
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

  // ==================== AUTH ROUTES ====================
  
  app.post('/api/auth/signup', async (req, res) => {
    try {
      // 1. Validate the incoming request data (which includes password and confirmPassword)
      const rawValidatedData = createUserRequestSchema.parse(req.body);
      
      // Separate password fields from user data for DB insertion
      const { password, confirmPassword, ...userData } = rawValidatedData;
      
      // 2. Perform server-side password match check
      if (password !== confirmPassword) {
         // Return a dedicated error if passwords don't match
         return res.status(400).json({ message: "Passwords do not match." });
      }

      // Check if user exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // 3. Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // 4. Create user with the hashed password
      const user = await storage.createUser({
        ...userData,
        passwordHash, // <--- This field is now correctly populated
      });

      // Create provider profile if role is provider
      if (user.role === 'provider') {
        await storage.createProvider({
          userId: user.id,
          serviceCategories: [],
          serviceAreaRadiusMeters: 10000,
        });
      }

      // Generate token
      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token });
    } catch (error: any) {
      if (error instanceof ZodError) {
        // Zod validation errors should return 400
        return res.status(400).json({ message: 'Validation failed', errors: error.issues });
      }
      res.status(400).json({ message: error.message || 'Signup failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token });
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Login failed' });
    }
  });

  // ==================== JOB ROUTES ====================

  app.get('/api/jobs', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { category, status, sort } = req.query;
      const params: any = {};
      
      if (category && category !== 'all') {
        params.categoryId = category as string;
      }
      if (status) {
        params.status = status as string;
      }

      let jobs = await storage.getJobs(params);

      // Sort jobs based on query parameter
      if (sort === 'urgent') {
        jobs = jobs.sort((a, b) => {
          if (a.urgency === 'emergency' && b.urgency !== 'emergency') return -1;
          if (a.urgency !== 'emergency' && b.urgency === 'emergency') return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // Fallback to recent
        });
      } else if (sort === 'recent') {
        jobs = jobs.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      // Note: 'distance' sort is not fully implemented on the backend as PostGIS/geolocation filters are mocked.

      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/jobs/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/jobs', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const validatedData = insertJobSchema.parse(req.body);
      
      const job = await storage.createJob({
        ...validatedData,
        requesterId: req.user!.id,
      });

      res.status(201).json(job);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.issues });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.patch('/api/jobs/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      const updated = await storage.updateJob(req.params.id, { status });

      if (!updated) {
        return res.status(404).json({ message: 'Job not found' });
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/jobs/:id/accept', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'provider') {
        return res.status(403).json({ message: 'Only providers can accept jobs' });
      }

      const job = await storage.acceptJob(req.params.id, req.user!.id);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found or already accepted' });
      }

      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== PROVIDER ROUTES ====================

  app.get('/api/providers', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { categoryId, latitude, longitude, radius } = req.query;
      
      const params: any = {};
      if (categoryId) params.categoryId = parseInt(categoryId as string);
      if (latitude) params.latitude = parseFloat(latitude as string);
      if (longitude) params.longitude = parseFloat(longitude as string);
      if (radius) params.radius = parseInt(radius as string);

      const providers = await storage.searchProviders(params);

      res.json(providers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/provider/stats', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'provider') {
        return res.status(403).json({ message: 'Only providers can access stats' });
      }

      // Using mock stats for this endpoint as per instructions
      const stats = {
        totalEarnings: 5240,
        completedJobs: 87,
        averageRating: 4.8,
        avgResponseTime: 12,
      };

      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/provider/recent-jobs', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'provider') {
        return res.status(403).json({ message: 'Only providers can access this' });
      }

      const jobs = await storage.getJobs({ providerId: req.user!.id });
      const recentJobs = jobs.slice(0, 10);
      res.json(recentJobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== MESSAGE ROUTES ====================

  app.get('/api/messages/conversations', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const conversations = await storage.getConversations(req.user!.id);
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/messages/:jobId', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const messages = await storage.getMessages(req.params.jobId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/messages', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const validatedData = insertMessageSchema.parse(req.body);
      
      const message = await storage.createMessage({
        ...validatedData,
        senderId: req.user!.id,
      });

      res.status(201).json(message);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.issues });
      }
      res.status(400).json({ message: error.message });
    }
  });

  // ==================== PROFILE ROUTES ====================

  app.patch('/api/profile', authMiddleware, async (req: AuthRequest, res) => {
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
      if (error instanceof ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.issues });
      }
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

  return httpServer;
}
