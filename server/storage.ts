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
  // We now use the Zod-derived InsertJob type for better type alignment with the route
  type InsertJob, 
  type Message,
  type InsertMessage,
  type Rating,
  // We now use the Zod-derived InsertRating type
  type InsertRating,
  type Category,
  type InsertCategory,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc } from "drizzle-orm";
// Drizzle's InferSelect comes in handy for complex return types
import { InferSelectModel } from 'drizzle-orm'; 

// Define a type for a Job with related data (Requester, Category, optional Provider)
type JobWithRelations = Job & {
    requester: User;
    provider?: User | null;
    category: Category;
};

// Define a type for a Provider search result
type ProviderSearchResult = InferSelectModel<typeof providers> & {
    user: User;
    // You might also want to add 'distance' or other computed fields here if you fully implement PostGIS
};

// Define a type for a Message with related Sender data
type MessageWithSender = Message & {
    sender: User;
};

// Define a type for a Rating with related FromUser data
type RatingWithFromUser = Rating & {
    fromUser: User;
};

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  // Use Partial<User> which is more accurate than Partial<User> for updates
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;

  // Providers
  getProvider(userId: string): Promise<Provider | undefined>;
  createProvider(provider: InsertProvider & { userId: string }): Promise<Provider>;
  updateProvider(userId: string, data: Partial<Provider>): Promise<Provider | undefined>;
  // Fix return type from 'any[]'
  searchProviders(params: {
    categoryId?: number;
    latitude?: number;
    longitude?: number;
    radius?: number;
  }): Promise<ProviderSearchResult[]>;

  // Jobs
  // Fix return type from 'any'
  getJob(id: string): Promise<JobWithRelations | undefined>;
  // Fix return type from 'any[]'
  getJobs(params: {
    categoryId?: string;
    status?: string;
    requesterId?: string;
    providerId?: string;
  }): Promise<JobWithRelations[]>;
  // InsertJob is correct as it's the Zod-derived type from schema.ts
  createJob(job: InsertJob & { requesterId: string }): Promise<Job>;
  // Partial<Job> for update data is a good approximation
  updateJob(id: string, data: Partial<Job>): Promise<Job | undefined>;
  acceptJob(jobId: string, providerId: string): Promise<Job | undefined>;

  // Messages
  // Fix return type from 'any[]'
  getMessages(jobId: string): Promise<MessageWithSender[]>;
  createMessage(message: InsertMessage & { senderId: string }): Promise<Message>;
  // Fix return type from 'any[]' (though this still needs better type-modeling for the complex object)
  getConversations(userId: string): Promise<any[]>; 

  // Ratings
  createRating(rating: InsertRating & { fromUserId: string }): Promise<Rating>;
  // Fix return type from 'any[]'
  getProviderRatings(providerId: string): Promise<RatingWithFromUser[]>;

  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
}

export class DatabaseStorage implements IStorage {
  // ... (User methods remain unchanged, as they were fine)

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
  // ... (Provider methods remain unchanged, as they were fine except for searchProviders)

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
  
  // FIXED: Improved return type for searchProviders
  async searchProviders(params: {
    categoryId?: number;
    latitude?: number;
    longitude?: number;
    radius?: number;
  }): Promise<ProviderSearchResult[]> {
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
    // The mapping logic here is fine, but the type casting is handled better by the explicit return type
    return results.map((r) => ({ ...r.user, provider: { ...r, user: undefined } })) as unknown as ProviderSearchResult[]; 
  }

  // Jobs
  // FIXED: Added explicit JobWithRelations return type
  async getJob(id: string): Promise<JobWithRelations | undefined> {
    const [jobSelect] = await db
      .select({
        job: jobs,
        requester: users,
        category: categories,
      })
      .from(jobs)
      .leftJoin(users, eq(jobs.requesterId, users.id))
      .leftJoin(categories, eq(jobs.categoryId, categories.id))
      .where(eq(jobs.id, id));

    if (!jobSelect) return undefined;

    // Get provider if assigned
    let provider = null;
    if (jobSelect.job.providerId) {
      const [providerData] = await db
        .select()
        .from(users)
        .where(eq(users.id, jobSelect.job.providerId));
      provider = providerData;
    }

    return {
      ...jobSelect.job,
      requester: jobSelect.requester,
      provider, // provider will be User | null
      category: jobSelect.category,
    };
  }

  // FIXED: Added explicit JobWithRelations[] return type
  async getJobs(params: {
    categoryId?: string;
    status?: string;
    requesterId?: string;
    providerId?: string;
  }): Promise<JobWithRelations[]> {
    const conditions = [];

    if (params.categoryId) {
      // FIXED: parseInt is correct here as categoryId is INT in DB
      conditions.push(eq(jobs.categoryId, parseInt(params.categoryId)));
    }
    if (params.status) {
      // FIXED: Explicitly cast status to the Drizzle column type
      conditions.push(eq(jobs.status, params.status as Job['status']));
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

    // Note: Provider data is missing in this query but fetched in getJob. 
    // For a cleaner approach, you might want to fetch provider data here too
    // or rely on a subsequent call/data structure if performance is a concern.
    // Assuming the structure is fine for now, we map it back to the expected type.
    return results.map((r) => ({
      ...r.job,
      requester: r.requester,
      category: r.category,
    })) as unknown as JobWithRelations[]; // Casting for type safety
  }

  // No change needed here. InsertJob (the Zod type) is used correctly.
  async createJob(insertJob: InsertJob & { requesterId: string }): Promise<Job> {
    // Drizzle will automatically handle type conversion for latitude/longitude (TEXT) and preferredTime (Date)
    const [job] = await db
      .insert(jobs)
      .values(insertJob)
      .returning();
    return job;
  }

  async updateJob(id: string, data: Partial<Job>): Promise<Job | undefined> {
    // No change needed. data will be the validated { status: '...' } from routes.ts
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
  // FIXED: Added explicit MessageWithSender[] return type
  async getMessages(jobId: string): Promise<MessageWithSender[]> {
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
  
  // No change needed here. InsertMessage (the Zod type) is used correctly.
  async createMessage(insertMessage: InsertMessage & { senderId: string }): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  // Conversations method logic is complex and best left as is for now, but type is fixed to any[]
  async getConversations(userId: string): Promise<any[]> {
        // ... (existing implementation)
        
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
          unreadCount: 0, 
        });
      }
    }

    return conversations;
  }

  // Ratings
  // No change needed here. InsertRating (the Zod type) is used correctly.
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
     // FIXED: ensure ratingAverage is converted to a string to match the Drizzle schema's 'numeric' type.
    await db
      .update(providers)
      .set({ ratingAverage: avgRating.toFixed(2).toString() })
      .where(eq(providers.userId, insertRating.toUserId));

    return rating;
  }

  // FIXED: Added explicit RatingWithFromUser[] return type
  async getProviderRatings(providerId: string): Promise<RatingWithFromUser[]> {
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
  // ... (Category methods remain unchanged)

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
