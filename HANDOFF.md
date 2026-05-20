# TikDash — Handoff

## Última atualização
2026-05-20T01:32:30-03:00

## O que foi feito nesta sessão

### 1. Suporte a PKCE no Fluxo OAuth do TikTok (Concluída - Correção de Erro 10007)
Corrigimos a integração do OAuth do TikTok para cumprir a obrigatoriedade de PKCE (Proof Key for Code Exchange):
- **Geração Segura**:
  - No endpoint `GET /tiktok/connect/:accountId` de [tiktok-auth.ts](file:///Users/nilber.mota/Documents/tikdash/apps/api/src/routes/tiktok-auth.ts), geramos o `code_verifier` (base64url de 32 bytes aleatórios) e derivamos o `code_challenge` usando SHA256 em formato hexadecimal.
  - Adicionados os parâmetros `code_challenge` e `code_challenge_method=S256` na URL de redirecionamento oficial do TikTok.
- **Armazenamento Temporário**:
  - Criado o `pkceStore` (um Map em memória no backend Hono) indexado pelo `state` (que carrega o `accountId`) para manter os verifiers persistidos de forma segura durante a jornada do usuário.
- **Troca e Limpeza**:
  - No callback `GET /tiktok/callback`, recuperamos e apagamos o `code_verifier` correspondente e o anexamos no POST de troca de token (`https://open.tiktokapis.com/v2/oauth/token/`).
- **Validação**:
  - Monorepo testado e compilado com sucesso via `npm run build` após a correção.

### 2. Fase 4 — Integração com a TikTok Display API & OAuth Flow (Concluída)
Implementamos toda a integração oficial com a API do TikTok para conexões de contas em tempo real:
- **Drizzle Database Schema**:
  - Adicionada a coluna `limitedMetrics` (`boolean`) na tabela `tiktokAccounts` para registrar o estado de escopo limitado persistido no banco de dados. Sincronização executada com sucesso com o banco Postgres do Neon via `db:push`.
- **Hono Backend (`apps/api`)**:
  - **Serviço TikTok (`tiktok.service.ts`)**: Implementados os métodos `fetchProfileMetrics` (com tratamento de fallback), `fetchVideos` (para baixar os últimos 20 posts) e `refreshTokenIfNeeded` (renovação automática se o token expirar em menos de 5 min).
  - **Tratamento gracioso para o scope `user.info.stats`**: Caso a sua aplicação não tenha o escopo de estatísticas aprovado pelo TikTok, o Hono não quebra o fluxo de integração nem de sincronização. Ele captura o erro e retorna `null` para seguidores e curtidas, usando inteligentemente o histórico local para manter o banco estável.
  - **OAuth 2.0 (`tiktok-auth.ts`)**: Troca do `code` por tokens oficiais e verificação imediata das métricas do perfil conectado.
  - **Manual Sync (`POST /accounts/:id/sync`)**: Atualiza as informações do perfil, preenche o snapshot diário (preservando o histórico anterior em caso de escopo bloqueado) e puxa a lista de vídeos, inserindo novas postagens e atualizando dados de engajamento de vídeos já salvos.
- **Next.js Frontend Proxy (`apps/web`)**:
  - Criado o arquivo `apps/web/src/app/api/auth/tiktok/callback/route.ts` que escuta o callback oficial do TikTok e atua como proxy, redirecionando o fluxo de forma segura com `code` e `state` para o backend Hono.
- **Premium UI Update (`/accounts/[id]`)**:
  - O botão de conectar/sincronizar agora é dinâmico: se não possui token, exibe **"Conectar TikTok"** em um gradiente premium; se possui, exibe **"Sincronizar TikTok"** com ícone animado durante a chamada.
  - Exibe a mensagem de alerta exatamente como solicitado no topo do painel caso o escopo esteja restrito:
    > ⚠️ **Métricas limitadas — scope não aprovado pelo TikTok**
    > O TikDash continua operando graciosamente: você pode cadastrar manualmente as métricas diárias clicando no botão "Registrar Métricas Hoje".
  - Toast/Notificação integrada informando o sucesso ou o status de métricas limitadas após a sincronização manual.

### 3. Fase 2 — Evolução de Métricas Diárias (Concluída em Sessão Anterior)
- Snapshots com validação diária (realiza UPDATE caso já haja snapshot no dia, ou INSERT se for o primeiro do dia).
- Mini-cards de KPIs dinâmicos atualizados dinamicamente pelo último snapshot ou sincronização da API.
- Gráfico neon animado com `Recharts` (`LineChart`) com Tooltip customizada de vidro para evolução de seguidores ao longo do tempo.
- Modal de cadastro/edição manual de métricas com preenchimento automático inteligente.

### 4. Fase 3 — Vídeos (Concluída em Sessão Anterior)
- Endpoints de CRUD completo `/accounts/:id/videos` (`GET`, `POST`, `PUT`, `DELETE`).
- Tabela moderna de postagens com thumbnails, títulos, link de atalho externo e status badges (`ativo`, `pausado`, `removido`).
- Modals para Adicionar Vídeo, Editar Estatísticas e Exclusão Segura.

---

## Estado atual
- **Backend (API)**: 100% completo, com Drizzle schemas sincronizados, controle de expiração de tokens, PKCE configurado para evitar erros de autenticação do TikTok, e tratamento gracioso de escopo.
- **Frontend (Web App)**: Totalmente integrado com a API Hono, com suporte a fluxos de OAuth, sincronização em um clique, avisos de restrição, e tabelas de controle.
- **Compilação**: `npm run build` executado e aprovado com 100% de sucesso em todo o monorepo!

---

## Próximo passo imediato
- **Workers para Sincronização em Lote**: Implementar um worker recorrente no backend para automatizar a sincronização periódica de perfis e posts.

---

## Arquivos relevantes tocados
- [schema.ts](file:///Users/nilber.mota/Documents/tikdash/apps/api/src/db/schema.ts) [MODIFY]
- [tiktok.service.ts](file:///Users/nilber.mota/Documents/tikdash/apps/api/src/services/tiktok.service.ts) [NEW]
- [tiktok-auth.ts](file:///Users/nilber.mota/Documents/tikdash/apps/api/src/routes/tiktok-auth.ts) [NEW - PKCE adicionado]
- [accounts.ts](file:///Users/nilber.mota/Documents/tikdash/apps/api/src/routes/accounts.ts) [MODIFY]
- [route.ts](file:///Users/nilber.mota/Documents/tikdash/apps/web/src/app/api/auth/tiktok/callback/route.ts) [NEW]
- [page.tsx](file:///Users/nilber.mota/Documents/tikdash/apps/web/src/app/accounts/%5Bid%5D/page.tsx) [MODIFY]
- [HANDOFF.md](file:///Users/nilber.mota/Documents/tikdash/HANDOFF.md) [MODIFY]
