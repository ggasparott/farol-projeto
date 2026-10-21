-- =====================================================================
-- Funcoes RPC com direitos do dono (ignoram RLS das tabelas), liberadas
-- so para usuario logado. Executar apos 06. Idempotente.
--
-- Motivo: importar lote e gravar analise sao processos do sistema, nao
-- do usuario; a policy por linha nao se aplica a eles. SECURITY DEFINER
-- exige travar o EXECUTE: sem o REVOKE, o anon chamaria direto.
-- auth.uid() continua devolvendo o usuario da requisicao.
-- =====================================================================

-- Localiza por nome (qualquer assinatura): funciona mesmo que a versao
-- no banco difira dos arquivos 03-05. Funcoes ausentes sao ignoradas.
DO $$
DECLARE
    f record;
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS assinatura
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname IN ('fn_importar_lote', 'fn_importar_dados', 'fn_calcular_risco_cliente',
                             'fn_calcular_score_provisorio', 'fn_recalcular_analises',
                             'fn_clientes_para_atualizar')
    LOOP
        EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER SET search_path = public, auth', f.assinatura);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.assinatura);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.assinatura);
        RAISE NOTICE 'ajustada: %', f.assinatura;
    END LOOP;
END;
$$;

-- Conferir quais existem no banco:
-- SELECT proname, pg_get_function_arguments(oid) FROM pg_proc
--  WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'fn\_%';
