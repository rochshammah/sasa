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
import { eq, and, sql, desc, asc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;

  // Providers
  getProvider(userId: string): Promise<Provider | undefined>;
  createProvider(provider: InsertProvider & { userId: string }): Promise<Provider>;
  updateProvider(userId: string, data: Partial<Provider>): Promise<Provider | undefined>;
  searchProviders(params: {
    categoryId?: number;
    latitude?: number;
    longitude?: number;
    radius?: number;
  }): Promise<any[]>;

  // Jobs
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

  // Messages
  getMessages(jobId: string): Promise<any[]>;
  createMessage(message: InsertMessage & { senderId: string }): Promise<Message>;
  getConversations(userId: string): Promise<any[]>;

  // Ratings
  createRating(rating: InsertRating & { fromUserId: string }): Promise<Rating>;
  getProviderRatings(providerId: string): Promise<any[]>;

  // Categories
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
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
    const [created] = await db
      .insert(providers)
      .values(provider)
      .returning();
    return created;
  }

  async updateProvider(userId: string, data: Partial<Provider>): Promise<Provider | undefined> {
    const [updated] = await db
      .update(providers)
      .set(data)
      .where(eq(providers.userId, userId))
      .returning();
    return updated || undefined;
  }

  async searchProviders(params: {
    categoryId?: number;
    latitude?: number;
    longitude?: number;
    radius?: number;
  }): Promise<any[]> {
    let query = db
      .select({
        userId: providers.userId,
        companyName: providers.companyName,
        serviceCategories: providers.serviceCategories,
        ratingAverage: providers.ratingAverage,
        completedJobsCount: providers.completedJobsCount,
        isOnline: providers.isOnline,
        latitude: providers.latitude,
        longitude: providers.longitude,
        user: users,
      })
      .from(providers)
      .leftJoin(users, eq(providers.userId, users.id))
      .where(eq(providers.isOnline, true));

    const results = await query;
    return results.map((r) => ({ ...r.user, provider: { ...r, user: undefined } }));
  }

  // Jobs
  async getJob(id: string): Promise<any | undefined> {
    const [job] = await db
      .select({
        job: jobs,
        requester: users,
        category: categories,
      })
      .from(jobs)
      .leftJoin(users, eq(jobs.requesterId, users.id))
      .leftJoin(categories, eq(jobs.categoryId, categories.id))
      .where(eq(jobs.id, id));

    if (!job) return undefined;

    // Get provider if assigned
    let provider = null;
    if (job.job.providerId) {
      const [providerData] = await db
        .select()
        .from(users)
        .where(eq(users.id, job.job.providerId));
      provider = providerData;
    }

    return {
      ...job.job,
      requester: job.requester,
      provider,
      category: job.category,
    };
  }

  async getJobs(params: {
    categoryId?: string;
    status?: string;
    requesterId?: string;
    providerId?: string;
  }): Promise<any[]> {
    const conditions = [];

    if (params.categoryId) {
      conditions.push(eq(jobs.categoryId, parseInt(params.categoryId)));
    }
    if (params.status) {
      conditions.push(eq(jobs.status, params.status as any));
    }
    if (params.requesterId) {
      conditions.push(eq(jobs.requesterId, params.requesterId));
    }
    if (params.providerId) {
      conditions.push(eq(jobs.providerId, params.providerId));
    }

    const results = await db
      .select({
        job: jobs,
        requester: users,
        category: categories,
      })
      .from(jobs)
      .leftJoin(users, eq(jobs.requesterId, users.id))
      .leftJoin(categories, eq(jobs.categoryId, categories.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(jobs.createdAt));

    return results.map((r) => ({
      ...r.job,
      requester: r.requester,
      category: r.category,
    }));
  }

  async createJob(insertJob: InsertJob & { requesterId: string }): Promise<Job> {
    const [job] = await db
      .insert(jobs)
      .values(insertJob)
      .returning();
    return job;
  }

  async updateJob(id: string, data: Partial<Job>): Promise<Job | undefined> {
    const [updated] = await db
      .update(jobs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning();
    return updated || undefined;
  }

  async acceptJob(jobId: string, providerId: string): Promise<Job | undefined> {
    const [updated] = await db
      .update(jobs)
      .set({ 
        providerId, 
        status: 'accepted',
        updatedAt: new Date() 
      })
      .where(eq(jobs.id, jobId))
      .returning();
    return updated || undefined;
  }

  // Messages
  async getMessages(jobId: string): Promise<any[]> {
    const results = await db
      .select({
        message: messages,
        sender: users,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.jobId, jobId))
      .orderBy(asc(messages.createdAt));

    return results.map((r) => ({
      ...r.message,
      sender: r.sender,
    }));
  }

  async createMessage(insertMessage: InsertMessage & { senderId: string }): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async getConversations(userId: string): Promise<any[]> {
    // Get all jobs where user is requester or provider
    const userJobs = await db
      .select({
        job: jobs,
        requester: users,
      })
      .from(jobs)
      .leftJoin(users, eq(jobs.requesterId, users.id))
      .where(
        sql`${jobs.requesterId} = ${userId} OR ${jobs.providerId} = ${userId}`
      );

    // For each job, get the last message
    const conversations = [];
    for (const { job, requester } of userJobs) {
      const [lastMessage] = await db
        .select()
        .from(messages)
        .where(eq(messages.jobId, job.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      if (lastMessage) {
        const otherUserId = job.requesterId === userId ? job.providerId : job.requesterId;
        const [otherUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, otherUserId!));

        conversations.push({
          jobId: job.id,
          jobTitle: job.title,
          otherUser,
          lastMessage: lastMessage.messageText,
          lastMessageTime: lastMessage.createdAt,
          unreadCount: 0, // TODO: Implement unread tracking
        });
      }
    }

    return conversations;
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
    return await db.select().from(categories);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(insertCategory)
      .returning();
    return category;
  }
}

export const storage = new DatabaseStorage();
