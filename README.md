# Farol

Sistema de IA para Retenção e Customer Success (CS). O Farol calcula o risco de churn de clientes SaaS B2B, mostra os que mais precisam de atenção e sugere ações de retenção.

Fluxo principal: **dados dos clientes → cálculo do risco → classificação → painel de CS → sugestão de ação de retenção.**

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS (Vite) |
| Banco / Auth / backend | Supabase (PostgreSQL 14+) |
| Classificação de risco por IA | Edge Function do Supabase (`supabase/functions/classificar-risco`) chamando a OpenAI (`gpt-4o-mini` por padrão) |

O frontend fala direto com o Supabase (`supabase-js`): leituras via tabelas/views e escritas via `rpc()` nas stored procedures. Não há API própria: a classificação roda numa Edge Function, chamada pelo frontend ao concluir uma operação de importação.

## Estrutura de pastas

```
farol-projeto/
├── db/                    # Banco de dados (executar em ordem)
│   ├── 01_schema.sql      # Tipos, tabelas, constraints, triggers e catálogos
│   ├── 02_procedures.sql  # sp_importar_lote, sp_calcular_risco_cliente, fn_clientes_para_atualizar
│   ├── 03–07              # RPCs, score por regras, importação de uso/atend./NPS, RLS, SECURITY DEFINER
│   ├── 08–09              # Validação de CNPJ e isolamento de dados por conta
│   └── seeds/             # 4 CSVs sintéticos (50 clientes, uso, atendimentos, NPS)
├── web/                   # Frontend React + TS + Tailwind
│   ├── public/
│   ├── src/
│   │   ├── components/    # Componentes reutilizáveis (tabela, badge de risco, ...)
│   │   ├── pages/         # Importar, Painel, Detalhe do cliente
│   │   ├── hooks/         # Acesso a dados (usePainel, useCliente, ...)
│   │   ├── lib/           # Cliente Supabase e utilitários
│   │   └── types/         # Tipos TS espelhando o schema
│   └── .env.example       # VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
├── supabase/functions/    # Edge Function classificar-risco (OpenAI)
├── agent/                 # reservado (vazio)
└── docs/
    ├── requisitos/        # TAP, manual, casos de uso, diagramas e entrega do banco
    └── diagramas/         # Diagramas exportados / fontes
```

## Escopo da Versão Alpha

Casos de uso priorizados: **UC01** cadastrar cliente, **UC02** importar dados, **UC06/UC07** calcular e classificar risco, **UC08** painel de clientes em risco, **UC09** detalhes do cliente, **UC10** sugestões de retenção e **UC12** atualizar análise. O ranking destaca ao lado do nome os cadastros com dados ausentes ou inválidos; o perfil também alerta sobre inconsistências e permite editar as informações básicas. Durante a edição, o campo de CNPJ indica visualmente se o número é válido.

Ficam para depois a origem por API simulada e um agente de IA mais completo. A priorização (UC11) sai da ordenação do painel.

O recorte completo, os itens adiados e o roteiro de demonstração estão em [`docs/ESCOPO_ALPHA.md`](docs/ESCOPO_ALPHA.md). Registre o resultado dos testes TA01–TA15 em [`docs/CHECKLIST_ALPHA.md`](docs/CHECKLIST_ALPHA.md).

## Como rodar

### 1. Banco de dados
1. Crie um projeto no Supabase.
2. No SQL Editor, execute em ordem: `db/01_schema.sql`, `02_procedures.sql`, `03_rpc.sql`, `04_score_provisorio.sql`, `05_importar_complementos.sql`, `06_rls.sql`, `07_rpc_definer.sql` e `09_isolamento_contas.sql`.
3. **Sempre que rodar de novo o 02–05, rode o 07 em seguida:** `CREATE OR REPLACE` desfaz o `SECURITY DEFINER` das funções.

Para um banco já existente, execute `db/08_validar_cnpj.sql` e depois reaplique `db/02_procedures.sql`, `db/05_importar_complementos.sql` e `db/07_rpc_definer.sql`. A migração interrompe com uma mensagem explícita caso já existam CNPJs inválidos; corrija esses registros antes de tentar novamente.

Em banco já existente, execute `db/09_isolamento_contas.sql` para restringir clientes e dados relacionados ao `usuario_id` da conta autenticada. Registros antigos sem proprietário ficam ocultos; antes de atribuí-los, confirme quem é o dono correto. Depois, publique novamente a Edge Function `classificar-risco`.

### 2. Edge Function de classificação (IA)
```bash
supabase secrets set OPENAI_API_KEY=sk-...        # opcional: OPENAI_MODEL=<modelo>
supabase functions deploy classificar-risco
```
A função processa os clientes pendentes (`fn_clientes_para_atualizar`), pede à OpenAI a **intensidade (0–1) de cada fator** e grava `score = soma(peso × intensidade)`. Se a OpenAI falhar, cai no cálculo por regras (`04_score_provisorio.sql`).

### 3. Dados de teste
Em `db/seeds/` há 4 CSVs válidos (50 clientes, uso, atendimentos e NPS) e `5_cliente_cnpj_invalido.csv`, um caso negativo para testar a rejeição de CNPJ inválido. Na tela **Importar**, selecione os arquivos desejados e envie com um clique. Cada arquivo é processado em uma chamada separada, os clientes são enviados primeiro e a classificação é disparada uma vez ao final. A tela também oferece um modelo CSV para cada tipo; CNPJs inválidos, inclusive com dígitos verificadores incorretos, são rejeitados por linha. No cadastro manual, o CNPJ inválido é barrado antes do envio ao banco.

### 4. Frontend
```bash
cd web
cp .env.example .env   # preencha com a URL e a anon key do projeto
npm install
npm run dev
```

> O `web/` já está inicializado (Vite + React + TS + Tailwind v4 + `supabase-js`). O cliente Supabase está em `web/src/lib/supabase.ts`.

## Pendências conhecidas

- **Qualidade da IA:** o `gpt-4o-mini` erra contas (queda percentual, janela de 90 dias) e omite fatores. Plano: calcular as intensidades no código e deixar a IA só para ajuste limitado e justificativa. A distribuição de níveis também sai torta (poucos MÉDIO); revisar réguas/limiares do `modelo_ia`.
- Cada conta autenticada acessa apenas os próprios clientes e dados relacionados; contas não compartilham clientes.
- A Edge Function processa até 50 clientes pendentes por execução, com até 8 em paralelo. Confira o resumo e execute a atualização novamente se ainda houver clientes pendentes.
- Sem testes automatizados; os resultados dos testes de aceitação TA01–TA15 devem ser registrados em [`docs/CHECKLIST_ALPHA.md`](docs/CHECKLIST_ALPHA.md).

## Documentação

Casos de uso, diagramas, TAP e manual do projeto estão em [docs/requisitos/](docs/requisitos/); escopo e checklist de aceite estão em [`docs/ESCOPO_ALPHA.md`](docs/ESCOPO_ALPHA.md) e [`docs/CHECKLIST_ALPHA.md`](docs/CHECKLIST_ALPHA.md).

O passo a passo de publicação e CI/CD está em [docs/DEPLOY_FIREBASE.md](docs/DEPLOY_FIREBASE.md). O workflow valida pull requests, cria previews temporários e publica automaticamente a branch `main` no Firebase Hosting.

## Prazos

- 22/10–25/10/2026: preparação do ambiente e dos dados de teste
- 26/10–30/10/2026: execução dos testes de aceitação com o PO
- 04/11/2026: Entrega 09, testes de aceitação
