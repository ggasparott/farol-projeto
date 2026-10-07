-- =====================================================================
-- Wrappers RPC para o frontend (supabase-js).
-- O PostgREST so expoe FUNCTIONS em /rpc, nao PROCEDURES; estas funcoes
-- encapsulam as procedures de 02_procedures.sql. Executar apos 02.
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_importar_lote(
    p_origem  origem_importacao,
    p_arquivo varchar,
    p_linhas  jsonb
) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    v_id bigint;
BEGIN
    CALL sp_importar_lote(p_origem, auth.uid(), p_arquivo, p_linhas, v_id);
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_calcular_risco_cliente(
    p_cliente_id bigint,
    p_score      numeric,
    p_fatores    jsonb,
    p_origem     origem_analise DEFAULT 'MANUAL'
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    CALL sp_calcular_risco_cliente(p_cliente_id, p_score, p_fatores, p_origem);
END;
$$;
