-- Isolamento de dados entre contas autenticadas.
-- Execute depois dos scripts 01-07 em um banco existente.
-- Clientes sem usuario_id ficam inacessiveis ate que um administrador
-- atribua cada registro ao proprietario correto.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_cnpj_valido(p_cnpj text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
DECLARE
    v_cnpj       text := upper(regexp_replace(p_cnpj, '[^0-9A-Za-z]', '', 'g'));
    v_pesos_1    integer[] := ARRAY[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    v_pesos_2    integer[] := ARRAY[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    v_soma       integer;
    v_resto      integer;
    v_digito     integer;
    v_i          integer;
BEGIN
    IF length(v_cnpj) <> 14
       OR v_cnpj !~ '^[A-Z0-9]{12}[0-9]{2}$' THEN
        RETURN false;
    END IF;
    IF length(replace(v_cnpj, substr(v_cnpj, 1, 1), '')) = 0 THEN
        RETURN false;
    END IF;

    v_soma := 0;
    FOR v_i IN 1..12 LOOP
        v_soma := v_soma
            + (ascii(substr(v_cnpj, v_i, 1)) - 48) * v_pesos_1[v_i];
    END LOOP;
    v_resto := v_soma % 11;
    v_digito := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;
    IF substr(v_cnpj, 13, 1)::integer <> v_digito THEN
        RETURN false;
    END IF;

    v_soma := 0;
    FOR v_i IN 1..13 LOOP
        v_soma := v_soma
            + (ascii(substr(v_cnpj, v_i, 1)) - 48) * v_pesos_2[v_i];
    END LOOP;
    v_resto := v_soma % 11;
    v_digito := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;

    RETURN substr(v_cnpj, 14, 1)::integer = v_digito;
END;
$$;

-- Remove policies antigas, inclusive policies permissivas que se somariam
-- por OR e poderiam anular as regras de propriedade abaixo.
DO $$
DECLARE
    v_tabela text;
    v_policy text;
BEGIN
    FOREACH v_tabela IN ARRAY ARRAY[
        'usuario', 'cliente', 'importacao', 'importacao_erro', 'dado_uso',
        'atendimento', 'avaliacao_nps', 'modelo_ia', 'analise_risco', 'fator',
        'fator_risco', 'acao_retencao', 'acao_aplicada'
    ]
    LOOP
        FOR v_policy IN
            SELECT policyname
              FROM pg_policies
             WHERE schemaname = 'public'
               AND tablename = v_tabela
        LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', v_policy, v_tabela);
        END LOOP;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tabela);
    END LOOP;
END;
$$;

CREATE POLICY farol_usuario_proprio ON public.usuario
    FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()));

CREATE POLICY farol_cliente_proprio ON public.cliente
    FOR ALL TO authenticated
    USING (usuario_id = (SELECT auth.uid()))
    WITH CHECK (usuario_id = (SELECT auth.uid()));

CREATE POLICY farol_importacao_propria ON public.importacao
    FOR ALL TO authenticated
    USING (usuario_id = (SELECT auth.uid()))
    WITH CHECK (usuario_id = (SELECT auth.uid()));

CREATE POLICY farol_importacao_erro_proprio ON public.importacao_erro
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1
          FROM public.importacao i
         WHERE i.id = importacao_erro.importacao_id
           AND i.usuario_id = (SELECT auth.uid())
    ))
    WITH CHECK (EXISTS (
        SELECT 1
          FROM public.importacao i
         WHERE i.id = importacao_erro.importacao_id
           AND i.usuario_id = (SELECT auth.uid())
    ));

CREATE POLICY farol_dado_uso_proprio ON public.dado_uso
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.cliente c
         WHERE c.id = dado_uso.cliente_id
           AND c.usuario_id = (SELECT auth.uid())
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.cliente c
         WHERE c.id = dado_uso.cliente_id
           AND c.usuario_id = (SELECT auth.uid())
    ));

CREATE POLICY farol_atendimento_proprio ON public.atendimento
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.cliente c
         WHERE c.id = atendimento.cliente_id
           AND c.usuario_id = (SELECT auth.uid())
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.cliente c
         WHERE c.id = atendimento.cliente_id
           AND c.usuario_id = (SELECT auth.uid())
    ));

CREATE POLICY farol_nps_proprio ON public.avaliacao_nps
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.cliente c
         WHERE c.id = avaliacao_nps.cliente_id
           AND c.usuario_id = (SELECT auth.uid())
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.cliente c
         WHERE c.id = avaliacao_nps.cliente_id
           AND c.usuario_id = (SELECT auth.uid())
    ));

CREATE POLICY farol_analise_risco_propria ON public.analise_risco
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.cliente c
         WHERE c.id = analise_risco.cliente_id
           AND c.usuario_id = (SELECT auth.uid())
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.cliente c
         WHERE c.id = analise_risco.cliente_id
           AND c.usuario_id = (SELECT auth.uid())
    ));

CREATE POLICY farol_fator_risco_proprio ON public.fator_risco
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1
          FROM public.analise_risco ar
          JOIN public.cliente c ON c.id = ar.cliente_id
         WHERE ar.id = fator_risco.analise_id
           AND c.usuario_id = (SELECT auth.uid())
    ))
    WITH CHECK (EXISTS (
        SELECT 1
          FROM public.analise_risco ar
          JOIN public.cliente c ON c.id = ar.cliente_id
         WHERE ar.id = fator_risco.analise_id
           AND c.usuario_id = (SELECT auth.uid())
    ));

CREATE POLICY farol_acao_aplicada_propria ON public.acao_aplicada
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.cliente c
         WHERE c.id = acao_aplicada.cliente_id
           AND c.usuario_id = (SELECT auth.uid())
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.cliente c
         WHERE c.id = acao_aplicada.cliente_id
           AND c.usuario_id = (SELECT auth.uid())
    ));

-- Catalogos comuns: leitura para usuarios autenticados, sem escrita.
CREATE POLICY farol_modelo_ia_leitura ON public.modelo_ia
    FOR SELECT TO authenticated USING (true);
CREATE POLICY farol_fator_leitura ON public.fator
    FOR SELECT TO authenticated USING (true);
CREATE POLICY farol_acao_retencao_leitura ON public.acao_retencao
    FOR SELECT TO authenticated USING (true);

-- A unicidade do CNPJ tambem deve ser por conta, nao global.
ALTER TABLE public.cliente
    DROP CONSTRAINT IF EXISTS uq_cliente_cnpj;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_usuario_cnpj
    ON public.cliente (usuario_id, cnpj)
    WHERE usuario_id IS NOT NULL AND cnpj IS NOT NULL;

-- As importacoes sao SECURITY DEFINER; valide o dono tambem dentro delas.
CREATE OR REPLACE PROCEDURE public.sp_importar_lote(
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
    IF auth.uid() IS NULL OR p_usuario_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Usuario da importacao invalido';
    END IF;
    IF jsonb_typeof(p_linhas) <> 'array' THEN
        RAISE EXCEPTION 'p_linhas deve ser um array jsonb';
    END IF;

    v_total := jsonb_array_length(p_linhas);

    INSERT INTO public.importacao (origem, nome_arquivo, usuario_id, status, total_linhas)
    VALUES (p_origem, p_arquivo, p_usuario_id, 'PROCESSANDO', v_total)
    RETURNING id INTO p_importacao_id;

    FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas)
    LOOP
        v_numero_linha := v_numero_linha + 1;
        v_cliente_id := NULL;

        BEGIN
            IF NOT COALESCE(public.fn_cnpj_valido(v_linha->>'cnpj'), false) THEN
                RAISE EXCEPTION 'CNPJ invalido';
            END IF;

            INSERT INTO public.cliente AS atual (
                razao_social, cnpj, segmento, plano,
                valor_mensal, data_inicio_contrato, usuario_id
            )
            VALUES (
                v_linha->>'razao_social',
                upper(regexp_replace(v_linha->>'cnpj', '[^0-9A-Za-z]', '', 'g')),
                v_linha->>'segmento',
                v_linha->>'plano',
                NULLIF(v_linha->>'valor_mensal', '')::numeric,
                (v_linha->>'data_inicio_contrato')::date,
                p_usuario_id
            )
            ON CONFLICT (usuario_id, cnpj)
            WHERE usuario_id IS NOT NULL AND cnpj IS NOT NULL
            DO UPDATE SET
                razao_social = EXCLUDED.razao_social,
                segmento     = EXCLUDED.segmento,
                plano        = EXCLUDED.plano,
                valor_mensal = EXCLUDED.valor_mensal,
                status       = 'ATIVO'
            WHERE atual.usuario_id = EXCLUDED.usuario_id
            RETURNING id INTO v_cliente_id;

            IF v_cliente_id IS NULL THEN
                RAISE EXCEPTION 'CNPJ pertence a outro usuario';
            END IF;

            v_gravados := v_gravados + 1;
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.importacao_erro (importacao_id, numero_linha, mensagem, conteudo_bruto)
            VALUES (p_importacao_id, v_numero_linha, SQLERRM, v_linha);
            v_rejeitados := v_rejeitados + 1;
        END;
    END LOOP;

    UPDATE public.importacao
       SET status = (CASE WHEN v_rejeitados = 0 THEN 'CONCLUIDA' ELSE 'PARCIAL' END)::status_importacao,
           total_gravados = v_gravados,
           total_rejeitados = v_rejeitados,
           finalizada_em = now()
     WHERE id = p_importacao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_importar_lote(
    p_origem  origem_importacao,
    p_arquivo varchar,
    p_linhas  jsonb
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_id bigint;
BEGIN
    CALL public.sp_importar_lote(p_origem, auth.uid(), p_arquivo, p_linhas, v_id);
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_importar_dados(
    p_tipo    text,
    p_arquivo varchar,
    p_linhas  jsonb
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_id         bigint;
    v_linha      jsonb;
    v_n          integer := 0;
    v_gravados   integer := 0;
    v_rejeitados integer := 0;
    v_cliente    bigint;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;
    IF p_tipo NOT IN ('USO', 'ATENDIMENTO', 'NPS') THEN
        RAISE EXCEPTION 'Tipo de importacao invalido: %', p_tipo;
    END IF;
    IF jsonb_typeof(p_linhas) <> 'array' THEN
        RAISE EXCEPTION 'p_linhas deve ser um array jsonb';
    END IF;

    INSERT INTO public.importacao (origem, nome_arquivo, usuario_id, status, total_linhas)
    VALUES ('ARQUIVO_CSV', p_arquivo, auth.uid(), 'PROCESSANDO', jsonb_array_length(p_linhas))
    RETURNING id INTO v_id;

    FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas)
    LOOP
        v_n := v_n + 1;
        BEGIN
            IF NOT COALESCE(public.fn_cnpj_valido(v_linha->>'cnpj'), false) THEN
                RAISE EXCEPTION 'CNPJ invalido';
            END IF;

            SELECT c.id INTO v_cliente
              FROM public.cliente c
             WHERE c.cnpj = upper(regexp_replace(v_linha->>'cnpj', '[^0-9A-Za-z]', '', 'g'))
               AND c.usuario_id = auth.uid();
            IF v_cliente IS NULL THEN
                RAISE EXCEPTION 'Cliente nao encontrado nesta conta (importe os clientes primeiro)';
            END IF;

            IF p_tipo = 'USO' THEN
                INSERT INTO public.dado_uso (cliente_id, competencia, qtd_acessos, minutos_uso, qtd_usuarios_ativos, importacao_id)
                VALUES (v_cliente,
                        date_trunc('month', (v_linha->>'competencia')::date)::date,
                        (v_linha->>'qtd_acessos')::integer,
                        (v_linha->>'minutos_uso')::integer,
                        (v_linha->>'qtd_usuarios_ativos')::integer,
                        v_id)
                ON CONFLICT (cliente_id, competencia) DO UPDATE SET
                    qtd_acessos = EXCLUDED.qtd_acessos, minutos_uso = EXCLUDED.minutos_uso,
                    qtd_usuarios_ativos = EXCLUDED.qtd_usuarios_ativos,
                    importacao_id = v_id, registrado_em = now();
            ELSIF p_tipo = 'ATENDIMENTO' THEN
                INSERT INTO public.atendimento (cliente_id, protocolo, assunto, criticidade, status,
                                                aberto_em, primeira_resposta_em, fechado_em, importacao_id)
                VALUES (v_cliente,
                        v_linha->>'protocolo',
                        NULLIF(v_linha->>'assunto', ''),
                        COALESCE(NULLIF(upper(v_linha->>'criticidade'), ''), 'MEDIA')::criticidade_ticket,
                        COALESCE(NULLIF(upper(v_linha->>'status'), ''), 'ABERTO')::status_atendimento,
                        (v_linha->>'aberto_em')::timestamptz,
                        NULLIF(v_linha->>'primeira_resposta_em', '')::timestamptz,
                        NULLIF(v_linha->>'fechado_em', '')::timestamptz,
                        v_id)
                ON CONFLICT (cliente_id, protocolo) DO UPDATE SET
                    assunto = EXCLUDED.assunto, criticidade = EXCLUDED.criticidade,
                    status = EXCLUDED.status, primeira_resposta_em = EXCLUDED.primeira_resposta_em,
                    fechado_em = EXCLUDED.fechado_em,
                    importacao_id = v_id, registrado_em = now();
            ELSE
                INSERT INTO public.avaliacao_nps (cliente_id, nota, comentario, data_coleta, importacao_id)
                VALUES (v_cliente,
                        (v_linha->>'nota')::smallint,
                        NULLIF(v_linha->>'comentario', ''),
                        (v_linha->>'data_coleta')::date,
                        v_id)
                ON CONFLICT (cliente_id, data_coleta) DO UPDATE SET
                    nota = EXCLUDED.nota, comentario = EXCLUDED.comentario,
                    importacao_id = v_id, registrado_em = now();
            END IF;

            v_gravados := v_gravados + 1;
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.importacao_erro (importacao_id, numero_linha, mensagem, conteudo_bruto)
            VALUES (v_id, v_n, SQLERRM, v_linha);
            v_rejeitados := v_rejeitados + 1;
        END;
    END LOOP;

    UPDATE public.importacao
       SET status = (CASE WHEN v_rejeitados = 0 THEN 'CONCLUIDA' ELSE 'PARCIAL' END)::status_importacao,
           total_gravados = v_gravados,
           total_rejeitados = v_rejeitados,
           finalizada_em = now()
     WHERE id = v_id;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_importar_conjunto(p_importacoes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_tipo    text;
    v_arquivo varchar;
    v_linhas  jsonb;
    v_id      bigint;
    v_ids     jsonb := '{}'::jsonb;
    v_tipos   text[] := ARRAY['CLIENTE', 'USO', 'ATENDIMENTO', 'NPS'];
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;
    IF p_importacoes IS NULL
       OR jsonb_typeof(p_importacoes) <> 'object'
       OR p_importacoes = '{}'::jsonb THEN
        RAISE EXCEPTION 'p_importacoes deve ser um objeto JSON com arquivos';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM jsonb_object_keys(p_importacoes) AS item(tipo)
         WHERE NOT item.tipo = ANY(v_tipos)
    ) THEN
        RAISE EXCEPTION 'Tipo de importacao invalido no conjunto';
    END IF;

    FOREACH v_tipo IN ARRAY v_tipos LOOP
        IF p_importacoes ? v_tipo THEN
            IF jsonb_typeof(p_importacoes->v_tipo) <> 'object' THEN
                RAISE EXCEPTION 'A importacao % deve ser um objeto', v_tipo;
            END IF;

            v_arquivo := p_importacoes->v_tipo->>'arquivo';
            v_linhas := p_importacoes->v_tipo->'linhas';
            IF v_arquivo IS NULL OR btrim(v_arquivo) = ''
               OR v_linhas IS NULL
               OR jsonb_typeof(v_linhas) <> 'array'
               OR jsonb_array_length(v_linhas) = 0 THEN
                RAISE EXCEPTION 'Arquivo ou linhas invalidos para a importacao %', v_tipo;
            END IF;
        END IF;
    END LOOP;

    FOREACH v_tipo IN ARRAY v_tipos LOOP
        IF p_importacoes ? v_tipo THEN
            v_arquivo := p_importacoes->v_tipo->>'arquivo';
            v_linhas := p_importacoes->v_tipo->'linhas';
            IF v_tipo = 'CLIENTE' THEN
                CALL public.sp_importar_lote(
                    'ARQUIVO_CSV'::public.origem_importacao,
                    auth.uid(),
                    v_arquivo,
                    v_linhas,
                    v_id
                );
            ELSE
                v_id := public.fn_importar_dados(v_tipo, v_arquivo, v_linhas);
            END IF;
            v_ids := v_ids || jsonb_build_object(v_tipo, v_id);
        END IF;
    END LOOP;

    RETURN v_ids;
END;
$$;

-- A Edge Function usa o JWT validado do usuario para buscar somente
-- clientes da propria conta; a service role fica reservada aos calculos.
CREATE OR REPLACE FUNCTION public.fn_clientes_para_atualizar()
RETURNS TABLE (cliente_id bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT c.id
      FROM public.cliente c
      LEFT JOIN public.analise_risco ar
             ON ar.cliente_id = c.id AND ar.vigente
     WHERE c.status = 'ATIVO'
       AND c.usuario_id = auth.uid()
       AND (
            ar.id IS NULL
         OR EXISTS (SELECT 1 FROM public.dado_uso d
                     WHERE d.cliente_id = c.id AND d.registrado_em > ar.executada_em)
         OR EXISTS (SELECT 1 FROM public.atendimento a
                     WHERE a.cliente_id = c.id AND a.registrado_em > ar.executada_em)
         OR EXISTS (SELECT 1 FROM public.avaliacao_nps n
                     WHERE n.cliente_id = c.id AND n.registrado_em > ar.executada_em)
       );
$$;

ALTER FUNCTION public.fn_importar_lote(origem_importacao, varchar, jsonb)
    SECURITY DEFINER;
ALTER FUNCTION public.fn_importar_lote(origem_importacao, varchar, jsonb)
    SET search_path = public, auth;
ALTER FUNCTION public.fn_importar_conjunto(jsonb)
    SECURITY DEFINER;
ALTER FUNCTION public.fn_importar_conjunto(jsonb)
    SET search_path = public, auth;

REVOKE EXECUTE ON PROCEDURE public.sp_importar_lote(origem_importacao, uuid, varchar, jsonb, bigint)
    FROM PUBLIC, anon, authenticated;
DO $$
DECLARE
    v_funcao regprocedure;
BEGIN
    FOR v_funcao IN
        SELECT p.oid::regprocedure
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = 'fn_importar_lote'
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_funcao);
    END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_importar_lote(origem_importacao, varchar, jsonb)
    TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_importar_dados(text, varchar, jsonb)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_importar_dados(text, varchar, jsonb)
    TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_importar_conjunto(jsonb)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_importar_conjunto(jsonb)
    TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_clientes_para_atualizar()
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_clientes_para_atualizar()
    TO authenticated, service_role;

-- Apenas o backend confiavel pode gravar analises ou recalcular riscos.
REVOKE EXECUTE ON FUNCTION public.fn_calcular_risco_cliente(bigint, numeric, jsonb, origem_analise)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_calcular_risco_cliente(bigint, numeric, jsonb, origem_analise)
    TO service_role;
REVOKE EXECUTE ON FUNCTION public.fn_calcular_score_provisorio(bigint, origem_analise)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_calcular_score_provisorio(bigint, origem_analise)
    TO service_role;
REVOKE EXECUTE ON FUNCTION public.fn_recalcular_analises()
    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON PROCEDURE public.sp_calcular_risco_cliente(bigint, numeric, jsonb, origem_analise)
    FROM PUBLIC, anon, authenticated;

COMMIT;
