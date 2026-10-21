# Farol

Sistema de IA para Retenção e Customer Success (CS). O Farol calcula o risco de churn de clientes SaaS B2B, mostra os que mais precisam de atenção e sugere ações de retenção.

Fluxo principal: **dados dos clientes → cálculo do risco → classificação → painel de CS → sugestão de ação de retenção.**

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS (Vite) |
| Banco / Auth / backend | Supabase (PostgreSQL 14+) |
| Classificação de risco por IA | Edge Function do Supabase (`supabase/functions/classificar-risco`) chamando a OpenAI (`gpt-4o-mini` por padrão) |

O frontend fala direto com o Supabase (`supabase-js`): leituras via tabelas/views, escritas via `rpc()` nas stored procedures. Não há API própria: a classificação de risco roda numa Edge Function, chamada pelo frontend após cada importação.

## Estrutura de pastas

```
farol-projeto/
├── db/                    # Banco de dados (executar em ordem)
│   ├── 01_schema.sql      # Tipos, tabelas, constraints, triggers e catálogos
│   ├── 02_procedures.sql  # sp_importar_lote, sp_calcular_risco_cliente, fn_clientes_para_atualizar
│   ├── 03–07              # RPCs, score por regras, importação de uso/atend./NPS, RLS, SECURITY DEFINER
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

## Escopo do MVP

Casos de uso priorizados: **UC02** importar dados, **UC06/UC07** calcular e classificar risco, **UC08** painel de clientes em risco, **UC09** detalhes do cliente, **UC10** sugestões de retenção e **UC12** atualizar análise.

Ficam para depois: UC01 (cadastro manual) e um agente de IA mais completo. A priorização (UC11) sai da ordenação do painel.

## Como rodar

### 1. Banco de dados
1. Crie um projeto no Supabase.
2. No SQL Editor, execute em ordem: `db/01_schema.sql`, `02_procedures.sql`, `03_rpc.sql`, `04_score_provisorio.sql`, `05_importar_complementos.sql`, `06_rls.sql` e `07_rpc_definer.sql`.
3. **Sempre que rodar de novo o 02–05, rode o 07 em seguida:** `CREATE OR REPLACE` desfaz o `SECURITY DEFINER` das funções.

### 2. Edge Function de classificação (IA)
```bash
supabase secrets set OPENAI_API_KEY=sk-...        # opcional: OPENAI_MODEL=<modelo>
supabase functions deploy classificar-risco
```
A função processa os clientes pendentes (`fn_clientes_para_atualizar`), pede à OpenAI a **intensidade (0–1) de cada fator** e grava `score = soma(peso × intensidade)`. Se a OpenAI falhar, cai no cálculo por regras (`04_score_provisorio.sql`).

### 3. Dados de teste
Em `db/seeds/` há 4 CSVs (50 clientes, uso, atendimentos e NPS). Na tela **Importar**, importe nesta ordem: Clientes → Uso → Atendimentos → NPS. A cada importação a classificação é disparada.

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
- RLS do MVP é simples: qualquer usuário logado acessa tudo. Sem isolamento por empresa/equipe.
- A importação roda ~18 s após a classificação (8 clientes em paralelo, até 50 por chamada); acima disso, importar de novo.
- O banco real tem ajustes feitos pelo dashboard (ex.: `fn_importar_lote` com `p_usuario_id`) que ainda não estão em `db/`.
- Sem testes automatizados; testes de aceitação TA01–TA14 ainda não executados.

## Documentação

Tudo em [docs/requisitos/](docs/requisitos/): casos de uso e testes de aceitação TA01–TA14, diagramas de classe, estado e sequência, TAP e manual do projeto.

## Prazos

- 22/10–25/10/2026: preparação do ambiente e dos dados de teste
- 26/10–30/10/2026: execução dos testes de aceitação com o PO
- 04/11/2026: Entrega 09, testes de aceitação
