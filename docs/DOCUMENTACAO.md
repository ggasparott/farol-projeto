# Documentação do Farol

Índice da documentação do projeto, revisada para a Entrega 10 em 09/11/2026 com base no commit `bf48176`.

## Onde encontrar cada documento

| Assunto | Documento |
| --- | --- |
| Visão geral e como rodar | [README](../README.md) |
| Termo de abertura | [TAP](requisitos/TAP_Projeto_IA_CS.docx) |
| Manual do projeto | [Manual](requisitos/Manualdoprojeto.pdf) |
| Requisitos | [Etapa 1](requisitos/Etapa_1_Requisitos_Projeto_IA_CS.docx) |
| Casos de uso e testes de aceitação | [Casos de uso](requisitos/65391c87Casos_de_Uso__IA_Retencao_CS.pdf) |
| Banco de dados | [Entrega 03](requisitos/Entrega03_Projeto_Banco_Dados.docx) e [scripts SQL](../db/) |
| Modelagem UML | [Classe](requisitos/Diagrama_de_Classe.pdf), [Estado](requisitos/Diagrama_de_Estado_1.pdf) e [Sequência](requisitos/Diagrama_de_Sequencia_1.pdf) |
| Escopo da Alpha | [ESCOPO_ALPHA](ESCOPO_ALPHA.md) |
| Aceite da Alpha | [CHECKLIST_ALPHA](CHECKLIST_ALPHA.md) |
| Publicação e CI/CD | [DEPLOY_FIREBASE](DEPLOY_FIREBASE.md) |

## Diagramas do sistema implementado

Refletem o código, enquanto os PDFs de modelagem registram o projeto original. Abra os arquivos HTML em um navegador. As fontes editáveis estão em [`diagramas/fontes/`](diagramas/fontes/).

| Diagrama | Arquivo |
| --- | --- |
| Arquitetura da Alpha | [`diagramas/arquitetura.html`](diagramas/arquitetura.html) |
| Modelo físico do banco | [`diagramas/banco.html`](diagramas/banco.html) |
| Importação e classificação de risco | [`diagramas/importacao-classificacao.html`](diagramas/importacao-classificacao.html) |

## Divergências entre o projeto original e o código

| Tema | Projeto original | Implementado | Situação |
| --- | --- | --- | --- |
| Modelo de IA | Regressão logística com `ServicoPredicao` | OpenAI mede a intensidade dos fatores; o score é calculado na Edge Function. O catálogo `modelo_ia` ainda registra regressão logística | Atualizar o registro do modelo ou justificar |
| Camadas de serviço | Classes como `ImportadorLote`, `MotorSugestao` e `ServicoPainel` | Não há essas classes: a lógica está em RPCs, hooks e páginas | Diagrama de classes é conceitual |
| Falha da predição | Mantém o último score (TA16) | Calcula o score por regras | Revisar TA16 |
| Status da importação | Inclui `Rejeitada` (TA04, DE03) | O enum tem `PROCESSANDO`, `CONCLUIDA`, `PARCIAL` e `CANCELADA` | Revisar TA04 e DE03 |
| Status da ação | Sugerida → Executada, Descartada ou Obsoleta | Enum tem `SUGERIDA`, `PLANEJADA`, `EXECUTADA` e `DESCARTADA`; a tela registra como `PLANEJADA` | Revisar DE02, TA20 e TA21 |
| Status do cliente | Ativo, Inativo e Cancelado | Enum também tem `SUSPENSO` | Revisar DE01 |
| Origem da análise | Distingue importação e atualização manual | A Edge Function grava sempre `IMPORTACAO` | Corrigir na evolução |
| Importação por API simulada | Prevista em RF02 e TA15 | Fora da Alpha; somente CSV | Adiado |
