-- =====================================================================
-- Sistema de IA para Retencao e Customer Success (CS)
-- Entrega 03 - Stored procedures de processo
--
-- Executar APOS schema_retencao_cs.sql (depende das tabelas e do
-- catalogo de fator).
--
-- Criterio adotado: trigger para invariante (ja no schema), procedure
-- para processo com varios passos e transacao propria.
-- =====================================================================

BEGIN;

-- =====================================================================
-- sp_importar_lote (RF02, UC02)
--
-- Grava clientes de um lote em uma unica transacao. Linha invalida
-- vai para importacao_erro e o lote continua (UC02/A2: importacao
-- parcial). Formato de p_linhas: array de jsonb, um objeto por linha,
-- ja no formato de saida do parser de CSV/API da aplicacao:
--   { "razao_social": "...", "cnpj": "...", "segmento": "...",
--     "plano": "...", "valor_mensal": 0, "data_inicio_contrato": "..." }
-- =====================================================================

CREATE OR REPLACE PROCEDURE sp_importar_lote(
    p_origem     origem_importacao,
    p_usuario_id uuid,
    p_arquivo    varchar,
    p_linhas     jsonb,
    INOUT p_importacao_id bigint DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_linha        jsonb;
    v_numero_linha integer := 0;
    v_total        integer;
    v_gravados     integer := 0;
    v_rejeitados   integer := 0;
    v_cliente_id   bigint;
BEGIN
    IF jsonb_typeof(p_linhas) <> 'array' THEN
        RAISE EXCEPTION 'p_linhas deve ser um array jsonb (UC02/E1: formato invalido)';
    END IF;

    v_total := jsonb_array_length(p_linhas);

    INSERT INTO importacao (origem, nome_arquivo, usuario_id, status, total_linhas)
    VALUES (p_origem, p_arquivo, p_usuario_id, 'PROCESSANDO', v_total)
    RETURNING id INTO p_importacao_id;

    FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas)
    LOOP
        v_numero_linha := v_numero_linha + 1;

        BEGIN
            -- UC02/A1: cliente existente (mesmo CNPJ) e atualizado, nao duplicado.
            INSERT INTO cliente (
                razao_social, cnpj, segmento, plano,
                valor_mensal, data_inicio_contrato, usuario_id
            )
            VALUES (
                v_linha->>'razao_social',
                v_linha->>'cnpj',
                v_linha->>'segmento',
                v_linha->>'plano',
                NULLIF(v_linha->>'valor_mensal', '')::numeric,
                (v_linha->>'data_inicio_contrato')::date,
                p_usuario_id
            )
            ON CONFLICT (cnpj) DO UPDATE SET
                razao_social = EXCLUDED.razao_social,
                segmento     = EXCLUDED.segmento,
                plano        = EXCLUDED.plano,
                valor_mensal = EXCLUDED.valor_mensal,
                status       = 'ATIVO'
            RETURNING id INTO v_cliente_id;

            v_gravados := v_gravados + 1;

        EXCEPTION WHEN OTHERS THEN
            -- Uma linha ruim nao derruba o lote inteiro (UC02/A2).
            INSERT INTO importacao_erro (importacao_id, numero_linha, mensagem, conteudo_bruto)
            VALUES (p_importacao_id, v_numero_linha, SQLERRM, v_linha);

            v_rejeitados := v_rejeitados + 1;
        END;
    END LOOP;

    UPDATE importacao
       SET status           = CASE WHEN v_rejeitados = 0 THEN 'CONCLUIDA' ELSE 'PARCIAL' END,
           total_gravados   = v_gravados,
           total_rejeitados = v_rejeitados,
           finalizada_em    = now()
     WHERE id = p_importacao_id;
END;
$$;

COMMENT ON PROCEDURE sp_importar_lote
    IS 'UC02. Processo completo: valida, grava e produz o resumo de importacao/inconsistencias.';

-- =====================================================================
-- sp_calcular_risco_cliente (RF06, UC06, UC12)
--
-- Processo puro: monta os atributos do cliente, chama o modelo
-- (aqui simulado - a chamada real ao servico de predicao acontece na
-- aplicacao, que grava o score via esta mesma procedure) e persiste
-- analise + fatores em uma unica transacao.
--
-- p_score e p_fatores vem prontos da aplicacao (saida do
-- ServicoPredicao). Esta procedure garante que analise e fatores sao
-- gravados atomicamente - se um fator falhar, a analise nao fica
-- orfa de explicacao.
-- =====================================================================

CREATE OR REPLACE PROCEDURE sp_calcular_risco_cliente(
    p_cliente_id bigint,
    p_score      numeric,      -- NULL quando dados insuficientes (UC06/A1)
    p_fatores    jsonb,        -- [{ "fator_codigo": "...", "valor_observado": 0, "contribuicao": 0 }, ...]
    p_origem     origem_analise DEFAULT 'MANUAL'
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_modelo_id  integer;
    v_analise_id bigint;
    v_fator      jsonb;
BEGIN
    SELECT id INTO v_modelo_id FROM modelo_ia WHERE ativo LIMIT 1;

    IF v_modelo_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum modelo de IA ativo (UC06/E1: mantem ultimo score valido)';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM cliente WHERE id = p_cliente_id) THEN
        RAISE EXCEPTION 'Cliente % nao encontrado', p_cliente_id;
    END IF;

    -- A trigger trg_analise_01_vigencia desmarca a analise anterior;
    -- a trg_analise_02_classificar preenche nivel_risco a partir do score.
    INSERT INTO analise_risco (cliente_id, modelo_id, score, origem)
    VALUES (p_cliente_id, v_modelo_id, p_score, p_origem)
    RETURNING id INTO v_analise_id;

    IF p_score IS NOT NULL AND p_fatores IS NOT NULL THEN
        FOR v_fator IN SELECT * FROM jsonb_array_elements(p_fatores)
        LOOP
            INSERT INTO fator_risco (analise_id, fator_codigo, valor_observado, contribuicao)
            VALUES (
                v_analise_id,
                v_fator->>'fator_codigo',
                NULLIF(v_fator->>'valor_observado', '')::numeric,
                (v_fator->>'contribuicao')::numeric
            );
        END LOOP;
    END IF;
END;
$$;

COMMENT ON PROCEDURE sp_calcular_risco_cliente
    IS 'UC06/UC12. Grava analise e fatores atomicamente; nivel e vigencia ficam a cargo das triggers.';

-- =====================================================================
-- sp_atualizar_analises (UC12)
--
-- Varre clientes ativos e recalcula quem tem dado novo desde a ultima
-- analise vigente. Delega o calculo em si a sp_calcular_risco_cliente
-- - esta procedure so decide QUEM precisa ser recalculado.
-- A chamada ao modelo de IA (p_score/p_fatores) continua vindo da
-- aplicacao por cliente; aqui devolvemos a lista de elegiveis.
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_clientes_para_atualizar()
RETURNS TABLE (cliente_id bigint)
LANGUAGE sql
AS $$
    -- Cliente ativo cujo dado de uso, atendimento ou NPS mais recente
    -- e posterior a sua ultima analise vigente (UC12/A1: sem dado novo).
    SELECT c.id
      FROM cliente c
      LEFT JOIN analise_risco ar
             ON ar.cliente_id = c.id AND ar.vigente
     WHERE c.status = 'ATIVO'
       AND (
            ar.id IS NULL
         OR EXISTS (SELECT 1 FROM dado_uso d
                     WHERE d.cliente_id = c.id AND d.registrado_em > ar.executada_em)
         OR EXISTS (SELECT 1 FROM atendimento a
                     WHERE a.cliente_id = c.id AND a.registrado_em > ar.executada_em)
         OR EXISTS (SELECT 1 FROM avaliacao_nps n
                     WHERE n.cliente_id = c.id AND n.registrado_em > ar.executada_em)
       );
$$;

COMMENT ON FUNCTION fn_clientes_para_atualizar
    IS 'UC12, passo 2: identifica clientes com dados alterados desde a ultima analise.';

COMMIT;
