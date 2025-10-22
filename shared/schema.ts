import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  uuid, 
  timestamp, 
  boolean, 
  integer, 
  numeric,
  jsonb,
  pgEnum
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const roleEnum = pgEnum("role", ["requester", "provider", "admin"]);
export const urgencyEnum = pgEnum("urgency", ["normal", "emergency"]);
export const jobStatusEnum = pgEnum("job_status", [
  "open",
  "offered", 
  "accepted", 
  "enroute", 
  "onsite", 
  "completed", 
  "cancelled"
]);

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: roleEnum("role").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  profilePhotoUrl: text("profile_photo_url"),
  bio: text("bio"),
  isVerified: boolean("is_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Categories table
export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  parentId: integer("parent_id"),
  description: text("description"),
  icon: text("icon"),
});

// Providers extended profile
export const providers = pgTable("providers", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  companyName: text("company_name"),
  serviceCategories: jsonb("service_categories").notNull().$type<number[]>(),
  basePriceInfo: jsonb("base_price_info").$type<Record<string, any>>(),
  serviceAreaRadiusMeters: integer("service_area_radius_meters").default(10000).notNull(),
  averageResponseTimeSeconds: integer("average_response_time_seconds"),
  ratingAverage: numeric("rating_average", { precision: 3, scale: 2 }).default("0"),
  completedJobsCount: integer("completed_jobs_count").default(0).notNull(),
  verificationDocuments: jsonb("verification_documents").$type<string[]>(),
  isOnline: boolean("is_online").default(false).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
});

// Jobs table
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  requesterId: uuid("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").references(() => users.id, { onDelete: "set null" }),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  photos: jsonb("photos").$type<string[]>(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
  address: text("address"),
  urgency: urgencyEnum("urgency").default("normal").notNull(),
  preferredTime: timestamp("preferred_time"),
  status: jobStatusEnum("status").default("open").notNull(),
  priceAgreed: numeric("price_agreed", { precision: 10, scale: 2 }),
  pricePaid: numeric("price_paid", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Messages table for chat
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  messageText: text("message_text"),
  attachments: jsonb("attachments").$type<string[]>(),
  voiceNoteUrl: text("voice_note_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Ratings table
export const ratings = pgTable("ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  fromUserId: uuid("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  toUserId: uuid("to_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Promotions table
export const promotions = pgTable("promotions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  providerId: uuid("provider_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  media: jsonb("media").$type<string[]>(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  providerProfile: one(providers, {
    fields: [users.id],
    references: [providers.userId],
  }),
  jobsAsRequester: many(jobs, { relationName: "requester" }),
  jobsAsProvider: many(jobs, { relationName: "provider" }),
  messagesSent: many(messages),
  ratingsGiven: many(ratings, { relationName: "ratingFrom" }),
  ratingsReceived: many(ratings, { relationName: "ratingTo" }),
}));

export const providersRelations = relations(providers, ({ one }) => ({
  user: one(users, {
    fields: [providers.userId],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
  children: many(categories),
  jobs: many(jobs),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  requester: one(users, {
    fields: [jobs.requesterId],
    references: [users.id],
    relationName: "requester",
  }),
  provider: one(users, {
    fields: [jobs.providerId],
    references: [users.id],
    relationName: "provider",
  }),
  category: one(categories, {
    fields: [jobs.categoryId],
    references: [categories.id],
  }),
  messages: many(messages),
  ratings: many(ratings),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  job: one(jobs, {
    fields: [messages.jobId],
    references: [jobs.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  job: one(jobs, {
    fields: [ratings.jobId],
    references: [jobs.id],
  }),
  fromUser: one(users, {
    fields: [ratings.fromUserId],
    references: [users.id],
    relationName: "ratingFrom",
  }),
  toUser: one(users, {
    fields: [ratings.toUserId],
    references: [users.id],
    relationName: "ratingTo",
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isVerified: true,
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertProviderSchema = createInsertSchema(providers).omit({
  userId: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  requesterId: true,
  providerId: true,
  status: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  senderId: true,
});

export const insertRatingSchema = createInsertSchema(ratings).omit({
  id: true,
  createdAt: true,
  fromUserId: true,
}).extend({
  rating: z.number().min(1).max(5),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Provider = typeof providers.$inferSelect;
export type InsertProvider = z.infer<typeof insertProviderSchema>;

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Rating = typeof ratings.$inferSelect;
export type InsertRating = z.infer<typeof insertRatingSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Promotion = typeof promotions.$inferSelect;
