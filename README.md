# Farol

Sistema de IA para Retenção e Customer Success (CS). O Farol calcula o risco de churn de clientes SaaS B2B, mostra os que mais precisam de atenção e sugere ações de retenção.

Fluxo principal: **dados dos clientes → cálculo do risco → classificação → painel de CS → sugestão de ação de retenção.**

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS (Vite) |
| Banco / Auth / backend | Supabase (PostgreSQL 14+) |
| Agente de IA | API separada, **fora do escopo da primeira fase** (pasta `agent/`) |

O frontend fala direto com o Supabase (`supabase-js`): leituras via tabelas/views, escritas via `rpc()` nas stored procedures. Não há API própria nesta fase. A API só entra quando o agente de IA for implementado.

## Estrutura de pastas

```
farol-projeto/
├── db/                    # Banco de dados (executar em ordem)
│   ├── 01_schema.sql      # Tipos, tabelas, constraints, triggers e catálogos
│   ├── 02_procedures.sql  # sp_importar_lote, sp_calcular_risco_cliente, fn_clientes_para_atualizar
│   └── seeds/             # Dados sintéticos (mín. 50 clientes, 3 níveis de risco)
├── web/                   # Frontend React + TS + Tailwind
│   ├── public/
│   ├── src/
│   │   ├── components/    # Componentes reutilizáveis (tabela, badge de risco, ...)
│   │   ├── pages/         # Importar, Painel, Detalhe do cliente
│   │   ├── hooks/         # Acesso a dados (usePainel, useCliente, ...)
│   │   ├── lib/           # Cliente Supabase e utilitários
│   │   └── types/         # Tipos TS espelhando o schema
│   └── .env.example       # VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
├── agent/                 # API do agente de IA (fase futura)
└── docs/
    ├── requisitos/        # TAP, manual, casos de uso, diagramas e entrega do banco
    └── diagramas/         # Diagramas exportados / fontes
```

## Escopo do MVP

Casos de uso priorizados: **UC02** importar dados, **UC06/UC07** calcular e classificar risco, **UC08** painel de clientes em risco, **UC09** detalhes do cliente, **UC10** sugestões de retenção e **UC12** atualizar análise.

Ficam para depois: UC01 (cadastro manual) e o agente de IA. A priorização (UC11) sai da ordenação do painel.

## Como rodar

### 1. Banco de dados
1. Crie um projeto no Supabase.
2. No SQL Editor, execute `db/01_schema.sql` e depois `db/02_procedures.sql`.

### 2. Frontend
```bash
cd web
cp .env.example .env   # preencha com a URL e a anon key do projeto
npm install
npm run dev
```

> O `web/` já está inicializado (Vite + React + TS + Tailwind v4 + `supabase-js`). O cliente Supabase está em `web/src/lib/supabase.ts`.

## Pendências conhecidas

- `sp_importar_lote` grava apenas `cliente`. Uso, atendimentos e NPS (UC03–UC05) ainda precisam ser importados, o que o teste TA05 exige.
- O cálculo do score ainda não tem origem definida. O agente de IA é fase futura, então o MVP precisa de um cálculo provisório (por exemplo, regras ponderadas pelos fatores do catálogo `fator`), gravado via `sp_calcular_risco_cliente`.
- Definir RLS (Row Level Security) no Supabase antes de expor a anon key.

## Documentação

Tudo em [docs/requisitos/](docs/requisitos/): casos de uso e testes de aceitação TA01–TA14, diagramas de classe, estado e sequência, TAP e manual do projeto.

## Prazos

- 22/10–25/10/2026: preparação do ambiente e dos dados de teste
- 26/10–30/10/2026: execução dos testes de aceitação com o PO
- 04/11/2026: Entrega 09, testes de aceitação
