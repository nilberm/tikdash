import { Hono } from 'hono';
import { db } from '../db/index.js';
import { tiktokAccounts, accountMetrics, videos } from '../db/schema.js';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { encrypt, decrypt } from '../utils/crypto.js';
import { auth } from '../auth.js';
import { fetchProfileMetrics, fetchVideos, refreshTokenIfNeeded } from '../services/tiktok.service.js';

export const accountsRouter = new Hono<{
  Variables: {
    user: any;
  }
}>();

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
    tiktokUserId: tiktokAccounts.tiktokUserId,
    tokenExpiresAt: tiktokAccounts.tokenExpiresAt,
    accessToken: tiktokAccounts.accessToken,
    limitedMetrics: tiktokAccounts.limitedMetrics,
    createdAt: tiktokAccounts.createdAt
  }).from(tiktokAccounts).where(eq(tiktokAccounts.userId, user.id));
  
  const mapped = accounts.map(a => ({
    ...a,
    hasTikTokToken: !!a.accessToken,
    accessToken: undefined
  }));

  return c.json(mapped);
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
    tiktokUserId: tiktokAccounts.tiktokUserId,
    tokenExpiresAt: tiktokAccounts.tokenExpiresAt,
    accessToken: tiktokAccounts.accessToken,
    limitedMetrics: tiktokAccounts.limitedMetrics,
    createdAt: tiktokAccounts.createdAt
  }).from(tiktokAccounts).where(and(eq(tiktokAccounts.id, id), eq(tiktokAccounts.userId, user.id)));
  
  if (!account) return c.json({ error: 'Not found' }, 404);
  
  return c.json({
    ...account,
    hasTikTokToken: !!account.accessToken,
    accessToken: undefined
  });
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
  try {
    await auth.api.signInEmail({
      body: {
        email: user.email,
        password: userPassword
      }
    });
  } catch (err) {
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

// ================= FASE 2: MÉTRICAS =================

// POST /accounts/:id/metrics -> Salva um novo snapshot ou atualiza o de hoje
accountsRouter.post('/:id/metrics', async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');
  const body = await c.req.json();
  const { followers, totalViews, totalLikes, totalVideos } = body;

  // Verify account belongs to user
  const [account] = await db.select()
    .from(tiktokAccounts)
    .where(and(eq(tiktokAccounts.id, id), eq(tiktokAccounts.userId, user.id)));

  if (!account) return c.json({ error: 'Not found' }, 404);

  // Check if a snapshot for today already exists
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [existingToday] = await db.select()
    .from(accountMetrics)
    .where(and(
      eq(accountMetrics.accountId, id),
      gte(accountMetrics.recordedAt, startOfDay),
      lte(accountMetrics.recordedAt, endOfDay)
    ));

  let result;
  if (existingToday) {
    // Update existing snapshot
    const [updated] = await db.update(accountMetrics)
      .set({
        followers: followers !== undefined ? Number(followers) : existingToday.followers,
        totalViews: totalViews !== undefined ? Number(totalViews) : existingToday.totalViews,
        totalLikes: totalLikes !== undefined ? Number(totalLikes) : existingToday.totalLikes,
        totalVideos: totalVideos !== undefined ? Number(totalVideos) : existingToday.totalVideos,
        recordedAt: now
      })
      .where(eq(accountMetrics.id, existingToday.id))
      .returning();
    result = updated;
  } else {
    // Insert new snapshot
    const [inserted] = await db.insert(accountMetrics)
      .values({
        accountId: id,
        followers: followers !== undefined ? Number(followers) : 0,
        totalViews: totalViews !== undefined ? Number(totalViews) : 0,
        totalLikes: totalLikes !== undefined ? Number(totalLikes) : 0,
        totalVideos: totalVideos !== undefined ? Number(totalVideos) : 0,
        recordedAt: now
      })
      .returning();
    result = inserted;
  }

  return c.json(result);
});

// GET /accounts/:id/metrics -> Retorna histórico limitado aos últimos 30 registros
accountsRouter.get('/:id/metrics', async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');

  // Verify account belongs to user
  const [account] = await db.select()
    .from(tiktokAccounts)
    .where(and(eq(tiktokAccounts.id, id), eq(tiktokAccounts.userId, user.id)));

  if (!account) return c.json({ error: 'Not found' }, 404);

  const history = await db.select()
    .from(accountMetrics)
    .where(eq(accountMetrics.accountId, id))
    .orderBy(desc(accountMetrics.recordedAt))
    .limit(30);

  return c.json(history);
});

// ================= FASE 3: VÍDEOS =================

// GET /accounts/:id/videos -> Retorna histórico de vídeos
accountsRouter.get('/:id/videos', async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');

  // Verify account belongs to user
  const [account] = await db.select()
    .from(tiktokAccounts)
    .where(and(eq(tiktokAccounts.id, id), eq(tiktokAccounts.userId, user.id)));

  if (!account) return c.json({ error: 'Not found' }, 404);

  const list = await db.select()
    .from(videos)
    .where(eq(videos.accountId, id))
    .orderBy(desc(videos.postedAt));

  return c.json(list);
});

// POST /accounts/:id/videos -> Adiciona um novo vídeo
accountsRouter.post('/:id/videos', async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');
  const body = await c.req.json();
  const { title, tiktokUrl, thumbnail, postedAt, status, views, likes, comments, shares } = body;

  // Verify account belongs to user
  const [account] = await db.select()
    .from(tiktokAccounts)
    .where(and(eq(tiktokAccounts.id, id), eq(tiktokAccounts.userId, user.id)));

  if (!account) return c.json({ error: 'Not found' }, 404);

  const [newVideo] = await db.insert(videos)
    .values({
      accountId: id,
      title: title || '',
      tiktokUrl: tiktokUrl || null,
      thumbnail: thumbnail || null,
      postedAt: postedAt ? new Date(postedAt) : new Date(),
      status: status || 'active',
      views: views !== undefined ? Number(views) : 0,
      likes: likes !== undefined ? Number(likes) : 0,
      comments: comments !== undefined ? Number(comments) : 0,
      shares: shares !== undefined ? Number(shares) : 0
    })
    .returning();

  return c.json(newVideo);
});

// PUT /accounts/:id/videos/:videoId -> Atualiza vídeo existente
accountsRouter.put('/:id/videos/:videoId', async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');
  const videoId = c.req.param('videoId');
  const body = await c.req.json();
  const { title, tiktokUrl, thumbnail, postedAt, status, views, likes, comments, shares } = body;

  // Verify account belongs to user
  const [account] = await db.select()
    .from(tiktokAccounts)
    .where(and(eq(tiktokAccounts.id, id), eq(tiktokAccounts.userId, user.id)));

  if (!account) return c.json({ error: 'Not found' }, 404);

  const updateFields: any = {};
  if (title !== undefined) updateFields.title = title;
  if (tiktokUrl !== undefined) updateFields.tiktokUrl = tiktokUrl;
  if (thumbnail !== undefined) updateFields.thumbnail = thumbnail;
  if (postedAt !== undefined) updateFields.postedAt = postedAt ? new Date(postedAt) : null;
  if (status !== undefined) updateFields.status = status;
  if (views !== undefined) updateFields.views = Number(views);
  if (likes !== undefined) updateFields.likes = Number(likes);
  if (comments !== undefined) updateFields.comments = Number(comments);
  if (shares !== undefined) updateFields.shares = Number(shares);

  const [updatedVideo] = await db.update(videos)
    .set(updateFields)
    .where(and(eq(videos.id, videoId), eq(videos.accountId, id)))
    .returning();

  if (!updatedVideo) return c.json({ error: 'Video not found' }, 404);

  return c.json(updatedVideo);
});

// DELETE /accounts/:id/videos/:videoId -> Remove vídeo
accountsRouter.delete('/:id/videos/:videoId', async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');
  const videoId = c.req.param('videoId');

  // Verify account belongs to user
  const [account] = await db.select()
    .from(tiktokAccounts)
    .where(and(eq(tiktokAccounts.id, id), eq(tiktokAccounts.userId, user.id)));

  if (!account) return c.json({ error: 'Not found' }, 404);

  const [deletedVideo] = await db.delete(videos)
    .where(and(eq(videos.id, videoId), eq(videos.accountId, id)))
    .returning();

  if (!deletedVideo) return c.json({ error: 'Video not found' }, 404);

  return c.json({ success: true });
});

// POST /accounts/:id/sync -> Sincroniza a conta com a API oficial do TikTok
accountsRouter.post('/:id/sync', async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');

  // 1. Busca e valida a posse da conta
  const [account] = await db.select()
    .from(tiktokAccounts)
    .where(and(eq(tiktokAccounts.id, id), eq(tiktokAccounts.userId, user.id)));

  if (!account) {
    return c.json({ error: 'Conta não encontrada ou não pertence ao seu usuário.' }, 404);
  }

  if (!account.accessToken) {
    return c.json({ error: 'Conta não conectada ao TikTok. Por favor, conecte-se primeiro.' }, 400);
  }

  try {
    // 2. Renova o token se necessário
    const validToken = await refreshTokenIfNeeded(id);

    // 3. Busca métricas de perfil do TikTok
    const profileMetrics = await fetchProfileMetrics(validToken);

    // 4. Salva o display name e o status do escopo limitador na conta
    await db.update(tiktokAccounts)
      .set({ 
        displayName: profileMetrics.displayName || account.displayName,
        limitedMetrics: profileMetrics.limitedMetrics
      })
      .where(eq(tiktokAccounts.id, id));

    // 5. Salva novo snapshot de métricas (ou atualiza o de hoje)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [existingToday] = await db.select()
      .from(accountMetrics)
      .where(and(
        eq(accountMetrics.accountId, id),
        gte(accountMetrics.recordedAt, startOfDay),
        lte(accountMetrics.recordedAt, endOfDay)
      ));

    // Se o user.info.stats não estiver ativo (limitedMetrics = true),
    // mantemos os valores de followers e likes do snapshot anterior (ou default 0)
    let followersValue = profileMetrics.followers;
    let likesValue = profileMetrics.totalLikes;

    let finalSnapshot;
    if (existingToday) {
      const [updated] = await db.update(accountMetrics)
        .set({
          followers: followersValue !== null ? Number(followersValue) : existingToday.followers,
          totalViews: profileMetrics.totalViews !== undefined ? Number(profileMetrics.totalViews) : existingToday.totalViews,
          totalLikes: likesValue !== null ? Number(likesValue) : existingToday.totalLikes,
          totalVideos: profileMetrics.totalVideos !== null ? Number(profileMetrics.totalVideos) : existingToday.totalVideos,
          recordedAt: now
        })
        .where(eq(accountMetrics.id, existingToday.id))
        .returning();
      finalSnapshot = updated;
    } else {
      // Se for um novo snapshot do dia e os campos forem nulos (stats não autorizado),
      // busca o último snapshot do banco para não perder o histórico anterior
      let fallbackFollowers = 0;
      let fallbackLikes = 0;

      const [latestSnapshot] = await db.select()
        .from(accountMetrics)
        .where(eq(accountMetrics.accountId, id))
        .orderBy(desc(accountMetrics.recordedAt))
        .limit(1);

      if (latestSnapshot) {
        fallbackFollowers = latestSnapshot.followers || 0;
        fallbackLikes = latestSnapshot.totalLikes || 0;
      }

      const [inserted] = await db.insert(accountMetrics).values({
        accountId: id,
        followers: followersValue !== null ? Number(followersValue) : fallbackFollowers,
        totalViews: profileMetrics.totalViews || 0,
        totalLikes: likesValue !== null ? Number(likesValue) : fallbackLikes,
        totalVideos: profileMetrics.totalVideos !== null ? Number(profileMetrics.totalVideos) : 0,
        recordedAt: now
      }).returning();
      finalSnapshot = inserted;
    }

    // 6. Busca vídeos do TikTok e sincroniza no banco
    const tiktokVideos = await fetchVideos(validToken);
    const syncedVideos = [];

    for (const v of tiktokVideos) {
      // Constrói ou usa embed link como tiktokUrl único do post
      const tiktokUrl = v.embed_link || `https://www.tiktok.com/@${account.username}/video/${v.id}`;
      
      const [existingVideo] = await db.select()
        .from(videos)
        .where(and(
          eq(videos.accountId, id),
          eq(videos.tiktokUrl, tiktokUrl)
        ));

      if (existingVideo) {
        const [updatedVideo] = await db.update(videos)
          .set({
            title: v.title || existingVideo.title,
            thumbnail: v.cover_image_url || existingVideo.thumbnail,
            views: Number(v.view_count) || 0,
            likes: Number(v.like_count) || 0,
            comments: Number(v.comment_count) || 0,
            shares: Number(v.share_count) || 0,
            postedAt: v.create_time ? new Date(v.create_time * 1000) : existingVideo.postedAt,
          })
          .where(eq(videos.id, existingVideo.id))
          .returning();
        syncedVideos.push(updatedVideo);
      } else {
        const [insertedVideo] = await db.insert(videos).values({
          accountId: id,
          title: v.title || `Vídeo #${v.id.substring(0, 6)}`,
          tiktokUrl: tiktokUrl,
          thumbnail: v.cover_image_url,
          views: Number(v.view_count) || 0,
          likes: Number(v.like_count) || 0,
          comments: Number(v.comment_count) || 0,
          shares: Number(v.share_count) || 0,
          postedAt: v.create_time ? new Date(v.create_time * 1000) : new Date(),
          status: 'active'
        }).returning();
        syncedVideos.push(insertedVideo);
      }
    }

    return c.json({
      success: true,
      limitedMetrics: profileMetrics.limitedMetrics,
      snapshot: finalSnapshot,
      videosSyncedCount: syncedVideos.length,
      displayName: profileMetrics.displayName || account.displayName
    });
  } catch (err: any) {
    console.error('Erro durante a sincronização manual:', err);
    return c.json({ error: err.message || 'Falha na sincronização com o TikTok.' }, 500);
  }
});
