import { db } from '../db/index.js';
import { tiktokAccounts } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface ProfileMetricsResult {
  followers: number | null;
  totalViews: number; // Profile API v2 doesn't return total views, we can default to 0 or calculate from videos
  totalLikes: number | null;
  totalVideos: number | null;
  displayName: string | null;
  avatarUrl: string | null;
  tiktokUserId: string;
  limitedMetrics: boolean;
}

export interface TikTokVideoItem {
  id: string;
  title: string | null;
  cover_image_url: string | null;
  create_time: number; // Unix timestamp in seconds
  like_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
  embed_link: string | null;
}

/**
 * Busca métricas de perfil do TikTok usando o accessToken.
 * Implementa um fallback gracioso caso o escopo 'user.info.stats' não esteja disponível.
 */
export async function fetchProfileMetrics(accessToken: string): Promise<ProfileMetricsResult> {
  // 1. Tenta buscar todos os campos, incluindo stats (follower_count, likes_count)
  try {
    const response = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,follower_count,likes_count,video_count',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    const json = await response.json() as any;

    if (response.ok && json.data && json.data.user) {
      const user = json.data.user;
      
      // Se follower_count ou likes_count vierem como undefined devido ao escopo não estar ativo/autorizado
      const hasStats = user.follower_count !== undefined && user.likes_count !== undefined;
      
      return {
        followers: hasStats ? Number(user.follower_count) : null,
        totalViews: 0,
        totalLikes: hasStats ? Number(user.likes_count) : null,
        totalVideos: user.video_count !== undefined ? Number(user.video_count) : null,
        displayName: user.display_name || null,
        avatarUrl: user.avatar_url || null,
        tiktokUserId: user.open_id,
        limitedMetrics: !hasStats,
      };
    }

    console.warn('TikTok API user/info/ com stats falhou ou não retornou dados. Tentando fallback básico...', json);
  } catch (error) {
    console.error('Erro ao buscar métricas completas do TikTok:', error);
  }

  // 2. Fallback: Busca apenas os campos básicos (sem stats)
  try {
    const response = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,video_count',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    const json = await response.json() as any;

    if (response.ok && json.data && json.data.user) {
      const user = json.data.user;
      return {
        followers: null,
        totalViews: 0,
        totalLikes: null,
        totalVideos: user.video_count !== undefined ? Number(user.video_count) : null,
        displayName: user.display_name || null,
        avatarUrl: user.avatar_url || null,
        tiktokUserId: user.open_id,
        limitedMetrics: true,
      };
    }

    throw new Error(json?.error?.message || 'Falha na resposta do TikTok API (fallback básico)');
  } catch (error) {
    console.error('Erro crítico no fallback do TikTok API:', error);
    throw error;
  }
}

/**
 * Busca a lista de vídeos públicos da conta conectada no TikTok.
 */
export async function fetchVideos(accessToken: string): Promise<TikTokVideoItem[]> {
  try {
    const response = await fetch(
      'https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,create_time,like_count,comment_count,share_count,view_count,embed_link',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          max_count: 20,
        }),
      }
    );

    const json = await response.json() as any;

    if (response.ok && json.data && Array.isArray(json.data.videos)) {
      return json.data.videos as TikTokVideoItem[];
    }

    if (json?.error?.code === 'scope_not_authorized' || json?.error?.code === 'permission_denied') {
      console.warn('Escopo de vídeo não autorizado ou sem permissão:', json.error);
      return [];
    }

    console.error('TikTok API video/list/ falhou:', json);
    return [];
  } catch (error) {
    console.error('Erro ao buscar lista de vídeos do TikTok:', error);
    return [];
  }
}

/**
 * Verifica se o token de acesso da conta expirou e renova-o se necessário.
 * Retorna o token de acesso atualizado e ativo.
 */
export async function refreshTokenIfNeeded(accountId: string): Promise<string> {
  const [account] = await db.select()
    .from(tiktokAccounts)
    .where(eq(tiktokAccounts.id, accountId));

  if (!account || !account.accessToken || !account.refreshToken) {
    throw new Error('Conta não está conectada ao TikTok.');
  }

  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // Margem de segurança de 5 minutos
  const isExpired = !account.tokenExpiresAt || new Date(account.tokenExpiresAt).getTime() - now.getTime() <= bufferTime;

  if (!isExpired) {
    return account.accessToken;
  }

  console.log(`Renovando accessToken expirado para a conta ${accountId}...`);

  try {
    const params = new URLSearchParams();
    params.append('client_key', process.env.TIKTOK_CLIENT_KEY || '');
    params.append('client_secret', process.env.TIKTOK_CLIENT_SECRET || '');
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', account.refreshToken);

    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const json = await response.json() as any;

    if (!response.ok || !json.access_token) {
      console.error('Falha ao renovar token do TikTok:', json);
      throw new Error(json?.error_description || json?.error?.message || 'Erro ao renovar token de acesso no TikTok.');
    }

    const newAccessToken = json.access_token;
    const newRefreshToken = json.refresh_token || account.refreshToken;
    const expiresAt = new Date(Date.now() + (json.expires_in || 86400) * 1000);

    await db.update(tiktokAccounts)
      .set({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        tokenExpiresAt: expiresAt,
      })
      .where(eq(tiktokAccounts.id, accountId));

    console.log(`Token da conta ${accountId} renovado com sucesso!`);
    return newAccessToken;
  } catch (error) {
    console.error(`Erro ao renovar token para a conta ${accountId}:`, error);
    throw error;
  }
}
