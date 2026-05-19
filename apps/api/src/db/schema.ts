import { pgTable, text, timestamp, boolean, integer, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull(),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull()
});

export const sessions = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => users.id)
});

export const accounts = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => users.id),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull()
});

export const verifications = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt')
});

export const tiktokAccounts = pgTable('tiktok_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('userId').references(() => users.id),
  username: text('username').notNull(),
  displayName: text('displayName'),
  email: text('email'),
  password: text('password'),
  type: text('type').default('real'),
  isActive: boolean('isActive').default(true),
  createdAt: timestamp('createdAt').defaultNow()
});

export const accountMetrics = pgTable('account_metrics', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('accountId').references(() => tiktokAccounts.id),
  followers: integer('followers').default(0),
  totalViews: integer('totalViews').default(0),
  totalLikes: integer('totalLikes').default(0),
  totalVideos: integer('totalVideos').default(0),
  recordedAt: timestamp('recordedAt').defaultNow()
});

export const videos = pgTable('videos', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('accountId').references(() => tiktokAccounts.id),
  title: text('title'),
  tiktokUrl: text('tiktokUrl'),
  thumbnail: text('thumbnail'),
  postedAt: timestamp('postedAt'),
  status: text('status').default('active'),
  views: integer('views').default(0),
  likes: integer('likes').default(0),
  comments: integer('comments').default(0),
  shares: integer('shares').default(0),
  createdAt: timestamp('createdAt').defaultNow()
});
