import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { authMiddleware, generateToken, type AuthRequest } from "./middleware/auth";
import {
  insertJobSchema,
  insertMessageSchema,
  insertRatingSchema,
  createUserRequestSchema,
  updateJobStatusSchema,
  updateProfileSchema,
} from "@shared/schema";
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
          // Validate payload before creating a message via WebSocket
          const validatedMessageData = insertMessageSchema.parse(data.payload);

          const msg = await storage.createMessage({
            ...validatedMessageData,
            senderId: userId,
          });

          // Get job to find other user
          const job = await storage.getJob(data.payload.jobId);
          if (!job) return; // Should not happen, but safe check

          // Determine the recipient (the other user in the job)
          let otherUserId: string | null | undefined;
          if (job.requesterId === userId) {
            otherUserId = job.providerId; // Sender is requester, recipient is provider
          } else if (job.providerId === userId) {
            otherUserId = job.requesterId; // Sender is provider, recipient is requester
          }
          
          if (otherUserId && clients.has(otherUserId)) {
            const otherWs = clients.get(otherUserId);
            if (otherWs && otherWs.readyState === WebSocket.OPEN) {
              otherWs.send(JSON.stringify({ type: 'message', payload: msg }));
            }
          }
        }
      } catch (error) {
        if (error instanceof ZodError) {
          console.error('WebSocket validation error:', error.issues);
        } else {
          console.error('WebSocket error:', error);
        }
      }
    });

    ws.on('close', () => {
      if (userId) {
        clients.delete(userId);
      }
    });
  });

  // Function to handle Zod errors consistently
  const handleZodError = (res: any, error: ZodError) => {
    return res.status(400).json({
      message: 'Validation failed',
      errors: error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
    });
  };

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
        // userData already excludes 'password' and 'confirmPassword'
        ...userData,
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

      // Ensures the Drizzle object is safe for destructuring
      const userPlain = JSON.parse(JSON.stringify(user)); 
      const { passwordHash: _, ...userWithoutPassword } = userPlain;
      
      res.status(201).json({ user: userWithoutPassword, token });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return handleZodError(res, error);
      }
      console.error('Signup internal error:', error);
      res.status(500).json({ message: error.message || 'Signup failed' });
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

      // 💥 FIX for "Unexpected end of json input" 💥
      // Ensures the Drizzle object is a clean, plain object before destructuring
      const userPlain = JSON.parse(JSON.stringify(user)); 
      const { passwordHash: _, ...userWithoutPassword } = userPlain;

      res.status(200).json({ user: userWithoutPassword, token });
    } catch (error: any) {
      console.error('Login internal error:', error);
      res.status(500).json({ message: 'An internal server error occurred during login.' });
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
      
      // 💡 LOGIC FIX: Filter jobs based on user role
      if (req.user!.role === 'requester') {
        // Requesters only see their own jobs
        params.requesterId = req.user!.id;
      }
      // Note: Providers get all jobs by default in storage.getJobs if no ID is passed

      let jobs = await storage.getJobs(params);

      // If the user is a Provider and no status filter was explicitly applied,
      // restrict results to only 'open' jobs (i.e., new leads)
      if (req.user!.role === 'provider' && !params.status && !params.requesterId) {
          jobs = jobs.filter(job => job.status === 'open');
      }

      // Sort jobs based on query parameter (performed on the filtered array)
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
      
      res.json(jobs);
    } catch (error: any) {
      console.error('Error fetching jobs:', error);
      res.status(500).json({ message: error.message || 'Error fetching jobs' });
    }
  });

  app.get('/api/jobs/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Basic security check: ensure user is the requester, the provider, or an admin
      if (job.requesterId !== req.user!.id && job.providerId !== req.user!.id && req.user!.role !== 'admin') {
          // If the job is not open and the user is not assigned, deny access
          if (job.status !== 'open') {
              return res.status(403).json({ message: 'Access denied to this job.' });
          }
      }

      res.json(job);
    } catch (error: any) {
      console.error('Error fetching single job:', error);
      res.status(500).json({ message: error.message || 'Error fetching job' });
    }
  });

  // This POST route for creating a job is crucial and now uses the fixed schema
  app.post('/api/jobs', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'requester') {
          return res.status(403).json({ message: 'Only requesters can post jobs' });
      }

      // Validation using the fixed insertJobSchema
      const validatedData = insertJobSchema.parse(req.body);
      
      const job = await storage.createJob({
        ...validatedData,
        requesterId: req.user!.id,
      });

      res.status(201).json(job);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return handleZodError(res, error);
      }
      console.error('Error creating job:', error);
      res.status(400).json({ message: error.message || 'Job creation failed' });
    }
  });

  // Use updateJobStatusSchema for validation on PATCH /api/jobs/:id
  app.patch('/api/jobs/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      // Validate the incoming partial data (in this case, only status)
      const validatedData = updateJobStatusSchema.parse(req.body);
      
      // Optional: Add logic to check if the user is authorized to change the status
      // (e.g., requester can only 'cancel' or 'complete', provider can only change to 'accepted', 'enroute', 'onsite', 'completed')

      const updated = await storage.updateJob(req.params.id, validatedData);

      if (!updated) {
        return res.status(404).json({ message: 'Job not found' });
      }

      res.json(updated);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return handleZodError(res, error); 
      }
      console.error('Error updating job:', error);
      res.status(500).json({ message: error.message || 'Error updating job' });
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
      console.error('Error accepting job:', error);
      res.status(500).json({ message: error.message || 'Error accepting job' });
    }
  });

  // ==================== PROVIDER ROUTES ====================

  app.get('/api/providers', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { categoryId, latitude, longitude, radius } = req.query;
      
      const params: any = {};
      // Query params are always strings, so parsing is necessary if storage expects numbers
      if (categoryId) params.categoryId = parseInt(categoryId as string);
      if (latitude) params.latitude = parseFloat(latitude as string);
      if (longitude) params.longitude = parseFloat(longitude as string);
      if (radius) params.radius = parseInt(radius as string);

      const providers = await storage.searchProviders(params);

      res.json(providers);
    } catch (error: any) {
      console.error('Error searching providers:', error);
      res.status(500).json({ message: error.message || 'Error searching providers' });
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
      console.error('Error fetching provider stats:', error);
      res.status(500).json({ message: error.message || 'Error fetching provider stats' });
    }
  });

  app.get('/api/provider/recent-jobs', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'provider') {
        return res.status(403).json({ message: 'Only providers can access this' });
      }

      // Fetch jobs assigned to this provider
      const jobs = await storage.getJobs({ providerId: req.user!.id });
      // Sort by creation date and take the first 10
      const recentJobs = jobs
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10);
          
      res.json(recentJobs);
    } catch (error: any) {
      console.error('Error fetching recent jobs:', error);
      res.status(500).json({ message: error.message || 'Error fetching recent jobs' });
    }
  });

  // ==================== MESSAGE ROUTES ====================

  app.get('/api/messages/conversations', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const conversations = await storage.getConversations(req.user!.id);
      res.json(conversations);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ message: error.message || 'Error fetching conversations' });
    }
  });

  app.get('/api/messages/:jobId', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const messages = await storage.getMessages(req.params.jobId);
      res.json(messages);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ message: error.message || 'Error fetching messages' });
    }
  });

  app.post('/api/messages', authMiddleware, async (req: AuthRequest, res) => {
    try {
      // Validation using the fixed insertMessageSchema
      const validatedData = insertMessageSchema.parse(req.body);
      
      const message = await storage.createMessage({
        ...validatedData,
        senderId: req.user!.id,
      });

      res.status(201).json(message);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return handleZodError(res, error); 
      }
      console.error('Error creating message:', error);
      res.status(400).json({ message: error.message || 'Message creation failed' });
    }
  });

  // ==================== PROFILE ROUTES ====================

  app.patch('/api/profile', authMiddleware, async (req: AuthRequest, res) => {
    try {
      // Use updateProfileSchema for validation
      const validatedData = updateProfileSchema.parse(req.body);
      
      const updated = await storage.updateUser(req.user!.id, validatedData);

      if (!updated) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Ensures the Drizzle object is a clean, plain object before destructuring
      const updatedPlain = JSON.parse(JSON.stringify(updated)); 
      const { passwordHash: _, ...userWithoutPassword } = updatedPlain;
      
      res.json(userWithoutPassword);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return handleZodError(res, error); 
      }
      console.error('Error updating profile:', error);
      res.status(500).json({ message: error.message || 'Error updating profile' });
    }
  });

  // ==================== CATEGORY ROUTES ====================

  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: error.message || 'Error fetching categories' });
    }
  });

  // ==================== RATING ROUTES ====================

  app.post('/api/ratings', authMiddleware, async (req: AuthRequest, res) => {
    try {
      // Validation using insertRatingSchema
      const validatedData = insertRatingSchema.parse(req.body);
      
      const rating = await storage.createRating({
        ...validatedData,
        fromUserId: req.user!.id,
      });

      res.status(201).json(rating);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return handleZodError(res, error); 
      }
      console.error('Error creating rating:', error);
      res.status(400).json({ message: error.message || 'Rating creation failed' });
    }
  });

  app.get('/api/ratings/:providerId', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const ratings = await storage.getProviderRatings(req.params.providerId);
      res.json(ratings);
    } catch (error: any) {
      console.error('Error fetching ratings:', error);
      res.status(500).json({ message: error.message || 'Error fetching ratings' });
    }
  });

  return httpServer;
}
