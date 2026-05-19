import { Hono } from 'hono';
import { db } from '../db/index.js';
import { tiktokAccounts } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '../utils/crypto.js';
import { auth } from '../auth.js';

export const accountsRouter = new Hono();

// Middleware to get user from session
accountsRouter.use('*', async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  });
  if (!session || !session.user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('user', session.user);
  await next();
});

// GET /accounts -> lista todas as contas do usuario
accountsRouter.get('/', async (c) => {
  const user = c.get('user') as any;
  const accounts = await db.select({
    id: tiktokAccounts.id,
    username: tiktokAccounts.username,
    displayName: tiktokAccounts.displayName,
    email: tiktokAccounts.email,
    type: tiktokAccounts.type,
    isActive: tiktokAccounts.isActive,
    createdAt: tiktokAccounts.createdAt
  }).from(tiktokAccounts).where(eq(tiktokAccounts.userId, user.id));
  
  return c.json(accounts);
});

// POST /accounts -> cria nova conta
accountsRouter.post('/', async (c) => {
  const user = c.get('user') as any;
  const body = await c.req.json();
  const { username, displayName, email, password, type } = body;
  
  if (!username) return c.json({ error: 'Username is required' }, 400);

  const encryptedPassword = password ? encrypt(password) : null;

  const [newAccount] = await db.insert(tiktokAccounts).values({
    userId: user.id,
    username,
    displayName,
    email,
    password: encryptedPassword,
    type: type || 'real',
  }).returning();

  return c.json(newAccount);
});

// GET /accounts/:id -> detalhe da conta
accountsRouter.get('/:id', async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');
  
  const [account] = await db.select({
    id: tiktokAccounts.id,
    username: tiktokAccounts.username,
    displayName: tiktokAccounts.displayName,
    email: tiktokAccounts.email,
    type: tiktokAccounts.type,
    isActive: tiktokAccounts.isActive,
    createdAt: tiktokAccounts.createdAt
  }).from(tiktokAccounts).where(and(eq(tiktokAccounts.id, id), eq(tiktokAccounts.userId, user.id)));
  
  if (!account) return c.json({ error: 'Not found' }, 404);
  return c.json(account);
});

// PUT /accounts/:id -> atualiza conta
accountsRouter.put('/:id', async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');
  const body = await c.req.json();
  const { username, displayName, email, password, type, isActive } = body;
  
  const updateData: any = {};
  if (username !== undefined) updateData.username = username;
  if (displayName !== undefined) updateData.displayName = displayName;
  if (email !== undefined) updateData.email = email;
  if (type !== undefined) updateData.type = type;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (password !== undefined && password !== null && password !== '') {
    updateData.password = encrypt(password);
  }
  
  const [updated] = await db.update(tiktokAccounts)
    .set(updateData)
    .where(and(eq(tiktokAccounts.id, id), eq(tiktokAccounts.userId, user.id)))
    .returning();
    
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

// DELETE /accounts/:id -> remove conta
accountsRouter.delete('/:id', async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');
  
  const [deleted] = await db.delete(tiktokAccounts)
    .where(and(eq(tiktokAccounts.id, id), eq(tiktokAccounts.userId, user.id)))
    .returning();
    
  if (!deleted) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

// POST /accounts/:id/reveal -> revela senha
accountsRouter.post('/:id/reveal', async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');
  const { userPassword } = await c.req.json();
  
  if (!userPassword) return c.json({ error: 'User password is required' }, 400);
  
  // Verify user password using Better Auth
  const verifyRes = await auth.api.signInEmail({
    body: {
      email: user.email,
      password: userPassword
    }
  });
  
  if (!verifyRes || verifyRes.error) {
    return c.json({ error: 'Invalid user password' }, 403);
  }
  
  const [account] = await db.select()
    .from(tiktokAccounts)
    .where(and(eq(tiktokAccounts.id, id), eq(tiktokAccounts.userId, user.id)));
    
  if (!account) return c.json({ error: 'Not found' }, 404);
  if (!account.password) return c.json({ error: 'No password saved for this account' }, 400);
  
  try {
    const decrypted = decrypt(account.password);
    return c.json({ password: decrypted });
  } catch (e) {
    return c.json({ error: 'Failed to decrypt password' }, 500);
  }
});
