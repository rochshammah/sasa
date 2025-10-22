import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { authMiddleware, generateToken, type AuthRequest } from "./middleware/auth";
import { insertUserSchema, insertJobSchema, insertMessageSchema, insertRatingSchema } from "@shared/schema";

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
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(validatedData.password, 10);

      // Create user
      const user = await storage.createUser({
        ...validatedData,
        passwordHash,
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
      
      const jobs = await storage.getJobs({
        categoryId: category as string,
        status: status as string,
      });

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

      res.json(job);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch('/api/jobs/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const job = await storage.updateJob(req.params.id, req.body);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }
      res.json(job);
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
        return res.status(404).json({ message: 'Job not found' });
      }

      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== PROVIDER ROUTES ====================

  app.get('/api/providers', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { category, lat, lng, radius } = req.query;
      
      const providers = await storage.searchProviders({
        categoryId: category ? parseInt(category as string) : undefined,
        latitude: lat ? parseFloat(lat as string) : undefined,
        longitude: lng ? parseFloat(lng as string) : undefined,
        radius: radius ? parseInt(radius as string) : undefined,
      });

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

      const provider = await storage.getProvider(req.user!.id);
      if (!provider) {
        return res.status(404).json({ message: 'Provider profile not found' });
      }

      // Get provider's jobs
      const jobs = await storage.getJobs({
        providerId: req.user!.id,
      });

      const completedJobs = jobs.filter((j) => j.status === 'completed');
      const totalEarnings = completedJobs.reduce((sum, j) => {
        return sum + (parseFloat(j.pricePaid || '0'));
      }, 0);

      res.json({
        totalEarnings,
        completedJobs: completedJobs.length,
        averageRating: parseFloat(provider.ratingAverage || '0'),
        avgResponseTime: provider.averageResponseTimeSeconds || 0,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/provider/recent-jobs', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'provider') {
        return res.status(403).json({ message: 'Only providers can access this' });
      }

      const jobs = await storage.getJobs({
        providerId: req.user!.id,
      });

      res.json(jobs.slice(0, 10));
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

      res.json(message);
    } catch (error: any) {
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
