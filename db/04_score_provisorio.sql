-- =====================================================================
-- Calculo PROVISORIO de risco (regras ponderadas pelo catalogo fator).
-- Substitui o agente de IA ate a fase futura: quando ele existir, basta
-- chamar fn_calcular_risco_cliente com o score dele. Executar apos 03.
--
-- score = soma(peso_padrao * intensidade), intensidade em [0,1].
-- Cliente sem uso, NPS nem atendimento fica SEM_SCORE (UC06/A1).
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_calcular_score_provisorio(
    p_cliente_id bigint,
    p_origem     origem_analise DEFAULT 'RECALCULO'
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_inicio  date;
    v_uso     integer[];
    v_queda   numeric;
    v_tickets integer;
    v_nps     smallint;
    v_meses   numeric;
    v_dados   boolean;
    v_fatores jsonb := '[]'::jsonb;
    v_score   numeric := 0;
    v_peso    numeric;
    v_int     numeric;
BEGIN
    SELECT data_inicio_contrato INTO v_inicio FROM cliente WHERE id = p_cliente_id;

    SELECT array_agg(qtd_acessos ORDER BY competencia DESC) INTO v_uso
      FROM (SELECT * FROM dado_uso WHERE cliente_id = p_cliente_id
             ORDER BY competencia DESC LIMIT 2) u;
    SELECT count(*) INTO v_tickets FROM atendimento
     WHERE cliente_id = p_cliente_id AND criticidade IN ('ALTA','CRITICA')
       AND aberto_em >= now() - interval '90 days';
    SELECT nota INTO v_nps FROM avaliacao_nps
     WHERE cliente_id = p_cliente_id ORDER BY data_coleta DESC LIMIT 1;

    v_dados := v_uso IS NOT NULL OR v_nps IS NOT NULL
            OR EXISTS (SELECT 1 FROM atendimento WHERE cliente_id = p_cliente_id);

    IF NOT v_dados THEN
        CALL sp_calcular_risco_cliente(p_cliente_id, NULL, NULL, p_origem);
        RETURN;
    END IF;

    -- QUEDA_USO
    IF array_length(v_uso, 1) = 2 AND v_uso[2] > 0 THEN
        v_queda := round((v_uso[2] - v_uso[1])::numeric / v_uso[2], 2);
        v_int := greatest(0, least(1, v_queda));
        SELECT peso_padrao INTO v_peso FROM fator WHERE codigo = 'QUEDA_USO';
        IF v_int > 0 THEN
            v_fatores := v_fatores || jsonb_build_object('fator_codigo','QUEDA_USO',
                'valor_observado', v_queda * 100, 'contribuicao', round(v_peso * v_int, 4));
            v_score := v_score + v_peso * v_int;
        END IF;
    END IF;

    -- TICKETS_CRITICOS (5 ou mais em 90 dias = intensidade maxima)
    v_int := least(1, v_tickets / 5.0);
    SELECT peso_padrao INTO v_peso FROM fator WHERE codigo = 'TICKETS_CRITICOS';
    IF v_int > 0 THEN
        v_fatores := v_fatores || jsonb_build_object('fator_codigo','TICKETS_CRITICOS',
            'valor_observado', v_tickets, 'contribuicao', round(v_peso * v_int, 4));
        v_score := v_score + v_peso * v_int;
    END IF;

    -- NPS_BAIXO (so detratores, nota <= 6)
    IF v_nps IS NOT NULL AND v_nps <= 6 THEN
        v_int := (10 - v_nps) / 10.0;
        SELECT peso_padrao INTO v_peso FROM fator WHERE codigo = 'NPS_BAIXO';
        v_fatores := v_fatores || jsonb_build_object('fator_codigo','NPS_BAIXO',
            'valor_observado', v_nps, 'contribuicao', round(v_peso * v_int, 4));
        v_score := v_score + v_peso * v_int;
    END IF;

    -- CONTRATO_RECENTE (menos de 6 meses de casa)
    v_meses := (current_date - v_inicio) / 30.0;
    IF v_meses < 6 THEN
        v_int := greatest(0, (6 - v_meses) / 6);
        SELECT peso_padrao INTO v_peso FROM fator WHERE codigo = 'CONTRATO_RECENTE';
        v_fatores := v_fatores || jsonb_build_object('fator_codigo','CONTRATO_RECENTE',
            'valor_observado', round(v_meses, 1), 'contribuicao', round(v_peso * v_int, 4));
        v_score := v_score + v_peso * v_int;
    END IF;

    CALL sp_calcular_risco_cliente(p_cliente_id, round(least(1, v_score), 4), v_fatores, p_origem);
END;
$$;

-- UC12: recalcula so quem tem dado novo (ou nunca foi analisado).
CREATE OR REPLACE FUNCTION fn_recalcular_analises() RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_id bigint;
    v_n  integer := 0;
BEGIN
    FOR v_id IN SELECT cliente_id FROM fn_clientes_para_atualizar() LOOP
        PERFORM fn_calcular_score_provisorio(v_id);
        v_n := v_n + 1;
    END LOOP;
    RETURN v_n;
END;
$$;
