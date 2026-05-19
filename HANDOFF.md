# TikDash — Handoff

## Última atualização
2026-05-19T18:54:00-03:00

## O que foi feito nesta sessão
- Setup inicial do monorepo usando npm workspaces e Turborepo.
- Criação e configuração de `apps/web` (Next.js 14+) com Tailwind e shadcn/ui.
- Criação e configuração de `apps/api` (Hono).
- Configuração do Drizzle ORM e esquema PostgreSQL.
- Implementação de autenticação baseada em Better Auth (client e server).
- Utilitários de criptografia AES-256 (`encrypt`/`decrypt`).
- Criação de seed script para o usuário inicial.
- Desenvolvimento das rotas da API (CRUD de contas TikTok e reveal de senha).

## Estado atual
- Backend (API) com a estrutura inicial completa para contas.
- Banco de dados tipado e configurado para acesso via Drizzle.

## Próximo passo imediato
- Iniciar o desenvolvimento das telas no frontend (Next.js): `/login`, `/dashboard`, `/accounts/new`, etc.

## Arquivos relevantes tocados
- `package.json`, `turbo.json`
- `apps/api/src/db/schema.ts`
- `apps/api/src/routes/accounts.ts`
- `apps/api/src/utils/crypto.ts`
- `apps/web/src/lib/auth-client.ts`
- `task.md`

## Decisões tomadas
- Usar `npm workspaces` nativo.
- Banco de dados usa driver `postgres` padrão via Drizzle.
- `Better Auth` configurado com e-mail/senha.

## Bloqueios / dúvidas em aberto
- Como o banco Railway ainda não possui a variável `DATABASE_URL` conectada a um BD real, será necessário rodar `npm run db:push` quando o BD estiver online para instanciar as tabelas.
