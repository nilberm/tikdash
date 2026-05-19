import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from './auth.js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = new Hono();

app.use('*', cors({
  origin: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

import { accountsRouter } from './routes/accounts.js';

app.get('/', (c) => {
  return c.text('TikDash API');
});

// Better Auth routes
app.on(['POST', 'GET'], '/api/auth/**', (c) => {
  return auth.handler(c.req.raw);
});

// Accounts CRUD
app.route('/accounts', accountsRouter);

const port = process.env.PORT ? parseInt(process.env.PORT) : 8787;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
