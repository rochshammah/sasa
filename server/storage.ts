// server/storage.ts

import { 
  users, 
  providers,
  jobs, 
  messages, 
  ratings,
  categories,
  type User, 
  type InsertUser,
  type Provider,
  type InsertProvider,
  type Job,
  type InsertJob,
  type Message,
  type InsertMessage,
  type Rating,
  type InsertRating,
  type Category,
  type InsertCategory,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc, or } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: Omit<InsertUser, 'password'> & { passwordHash: string }): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  getProvider(userId: string): Promise<Provider | undefined>;
  createProvider(provider: InsertProvider & { userId: string }): Promise<Provider>;
  updateProvider(userId: string, data: Partial<Provider>): Promise<Provider | undefined>;
  searchProviders(params: {
    categoryId?: number;
    latitude?: number;
    longitude?: number;
    radius?: number;
  }): Promise<any[]>;
  getJob(id: string): Promise<any | undefined>;
  getJobs(params: {
    categoryId?: string;
    status?: string;
    requesterId?: string;
    providerId?: string;
  }): Promise<any[]>;
  createJob(job: InsertJob & { requesterId: string }): Promise<Job>;
  updateJob(id: string, data: Partial<Job>): Promise<Job | undefined>;
  acceptJob(jobId: string, providerId: string): Promise<Job | undefined>;
  getMessages(jobId: string): Promise<any[]>;
  createMessage(message: InsertMessage & { senderId: string }): Promise<Message>;
  getConversations(userId: string): Promise<any[]>;
  createRating(rating: InsertRating & { fromUserId: string }): Promise<Rating>;
  getProviderRatings(providerId: string): Promise<any[]>;
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  // ⭐ FIX 3: Implementation for creating a new user
  async createUser(insertUser: Omit<InsertUser, 'password'> & { passwordHash: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    
    if (!user) {
      throw new Error("Failed to create user in database.");
    }
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }
  
  // Providers
  async getProvider(userId: string): Promise<Provider | undefined> {
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.userId, userId));
    return provider || undefined;
  }

  async createProvider(provider: InsertProvider & { userId: string }): Promise<Provider> {
    const [newProvider] = await db.insert(providers).values(provider).returning();
    return newProvider;
  }

  async updateProvider(userId: string, data: Partial<Provider>): Promise<Provider | undefined> {
    const [updatedProvider] = await db
      .update(providers)
      .set(data)
      .where(eq(providers.userId, userId))
      .returning();
    return updatedProvider;
  }

  async searchProviders(params: {
    categoryId?: number;
    latitude?: number;
    longitude?: number;
    radius?: number;
  }): Promise<any[]> {
    const whereClauses = [];

    if (params.latitude && params.longitude && params.radius) {
      // Placeholder for PostGIS search
      // Example PostGIS query (requires PostGIS extension in Neon DB):
      // const point = sql`ST_SetSRID(ST_MakePoint(${params.longitude}, ${params.latitude}), 4326)`;
      // const distance = params.radius * 1000; // Assuming radius is in km, convert to meters
      // whereClauses.push(sql`ST_DWithin(providers.location, ${point}, ${distance})`);
    }

    const results = await db
      .select({
        user: users,
        provider: providers,
      })
      .from(providers)
      .leftJoin(users, eq(providers.userId, users.id))
      .where(and(...whereClauses));

    return results; // Further refinement needed to return a clean object
  }

  // Jobs
  async getJob(id: string): Promise<any | undefined> {
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, id));
    return job;
  }

  async getJobs(params: {
    categoryId?: string;
    status?: string;
    requesterId?: string;
    providerId?: string;
  }): Promise<any[]> {
    // Placeholder logic for filtering jobs
    const whereClauses = [];
    if (params.status) whereClauses.push(eq(jobs.status, params.status as any));
    if (params.requesterId) whereClauses.push(eq(jobs.requesterId, params.requesterId));
    if (params.providerId) whereClauses.push(eq(jobs.providerId, params.providerId));

    const results = await db
      .select()
      .from(jobs)
      .where(and(...whereClauses))
      .orderBy(desc(jobs.createdAt));

    return results;
  }

  async createJob(job: InsertJob & { requesterId: string }): Promise<Job> {
    const [newJob] = await db.insert(jobs).values(job).returning();
    return newJob;
  }

  async updateJob(id: string, data: Partial<Job>): Promise<Job | undefined> {
    const [updatedJob] = await db
      .update(jobs)
      .set(data)
      .where(eq(jobs.id, id))
      .returning();
    return updatedJob;
  }

  async acceptJob(jobId: string, providerId: string): Promise<Job | undefined> {
    const [updatedJob] = await db
      .update(jobs)
      .set({ status: 'accepted', providerId: providerId })
      .where(eq(jobs.id, jobId))
      .returning();
    return updatedJob;
  }

  // Messages
  async getMessages(jobId: string): Promise<any[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.jobId, jobId))
      .orderBy(asc(messages.createdAt));
  }

  async createMessage(message: InsertMessage & { senderId: string }): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  async getConversations(userId: string): Promise<any[]> {
    const results = await db
      .select()
      .from(jobs)
      .where(or(eq(jobs.requesterId, userId), eq(jobs.providerId, userId)))
      .orderBy(desc(jobs.updatedAt));
    
    // This needs to join user names for proper conversation list, but I will keep the original logic.
    return results; 
  }

  // Ratings
  async createRating(insertRating: InsertRating & { fromUserId: string }): Promise<Rating> {
    const [rating] = await db
      .insert(ratings)
      .values(insertRating)
      .returning();

    // Update provider's average rating
    const providerRatings = await db
      .select()
      .from(ratings)
      .where(eq(ratings.toUserId, insertRating.toUserId));

    const avgRating =
      providerRatings.reduce((sum, r) => sum + r.rating, 0) / providerRatings.length;

    await db
      .update(providers)
      .set({ ratingAverage: avgRating.toFixed(2) })
      .where(eq(providers.userId, insertRating.toUserId));

    return rating;
  }

  async getProviderRatings(providerId: string): Promise<any[]> {
    const results = await db
      .select({
        rating: ratings,
        fromUser: users,
      })
      .from(ratings)
      .leftJoin(users, eq(ratings.fromUserId, users.id))
      .where(eq(ratings.toUserId, providerId))
      .orderBy(desc(ratings.createdAt));

    return results.map((r) => ({
      ...r.rating,
      fromUser: r.fromUser,
    }));
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(insertCategory).returning();
    return newCategory;
  }
}

// Export a singleton instance for the rest of the application to use
export const storage = new DatabaseStorage();
