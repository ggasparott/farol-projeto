-- =====================================================================
-- Importacao de uso, atendimentos e NPS (UC03-UC05). Executar apos 04.
-- Cada linha referencia o cliente pelo CNPJ. Linha invalida vai para
-- importacao_erro e o lote continua. Reimportar atualiza (idempotente)
-- e renova registrado_em, o que faz o cliente voltar a ser recalculado
-- por fn_clientes_para_atualizar.
-- p_tipo: 'USO' | 'ATENDIMENTO' | 'NPS'
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_importar_dados(
    p_tipo    text,
    p_arquivo varchar,
    p_linhas  jsonb
) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    v_id         bigint;
    v_linha      jsonb;
    v_n          integer := 0;
    v_gravados   integer := 0;
    v_rejeitados integer := 0;
    v_cliente    bigint;
BEGIN
    IF p_tipo NOT IN ('USO', 'ATENDIMENTO', 'NPS') THEN
        RAISE EXCEPTION 'Tipo de importacao invalido: %', p_tipo;
    END IF;
    IF jsonb_typeof(p_linhas) <> 'array' THEN
        RAISE EXCEPTION 'p_linhas deve ser um array jsonb';
    END IF;

    INSERT INTO importacao (origem, nome_arquivo, usuario_id, status, total_linhas)
    VALUES ('ARQUIVO_CSV', p_arquivo, auth.uid(), 'PROCESSANDO', jsonb_array_length(p_linhas))
    RETURNING id INTO v_id;

    FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas)
    LOOP
        v_n := v_n + 1;
        BEGIN
            SELECT id INTO v_cliente FROM cliente WHERE cnpj = v_linha->>'cnpj';
            IF v_cliente IS NULL THEN
                RAISE EXCEPTION 'Cliente com CNPJ % nao encontrado (importe os clientes primeiro)', v_linha->>'cnpj';
            END IF;

            IF p_tipo = 'USO' THEN
                INSERT INTO dado_uso (cliente_id, competencia, qtd_acessos, minutos_uso, qtd_usuarios_ativos, importacao_id)
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
                INSERT INTO atendimento (cliente_id, protocolo, assunto, criticidade, status,
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
                INSERT INTO avaliacao_nps (cliente_id, nota, comentario, data_coleta, importacao_id)
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
            INSERT INTO importacao_erro (importacao_id, numero_linha, mensagem, conteudo_bruto)
            VALUES (v_id, v_n, SQLERRM, v_linha);
            v_rejeitados := v_rejeitados + 1;
        END;
    END LOOP;

    UPDATE importacao
       SET status = (CASE WHEN v_rejeitados = 0 THEN 'CONCLUIDA' ELSE 'PARCIAL' END)::status_importacao,
           total_gravados = v_gravados, total_rejeitados = v_rejeitados, finalizada_em = now()
     WHERE id = v_id;

    RETURN v_id;
END;
$$;
