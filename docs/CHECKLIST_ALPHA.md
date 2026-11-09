# Checklist de aceite da Alpha

Preencher `Resultado` com `Aprovado`, `Reprovado` ou `Não executado` e registrar a evidência ou defeito correspondente.

| ID | Verificação | Prioridade | Resultado | Evidência ou defeito |
| --- | --- | --- | --- | --- |
| TA01 | Cadastrar cliente com os campos obrigatórios e encontrá-lo no sistema | Alta | Não executado | |
| TA02 | Bloquear o cadastro quando um campo obrigatório estiver vazio | Média | Não executado | |
| TA03 | Importar os 50 clientes válidos | Alta | Não executado | |
| TA04 | Rejeitar arquivo com estrutura inválida sem gravar dados | Alta | Não executado | |
| TA05 | Mostrar uso, atendimentos e NPS vinculados ao cliente | Alta | Não executado | |
| TA06 | Gerar score entre 0 e 1 para clientes elegíveis | Alta | Não executado | |
| TA07 | Manter cliente sem dados como sem score e fora do ranking | Média | Não executado | |
| TA08 | Classificar os scores em baixo, médio ou alto | Alta | Não executado | |
| TA09 | Ordenar o painel do maior para o menor risco | Alta | Não executado | |
| TA10 | Filtrar somente clientes de risco alto | Média | Não executado | |
| TA11 | Mostrar os dados e fatores que explicam o risco | Alta | Não executado | |
| TA12 | Mostrar ao menos uma sugestão coerente para risco médio ou alto | Alta | Não executado | |
| TA13 | Recalcular após novos dados e atualizar data e hora | Alta | Não executado | |
| TA14 | Usuário percorre painel, detalhe e sugestão sem ajuda | Alta | Não executado | |

## Verificações técnicas

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Aprovado em 27/10/2026 |
| `npm run lint` | Aprovado em 27/10/2026 |
| Scripts versionados comparados com o banco atual | Não executado |
| Edge Function implantada e autenticada | Não executado |
| Fluxo completo executado no ambiente Alpha | Não executado |

## Testes adicionais do plano

O plano de testes do Notion inclui TA15 a TA22, fora do critério de aceite da Alpha. As divergências que afetam esses casos estão em [DOCUMENTACAO.md](DOCUMENTACAO.md).

| ID | Verificação | Prioridade | Resultado | Observação |
| --- | --- | --- | --- | --- |
| TA15 | Rejeitar importação com API simulada indisponível | Alta | Não aplicável | API simulada fora da Alpha |
| TA16 | Tratar falha do serviço de predição | Alta | Não executado | O código usa cálculo por regras, não o último score |
| TA17 | Inativar e reativar cliente | Média | Não executado | |
| TA18 | Cancelar cliente e impedir reativação | Média | Não executado | |
| TA19 | Mudar o nível de médio para alto após novos dados | Alta | Não executado | |
| TA20 | Executar ação sugerida | Média | Não executado | A tela registra a ação como `PLANEJADA` |
| TA21 | Descartar ação com motivo | Baixa | Não executado | |
| TA22 | Importação parcial com linhas válidas e inválidas | Média | Não executado | |
