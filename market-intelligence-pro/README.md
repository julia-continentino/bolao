# Market Intelligence Pro

Plataforma web de inteligência de mercado: pesquisas setoriais, benchmarking financeiro e relatórios corporativos elaborados por uma equipe de seis agentes de IA. Todos os números trazem fonte verificável, natureza (histórico, estimativa ou projeção) e status de verificação.

## Fluxo

1. **Nova pesquisa de mercado**: setor, região, período (histórico e projeção), objetivo e questões prioritárias.
2. **Especialistas virtuais** (`src/lib/ai/pipeline.ts`):
   - *Senior Market Research Analyst*, *Financial Analyst & Valuation Specialist* e *Macroeconomic & Industry Economist* trabalham em paralelo, com busca web real (ferramenta `web_search` do Claude) e APIs oficiais.
   - *Data Research & Verification Specialist* faz checagens automáticas e um parecer crítico, com buscas adicionais para cruzar números.
   - *Data Visualization & Business Report Designer* sugere gráficos e tabelas.
   - *Research Director & Quality Reviewer* escreve as conclusões, responde às questões do cliente e avalia a qualidade.
3. **Research Workspace** com 10 seções. Cada seção pode ser expandida, editada, copiada ou regenerada.
4. **Data Visualization Studio** permite trocar o tipo de gráfico, título, indicadores, períodos e empresas, cores e legenda. Também mostra a fonte e exporta PNG ou Excel.
5. **Criar relatório personalizado**:
   - Escolha da quantidade exata de parágrafos, para o relatório inteiro ou por seção.
   - Escolha da profundidade: executivo, analítico ou técnico.
   - Escolha das visualizações: apenas texto, gráficos, tabelas, ambos, ou seleção manual em uma galeria.
   - Formato: valuation, setorial, consultoria, memorando, apresentação executiva ou personalizado.
   - Quantidade-alvo de páginas ou slides.
6. **Exportação**:
   - PowerPoint, com gráficos e tabelas nativos editáveis.
   - Word e PDF, com gráficos, tabelas e referências numeradas.
   - Excel, com a base numérica, as fontes e a verificação.
7. **Biblioteca**: projetos salvos com histórico de versões ("Atualizar informações", "Modificar parâmetros"), revisões de relatórios e modelos de layout reutilizáveis.

## Integridade dos dados

As regras abaixo são aplicadas pelo código, não apenas pedidas no prompt:

- **URLs confirmadas.** Cada fonte citada é comparada com as URLs que a busca realmente retornou na execução. Uma fonte que não aparece ali recebe o rótulo "URL não confirmada". Um dataset que só cita fontes não confirmadas nunca passa de "não verificado".
- **APIs oficiais sem transcrição.** Os dados do Banco Central (SGS), do Banco Mundial (WDI), do FMI (WEO) e da SEC (XBRL) entram nos datasets direto da API, sem passar pelo modelo (`src/lib/data/*`).
- **Datasets rejeitados.** Um dataset rejeitado na verificação não pode ser usado em gráficos, nem pela interface nem pela API.
- **Checagens automáticas** (`src/lib/verification.ts`):
  - linhas sem fonte;
  - moeda ou unidade ausente;
  - margens fora de ±100%;
  - participações que somam mais de 100%;
  - projeção própria sem metodologia;
  - parágrafos com números e sem fonte.
- **Reescrita sem fatos novos.** Ao reescrever, a IA é instruída a não introduzir números novos. O número de parágrafos é validado por esquema: a resposta precisa ter exatamente N.
- **Estimativas sinalizadas.** Estimativas e projeções aparecem com sufixo E/P e marcas mais claras nos gráficos.
- **Sem simulação.** Sem `ANTHROPIC_API_KEY`, a plataforma informa que a integração não está configurada e não exibe resultados simulados.

## Stack

- Next.js 15 (App Router), TypeScript e Tailwind CSS
- PostgreSQL com Prisma (compatível com Supabase via `DATABASE_URL`)
- Claude (`@anthropic-ai/sdk`): busca web, ferramentas próprias e saída estruturada validada com Zod
- Recharts para os gráficos
- pptxgenjs, docx, pdfkit e exceljs para a exportação
- Autenticação própria: bcrypt, JWT em cookie httpOnly e middleware de proteção de rotas

## Configuração

```bash
cd market-intelligence-pro
cp .env.example .env        # preencha DATABASE_URL, AUTH_SECRET, ANTHROPIC_API_KEY
npm install
npx prisma db push          # cria as tabelas
npm run build && npm start  # ou: npm run dev
```

Variáveis de ambiente:

| Variável | Uso |
|---|---|
| `DATABASE_URL` | PostgreSQL ou Supabase |
| `AUTH_SECRET` | Segredo das sessões, com no mínimo 24 caracteres |
| `ANTHROPIC_API_KEY` | Obrigatória para pesquisas e relatórios. A busca web precisa estar habilitada na organização do Console Anthropic |
| `AI_MODEL` / `AI_EFFORT` | Padrão `claude-opus-5-5` / `high` |
| `AI_MAX_SEARCHES_PER_AGENT` | Limite de buscas por agente (padrão 10) |
| `SEC_USER_AGENT` | Nome e e-mail exigidos pela SEC. Se vazio, a integração SEC fica desativada |

O servidor precisa de acesso de saída a:

- `api.anthropic.com`
- `api.bcb.gov.br`
- `api.worldbank.org`
- `www.imf.org`
- `data.sec.gov` e `www.sec.gov`

## Publicar no Railway

O arquivo `railway.json` já define os comandos de build, de início (que cria as tabelas no banco) e o health check em `/api/status`.

1. Em railway.com, entre com o GitHub: **New Project → Deploy from GitHub repo → `bolao`**.
2. No serviço criado, em **Settings**, defina **Root Directory** = `market-intelligence-pro`. Se o Railway não aplicar os comandos do `railway.json`, informe em **Config-as-code** o caminho `/market-intelligence-pro/railway.json`.
3. No projeto: **New → Database → PostgreSQL**.
4. Em **Variables** do serviço do app: `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`, `AUTH_SECRET`, `ANTHROPIC_API_KEY` e, opcionalmente, `AI_MODEL`, `AI_EFFORT` e `SEC_USER_AGENT`.
5. **Settings → Networking → Generate Domain** e acesse o endereço gerado.

## Observações de implantação

- As pesquisas, que levam de 5 a 15 minutos, rodam em segundo plano no processo Node.js (`next start`). Em hospedagem serverless, mova `runResearch`/`generateReport` para um worker ou fila, como Inngest, BullMQ ou Supabase Queues.
- Uma execução interrompida por reinício do servidor é marcada como falha. O usuário pode criar uma nova versão.
- CVM, B3, IBGE/SIDRA, IPEA e OCDE são consultados pela busca web, com prioridade nas instruções dos agentes. Ainda não há integração direta por API, porque a CVM publica dados abertos em arquivos CSV em lote. Bases financeiras privadas exigem integração licenciada.
