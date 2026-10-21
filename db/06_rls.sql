-- =====================================================================
-- RLS do MVP. Executar apos 05. Idempotente.
--
-- Modelo simples: so usuario autenticado (role authenticated) acessa
-- as tabelas de negocio; anon nao acessa nada. Nao ha isolamento por
-- cliente/equipe nesta fase. Policies permissivas se somam (OR) com as
-- que ja existirem, entao nada que ja funciona deixa de funcionar.
-- A tabela usuario fica de fora: cada usuario le o proprio perfil.
-- =====================================================================

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'cliente', 'importacao', 'importacao_erro', 'dado_uso', 'atendimento',
        'avaliacao_nps', 'modelo_ia', 'analise_risco', 'fator', 'fator_risco',
        'acao_retencao', 'acao_aplicada'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS farol_autenticado_total ON %I', t);
        EXECUTE format(
            'CREATE POLICY farol_autenticado_total ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
            t
        );
    END LOOP;
END;
$$;

-- Perfil proprio (AuthContext le usuario por id).
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farol_usuario_proprio ON usuario;
CREATE POLICY farol_usuario_proprio ON usuario
    FOR SELECT TO authenticated USING (id = auth.uid());
