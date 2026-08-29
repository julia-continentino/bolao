# TaskFlow — Gestao de Equipe e Controle de Tarefas

Plataforma interna para que funcionarios atribuam tarefas uns aos outros,
acompanhem prazos e visualizem quando uma solicitacao foi concluida.
Inclui autenticacao segura com convites individuais por token, permissoes de
administrador/funcionario, notificacoes automaticas de prazo/atraso,
historico de alteracoes e dashboards com indicadores.

## Stack e por que essas escolhas

| Camada | Tecnologia | Motivo |
| --- | --- | --- |
| Frontend + Backend | **Next.js 16 (App Router) + TypeScript** | Um unico projeto full-stack: paginas em Server Components (sem exposicao de dados desnecessaria ao cliente) e Route Handlers como API, sem precisar manter dois servidores/deploys separados. |
| Estilo | **Tailwind CSS v4** | Sistema de design consistente, utilitario, responsivo e leve, sem CSS solto. |
| Banco de dados | **PostgreSQL** | Relacional, maduro, com bom suporte a integridade referencial (usuarios/tarefas/notificacoes/historico) e facil de hospedar (Vercel Postgres, Supabase, Neon, RDS, etc.). |
| ORM | **Prisma** | Migrations versionadas, tipos gerados automaticamente a partir do schema, consultas seguras contra SQL injection. |
| Autenticacao | **Sessao JWT (jose) em cookie httpOnly + bcrypt** | Controle total do fluxo de convite por token (exigencia do projeto), sem depender de um provedor externo. Cookie assinado, `httpOnly`, `secure` em producao, `sameSite=lax`. |
| Validacao | **Zod** | Validacao de entrada no backend (defesa contra dados invalidos/maliciosos) em todas as rotas de API. |

## Estrutura de pastas

```
taskflow/
├─ prisma/
│  ├─ schema.prisma        # Modelo de dados (User, Task, Notification, TaskHistory, InviteToken)
│  ├─ seed.ts               # Dados ficticios de demonstracao
│  └─ migrations/
├─ prisma.config.ts
├─ src/
│  ├─ app/
│  │  ├─ login/             # Tela de login
│  │  ├─ convite/[token]/   # Aceite de convite (define senha e ativa a conta)
│  │  ├─ (app)/             # Grupo de rotas protegidas (sidebar + topbar)
│  │  │  ├─ layout.tsx       # Sessao obrigatoria + sincroniza notificacoes de prazo
│  │  │  ├─ dashboard/       # Dashboard pessoal (funcionario) ou consolidado (admin)
│  │  │  ├─ minhas-tarefas/  # Tarefas atribuidas a mim
│  │  │  ├─ tarefas-solicitadas/ # Tarefas que eu atribui a outros
│  │  │  ├─ tarefas/         # "Todas as tarefas" (lista, admin) e "/tarefas/[id]" (detalhe, qualquer envolvido)
│  │  │  ├─ equipe/          # Gestao de funcionarios (admin)
│  │  │  ├─ notificacoes/    # Central de notificacoes
│  │  │  ├─ perfil/          # Dados da conta + trocar senha
│  │  │  └─ configuracoes/   # Painel administrativo geral
│  │  └─ api/                # Rotas de backend (auth, tasks, users, notifications, cron)
│  ├─ components/            # UI (tabelas, modais, badges, sidebar, filtros...)
│  ├─ lib/                   # Regras de negocio: auth, permissoes, tarefas, notificacoes, historico
│  └─ proxy.ts               # Middleware de autenticacao/autorizacao otimista (Next.js 16 "Proxy")
└─ uploads/                  # Anexos de tarefas (fora da pasta public/, nunca versionado)
```

## Funcionalidades implementadas

- **Autenticacao segura**: sessao assinada (JWT/HS256) em cookie `httpOnly`,
  senhas com hash bcrypt, nenhuma rota de acesso baseada apenas em nome/URL.
- **Convite individual por token**: o admin cadastra o funcionario e recebe
  um link `/convite/<token>` unico, aleatorio (32 bytes), que expira em 7
  dias ou apos o primeiro uso. So depois de definir a propria senha o
  funcionario consegue entrar — o link em si nunca autentica sozinho.
- **Permissoes por perfil**: `proxy.ts` faz uma checagem otimista de rota e
  cada pagina/rota de API repete a checagem "de verdade" (`requireUser`,
  `requireAdmin`, `canViewTask`, `canEditTask`, `canCompleteTask`) direto no
  banco, para nao expor dados de outros funcionarios.
- **Ciclo de vida da tarefa**: criacao (status inicial `A fazer`, data de
  solicitacao automatica), edicao pelo solicitante/admin, conclusao pelo
  responsavel/admin com data/hora de conclusao registradas automaticamente
  (nunca digitadas manualmente), reabertura opcional.
- **Atraso calculado dinamicamente**: nunca fica "preso" em um status —
  toda tarefa com prazo vencido e status `A fazer` e sinalizada como
  atrasada, com contagem de dias, sem precisar de um status extra.
- **Notificacoes automaticas**: tarefa atribuida, vencendo hoje, vencendo
  amanha, atrasada e concluida (no prazo ou com atraso), com contagem de
  nao lidas na barra lateral e central dedicada.
- **Historico de tarefa**: toda criacao/edicao/conclusao/reabertura fica
  registrada com autor, data/hora e valores antigo/novo.
- **Anexos**: upload/download autenticado e autorizado por tarefa (arquivos
  ficam fora de `public/`, servidos por uma rota que reaplica as mesmas
  regras de permissao da tarefa).
- **Dashboards**: indicadores pessoais (funcionario) e consolidados da
  equipe (admin: total de funcionarios, abertas, concluidas, atrasadas,
  vencendo em breve, criadas nos ultimos 30 dias, % concluidas no prazo,
  tarefas por funcionario).
- **Busca e filtros**: por status, prioridade, responsavel, solicitante,
  atrasadas, vencendo hoje/7 dias, alta prioridade e palavra-chave.
- **Responsivo**: tabelas viram cards em telas pequenas, menu lateral vira
  gaveta (drawer) no mobile.

## Como rodar localmente

### 1. Pre-requisitos

- Node.js 20+
- PostgreSQL 14+ (local ou remoto)

### 2. Instalar dependencias

```bash
cd taskflow
npm install
```

### 3. Configurar o banco de dados

Crie um banco e um usuario dedicados (ajuste os valores como preferir):

```bash
sudo -u postgres psql -c "CREATE USER taskflow WITH PASSWORD 'taskflow';"
sudo -u postgres psql -c "CREATE DATABASE taskflow OWNER taskflow;"
sudo -u postgres psql -c "ALTER USER taskflow CREATEDB;"  # necessario para o shadow database do Prisma Migrate
```

### 4. Variaveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` e gere um `SESSION_SECRET` forte:

```bash
openssl rand -base64 32
```

### 5. Rodar as migrations e popular dados de demonstracao

```bash
npm run db:migrate   # cria as tabelas (prisma migrate dev)
npm run db:seed      # popula 1 admin + 5 funcionarios + tarefas de exemplo
```

### 6. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### Credenciais de demonstracao (dados ficticios, nao reais)

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | `ana.admin@taskflow.local` | `admin123` |
| Funcionario | `bruno.santos@taskflow.local` | `senha123` |
| Funcionario | `carla.souza@taskflow.local` | `senha123` |
| Funcionario | `diego.lima@taskflow.local` | `senha123` |
| Funcionario | `elisa.rocha@taskflow.local` | `senha123` |

Um sexto usuario (`Fabio Alves`) e criado com convite **pendente** (sem
senha) para demonstrar o fluxo de primeiro acesso: em `/equipe`, abra o
perfil dele e clique em "Gerar novo link de convite" para obter a URL de
ativacao.

> Altere essas senhas (ou remova os dados de seed) antes de qualquer uso
> real. Elas existem apenas para avaliacao do sistema.

## Scripts disponiveis

| Comando | Descricao |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de producao |
| `npm run start` | Roda o build de producao |
| `npm run lint` | ESLint |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | Popula o banco com dados ficticios |
| `npm run db:studio` | Abre o Prisma Studio (inspecionar o banco) |

## Notificacoes de prazo em producao

A checagem de tarefas vencendo/atrasadas roda automaticamente a cada
acesso autenticado (no layout protegido). Para garantir que ela rode mesmo
sem trafego, configure um agendador externo para chamar periodicamente:

```
POST /api/cron/sync-notifications
Authorization: Bearer <CRON_SECRET>   # se CRON_SECRET estiver definido
```

Exemplos: [Vercel Cron](https://vercel.com/docs/cron-jobs) (arquivo
`vercel.json` com um cron apontando para essa rota) ou um workflow
agendado no GitHub Actions com `curl`.

## Deploy

### Opcao recomendada: Vercel + Postgres gerenciado

1. Suba um Postgres gerenciado (Vercel Postgres, Neon, Supabase ou RDS) e
   copie a connection string.
2. Crie um projeto na Vercel apontando para a pasta `taskflow/`.
3. Configure as variaveis de ambiente do projeto na Vercel:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `APP_URL` (URL publica do deploy)
   - `CRON_SECRET` (opcional)
4. Rode as migrations contra o banco de producao (uma vez, a partir da sua
   maquina ou de um passo de deploy):
   ```bash
   npx prisma migrate deploy
   ```
5. (Opcional) rode `npm run db:seed` uma unica vez se quiser dados de
   demonstracao em producao — normalmente **nao** recomendado fora de um
   ambiente de teste.
6. Configure um cron (ver secao anterior) apontando para
   `/api/cron/sync-notifications`.

### Alternativa: container Docker generico

Qualquer host que rode Node 20+ funciona (Railway, Render, Fly.io, um VPS
com PM2, etc.):

```bash
npm ci
npm run build
npx prisma migrate deploy
npm run start
```

Garanta que:

- `DATABASE_URL` aponte para um Postgres acessivel pelo servidor.
- `SESSION_SECRET` seja um valor longo e aleatorio, diferente por ambiente.
- A pasta `uploads/` tenha um volume persistente (senao os anexos somem a
  cada deploy).
- O trafego HTTPS esteja garantido (o cookie de sessao usa `secure` em
  producao, exigindo TLS).

## Seguranca

- Senhas nunca sao armazenadas em texto puro (bcrypt, 12 rounds).
- Sessao em cookie assinado (`httpOnly`, `secure` em producao,
  `sameSite=lax`), nunca em `localStorage`.
- Links de convite usam token aleatorio de 32 bytes, de uso unico e com
  expiracao — nunca o nome do funcionario como identificador.
- Toda rota de API valida a sessao e o perfil (`requireApiUser`/
  `requireApiAdmin`) antes de tocar o banco; paginas fazem o mesmo com
  `requireUser`/`requireAdmin`.
- Acesso a uma tarefa especifica (`/tarefas/[id]` e o download do anexo)
  exige ser o solicitante, o responsavel ou um administrador
  (`canViewTask`), mesmo que o usuario conheça o ID.
- Entradas de formulario sao validadas no cliente e novamente no servidor
  com Zod antes de qualquer escrita no banco.
