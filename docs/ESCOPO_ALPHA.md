# Escopo da versão Alpha

## Objetivo

Entregar e demonstrar o fluxo essencial do Farol com dados sintéticos: importar dados de clientes, calcular e classificar o risco de churn, priorizar clientes, explicar o risco e registrar uma ação de retenção.

## Casos de uso incluídos

| Caso | Entrega na Alpha |
| --- | --- |
| UC01 | Cadastrar manualmente um cliente com validação dos campos obrigatórios |
| UC02 | Importar clientes, uso, atendimentos e NPS por CSV |
| UC03 a UC05 | Registrar os dados importados e vinculá-los ao cliente |
| UC06 e UC07 | Calcular o score e classificar o nível de risco |
| UC08 e UC11 | Exibir e priorizar clientes no painel, com filtro por risco |
| UC09 | Exibir cadastro, histórico e fatores que explicam o risco |
| UC10 | Sugerir e registrar ações de retenção |
| UC12 | Atualizar manualmente as análises quando houver dados novos |

Clientes sem análise ou sem dados suficientes permanecem visíveis como `SEM_SCORE`, fora do ranking de risco. No detalhe do cliente, é possível importar arquivos de uso, atendimentos e NPS vinculados pelo CNPJ.

## Fora do escopo da Alpha

- API simulada como origem de importação;
- integração real com CRM ou ERP;
- automação da execução das ações sugeridas;
- compartilhamento de clientes e dados entre contas de uma mesma empresa ou equipe (cada conta autenticada acessa apenas os próprios dados);
- treinamento de um modelo próprio de machine learning;

## Critério de aceite

A Alpha está pronta quando os testes TA01 a TA15 aplicáveis forem executados, todos os testes de prioridade alta forem aprovados e nenhum defeito crítico estiver aberto.

## Roteiro curto de demonstração

1. Entrar com uma conta de analista.
2. Cadastrar manualmente um cliente, conferir a tela de detalhes e importar dados de uso, atendimentos ou NPS para ele.
3. Selecionar os quatro CSVs de `db/seeds` e enviá-los com um clique; cada arquivo é processado separadamente.
4. Conferir o resumo e as inconsistências da importação.
5. Abrir o painel, conferir a ordenação e o filtro por risco, e verificar que clientes sem score aparecem separados do ranking.
6. Abrir um cliente de risco médio ou alto e conferir os fatores.
7. Registrar uma ação de retenção e um comentário.
8. Acionar `Atualizar análises` e conferir o resumo do processamento.
