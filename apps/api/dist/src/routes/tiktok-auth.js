import { Hono } from 'hono';
import { db } from '../db/index.js';
import { tiktokAccounts } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { auth } from '../auth.js';
import { fetchProfileMetrics } from '../services/tiktok.service.js';
import crypto from 'crypto';
export const tiktokAuthRouter = new Hono();
// Map em memória para armazenar temporariamente o code_verifier indexado pelo state (accountId)
const pkceStore = new Map();
// 1. GET /connect/:accountId -> Redireciona o usuario para o TikTok login com PKCE
tiktokAuthRouter.get('/connect/:accountId', async (c) => {
    // Obter sessao do usuario logado
    const session = await auth.api.getSession({
        headers: c.req.raw.headers
    });
    if (!session || !session.user) {
        return c.text('Não autorizado', 401);
    }
    const user = session.user;
    const accountId = c.req.param('accountId');
    // Validar se a conta pertence ao usuario logado
    const [account] = await db.select()
        .from(tiktokAccounts)
        .where(and(eq(tiktokAccounts.id, accountId), eq(tiktokAccounts.userId, user.id)));
    if (!account) {
        return c.text('Conta não encontrada ou não pertence ao seu usuário.', 404);
    }
    const clientKey = process.env.TIKTOK_CLIENT_KEY || '';
    const redirectUri = process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3000/api/auth/tiktok/callback';
    // Solicitamos user.info.basic, user.info.stats (pode falhar graciosamente), e video.list
    const scopes = 'user.info.basic,user.info.stats,video.list';
    const state = accountId; // Passamos o accountId no state para saber qual conta atualizar no callback
    // Gerar o code_verifier (string aleatória 43-128 chars)
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    // Gerar o code_challenge = SHA256(code_verifier) em hex
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('hex');
    // Salvar o code_verifier temporariamente associado ao state
    pkceStore.set(state, codeVerifier);
    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scopes}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    console.log(`Iniciando OAuth para conta ${accountId} com PKCE. Redirecionando para TikTok...`);
    return c.redirect(authUrl);
});
// 2. GET /callback -> Recebe o "code" do TikTok e troca pelos tokens com PKCE
tiktokAuthRouter.get('/callback', async (c) => {
    const code = c.req.query('code');
    const accountId = c.req.query('state'); // O state contem o accountId
    const error = c.req.query('error');
    const errorDescription = c.req.query('error_description');
    const frontendUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
    if (error || !code || !accountId) {
        console.error('Falha no callback do TikTok:', { error, errorDescription, code, accountId });
        const targetAccountId = accountId || '';
        return c.redirect(`${frontendUrl}/accounts/${targetAccountId}?error=oauth_failed`);
    }
    // Recuperar o code_verifier salvo pelo state
    const codeVerifier = pkceStore.get(accountId);
    pkceStore.delete(accountId); // Limpar após o uso
    if (!codeVerifier) {
        console.error(`Code verifier não encontrado para o state: ${accountId}`);
        return c.redirect(`${frontendUrl}/accounts/${accountId}?error=oauth_failed`);
    }
    try {
        const clientKey = process.env.TIKTOK_CLIENT_KEY || '';
        const clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';
        const redirectUri = process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3000/api/auth/tiktok/callback';
        console.log(`Trocando código de autorização para conta ${accountId} usando PKCE...`);
        const params = new URLSearchParams();
        params.append('client_key', clientKey);
        params.append('client_secret', clientSecret);
        params.append('code', code);
        params.append('grant_type', 'authorization_code');
        params.append('redirect_uri', redirectUri);
        params.append('code_verifier', codeVerifier);
        const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });
        const json = await response.json();
        if (!response.ok || !json.access_token) {
            console.error('Falha ao obter token de acesso no callback do TikTok:', json);
            return c.redirect(`${frontendUrl}/accounts/${accountId}?error=oauth_failed`);
        }
        const accessToken = json.access_token;
        const refreshToken = json.refresh_token;
        const tiktokUserId = json.open_id;
        const expiresSeconds = json.expires_in || 86400; // Default a 24 horas se ausente
        const tokenExpiresAt = new Date(Date.now() + expiresSeconds * 1000);
        let displayName = null;
        let limitedMetrics = false;
        // Tentar obter dados do perfil inicial e status do escopo
        try {
            console.log('Buscando métricas e informações do perfil para a nova conexão...');
            const profileMetrics = await fetchProfileMetrics(accessToken);
            displayName = profileMetrics.displayName;
            limitedMetrics = profileMetrics.limitedMetrics;
        }
        catch (profileErr) {
            console.error('Erro não-crítico ao buscar perfil inicial do TikTok na conexão:', profileErr);
        }
        // Salvar tokens, displayName e status limitador na tabela tiktok_accounts
        await db.update(tiktokAccounts)
            .set({
            tiktokUserId,
            accessToken,
            refreshToken,
            tokenExpiresAt,
            displayName: displayName || undefined,
            limitedMetrics,
        })
            .where(eq(tiktokAccounts.id, accountId));
        console.log(`Conta ${accountId} integrada com sucesso com o TikTok UserId: ${tiktokUserId}. Métricas Limitadas: ${limitedMetrics}`);
        return c.redirect(`${frontendUrl}/accounts/${accountId}`);
    }
    catch (err) {
        console.error('Erro crítico no processamento do callback do TikTok:', err);
        return c.redirect(`${frontendUrl}/accounts/${accountId}?error=oauth_failed`);
    }
});
