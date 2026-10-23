-- =====================================================================
-- Sistema de IA para Retencao e Customer Success (CS)
-- Entrega 03 - Script de criacao do banco de dados
-- SGBD: PostgreSQL 14+ (compativel com Supabase)
--
-- Escopo deste arquivo: tipos, tabelas, constraints, indices, triggers
-- e catalogos iniciais. As stored procedures de processo
-- (sp_importar_lote, sp_calcular_risco_cliente) vem em arquivo separado.
--
-- Execucao: psql -d retencao_cs -f schema_retencao_cs.sql
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- 1. TIPOS ENUMERADOS (dominios fechados por definicao de negocio)
-- =====================================================================

-- A ordem de declaracao de nivel_risco e significativa: define a
-- ordenacao do tipo, usada em ORDER BY (UC08) e na comparacao
-- nivel_risco >= nivel_minimo (UC10).
CREATE TYPE nivel_risco        AS ENUM ('SEM_SCORE', 'BAIXO', 'MEDIO', 'ALTO');

CREATE TYPE papel_usuario      AS ENUM ('ANALISTA', 'GESTOR', 'ADMIN');
CREATE TYPE status_cliente     AS ENUM ('ATIVO', 'SUSPENSO', 'CANCELADO', 'INATIVO');
CREATE TYPE criticidade_ticket AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');
CREATE TYPE status_atendimento AS ENUM ('ABERTO', 'EM_ANDAMENTO', 'RESOLVIDO', 'CANCELADO');
CREATE TYPE origem_importacao  AS ENUM ('ARQUIVO_CSV', 'API_SIMULADA');
CREATE TYPE status_importacao  AS ENUM ('PROCESSANDO', 'CONCLUIDA', 'PARCIAL', 'CANCELADA');
CREATE TYPE origem_analise     AS ENUM ('IMPORTACAO', 'MANUAL', 'AGENDADA', 'RECALCULO');
CREATE TYPE status_acao        AS ENUM ('SUGERIDA', 'PLANEJADA', 'EXECUTADA', 'DESCARTADA');

-- =====================================================================
-- 2. USUARIO
-- No Supabase a autenticacao vive em auth.users; esta tabela guarda o
-- perfil de aplicacao. Para amarrar as duas, descomente a FK ao final.
-- =====================================================================

CREATE TABLE usuario (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          varchar(120)  NOT NULL,
    email         varchar(160)  NOT NULL,
    papel         papel_usuario NOT NULL DEFAULT 'ANALISTA',
    ativo         boolean       NOT NULL DEFAULT true,
    criado_em     timestamptz   NOT NULL DEFAULT now(),
    atualizado_em timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT uq_usuario_email UNIQUE (email),
    CONSTRAINT ck_usuario_nome  CHECK (length(btrim(nome)) >= 3)
);

COMMENT ON TABLE  usuario    IS 'Analista/gestor de CS. RF01, atores do UC01-UC12.';
COMMENT ON COLUMN usuario.id IS 'No Supabase, deve corresponder a auth.users.id.';

-- ALTER TABLE usuario
--     ADD CONSTRAINT fk_usuario_auth
--     FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- =====================================================================
-- 3. CLIENTE
-- Exclusao logica: clientes nunca sao removidos fisicamente. O status
-- CANCELADO e o rotulo positivo de churn usado no treino do modelo;
-- INATIVO marca cadastro invalido, que deve ficar fora do treino.
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_cnpj_valido(p_cnpj text)
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

CREATE TABLE cliente (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    razao_social         varchar(150)   NOT NULL,
    cnpj                 char(14),
    segmento             varchar(80)    NOT NULL,
    plano                varchar(60)    NOT NULL,
    valor_mensal         numeric(12,2),
    data_inicio_contrato date           NOT NULL,
    data_cancelamento    date,
    status               status_cliente NOT NULL DEFAULT 'ATIVO',
    usuario_id           uuid,
    criado_em            timestamptz    NOT NULL DEFAULT now(),
    atualizado_em        timestamptz    NOT NULL DEFAULT now(),

    CONSTRAINT fk_cliente_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE SET NULL,
    CONSTRAINT uq_cliente_cnpj UNIQUE (cnpj),
    CONSTRAINT ck_cliente_cnpj CHECK (cnpj IS NULL OR fn_cnpj_valido(cnpj)),
    CONSTRAINT ck_cliente_razao_social CHECK (length(btrim(razao_social)) >= 2),
    CONSTRAINT ck_cliente_valor CHECK (valor_mensal IS NULL OR valor_mensal >= 0),
    CONSTRAINT ck_cliente_cancelamento
        CHECK (data_cancelamento IS NULL OR data_cancelamento >= data_inicio_contrato),
    CONSTRAINT ck_cliente_status_cancelado
        CHECK (status <> 'CANCELADO' OR data_cancelamento IS NOT NULL)
);

CREATE INDEX ix_cliente_status   ON cliente (status);
CREATE INDEX ix_cliente_segmento ON cliente (segmento);

COMMENT ON TABLE  cliente        IS 'Empresa SaaS B2B cliente. RF01, UC01.';
COMMENT ON COLUMN cliente.cnpj   IS 'CNPJ com digitos verificadores validos; mascara e responsabilidade da interface.';
COMMENT ON COLUMN cliente.status IS 'RN: recontratacao reativa o cadastro existente, nao cria outro.';

-- =====================================================================
-- 4. IMPORTACAO E ERROS (RF02, UC02)
-- importacao_erro e entidade fraca: nao existe fora do lote.
-- =====================================================================

CREATE TABLE importacao (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    origem           origem_importacao NOT NULL,
    nome_arquivo     varchar(255),
    usuario_id       uuid,
    status           status_importacao NOT NULL DEFAULT 'PROCESSANDO',
    total_linhas     integer NOT NULL DEFAULT 0,
    total_gravados   integer NOT NULL DEFAULT 0,
    total_rejeitados integer NOT NULL DEFAULT 0,
    iniciada_em      timestamptz NOT NULL DEFAULT now(),
    finalizada_em    timestamptz,

    CONSTRAINT fk_importacao_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE SET NULL,
    CONSTRAINT ck_importacao_totais
        CHECK (total_linhas >= 0 AND total_gravados >= 0 AND total_rejeitados >= 0
               AND total_gravados + total_rejeitados <= total_linhas),
    CONSTRAINT ck_importacao_fim
        CHECK (finalizada_em IS NULL OR finalizada_em >= iniciada_em)
);

CREATE INDEX ix_importacao_status ON importacao (status, iniciada_em DESC);

CREATE TABLE importacao_erro (
    importacao_id  bigint  NOT NULL,
    numero_linha   integer NOT NULL,
    campo          varchar(60),
    mensagem       text    NOT NULL,
    conteudo_bruto jsonb,
    registrado_em  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_importacao_erro PRIMARY KEY (importacao_id, numero_linha),
    CONSTRAINT fk_importacao_erro_lote
        FOREIGN KEY (importacao_id) REFERENCES importacao (id) ON DELETE CASCADE,
    CONSTRAINT ck_importacao_erro_linha CHECK (numero_linha > 0)
);

COMMENT ON TABLE importacao_erro IS 'UC02/A2 e E1: linhas rejeitadas do lote parcial.';

-- =====================================================================
-- 5. DADOS BRUTOS DO CLIENTE (RF03, RF04, RF05)
-- Cascata a partir de cliente: sao partes do cliente.
-- SET NULL a partir de importacao: proveniencia sobrevive ao lote.
-- =====================================================================

CREATE TABLE dado_uso (
    cliente_id          bigint  NOT NULL,
    competencia         date    NOT NULL,
    qtd_acessos         integer NOT NULL DEFAULT 0,
    minutos_uso         integer NOT NULL DEFAULT 0,
    qtd_usuarios_ativos integer NOT NULL DEFAULT 0,
    importacao_id       bigint,
    registrado_em       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_dado_uso PRIMARY KEY (cliente_id, competencia),
    CONSTRAINT fk_dado_uso_cliente
        FOREIGN KEY (cliente_id) REFERENCES cliente (id) ON DELETE CASCADE,
    CONSTRAINT fk_dado_uso_importacao
        FOREIGN KEY (importacao_id) REFERENCES importacao (id) ON DELETE SET NULL,
    -- Sem esta constraint, duas linhas do mesmo mes passam despercebidas
    -- e o calculo de variacao de uso fica silenciosamente errado.
    CONSTRAINT ck_dado_uso_competencia CHECK (EXTRACT(DAY FROM competencia) = 1),
    CONSTRAINT ck_dado_uso_valores
        CHECK (qtd_acessos >= 0 AND minutos_uso >= 0 AND qtd_usuarios_ativos >= 0)
);

COMMENT ON COLUMN dado_uso.competencia IS 'Mes de referencia, sempre o dia 1.';

CREATE TABLE atendimento (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id           bigint             NOT NULL,
    protocolo            varchar(40)        NOT NULL,
    assunto              varchar(200),
    criticidade          criticidade_ticket NOT NULL DEFAULT 'MEDIA',
    status               status_atendimento NOT NULL DEFAULT 'ABERTO',
    aberto_em            timestamptz        NOT NULL,
    primeira_resposta_em timestamptz,
    fechado_em           timestamptz,
    tempo_resposta_horas numeric(8,2) GENERATED ALWAYS AS (
        CASE WHEN primeira_resposta_em IS NOT NULL
             THEN (EXTRACT(EPOCH FROM (primeira_resposta_em - aberto_em)) / 3600.0)::numeric(8,2)
        END
    ) STORED,
    importacao_id        bigint,
    registrado_em        timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_atendimento_cliente
        FOREIGN KEY (cliente_id) REFERENCES cliente (id) ON DELETE CASCADE,
    CONSTRAINT fk_atendimento_importacao
        FOREIGN KEY (importacao_id) REFERENCES importacao (id) ON DELETE SET NULL,
    CONSTRAINT uq_atendimento_protocolo UNIQUE (cliente_id, protocolo),
    CONSTRAINT ck_atendimento_resposta
        CHECK (primeira_resposta_em IS NULL OR primeira_resposta_em >= aberto_em),
    CONSTRAINT ck_atendimento_fechamento
        CHECK (fechado_em IS NULL OR fechado_em >= aberto_em)
);

CREATE INDEX ix_atendimento_cliente ON atendimento (cliente_id, aberto_em DESC);
CREATE INDEX ix_atendimento_critico ON atendimento (cliente_id)
    WHERE criticidade IN ('ALTA', 'CRITICA');

COMMENT ON COLUMN atendimento.tempo_resposta_horas
    IS 'Coluna gerada: desnormalizacao controlada, impossivel gravar valor inconsistente.';

CREATE TABLE avaliacao_nps (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id    bigint   NOT NULL,
    nota          smallint NOT NULL,
    categoria     varchar(10) GENERATED ALWAYS AS (
        CASE WHEN nota >= 9 THEN 'PROMOTOR'
             WHEN nota >= 7 THEN 'NEUTRO'
             ELSE 'DETRATOR'
        END
    ) STORED,
    comentario    text,
    data_coleta   date NOT NULL,
    importacao_id bigint,
    registrado_em timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_nps_cliente
        FOREIGN KEY (cliente_id) REFERENCES cliente (id) ON DELETE CASCADE,
    CONSTRAINT fk_nps_importacao
        FOREIGN KEY (importacao_id) REFERENCES importacao (id) ON DELETE SET NULL,
    CONSTRAINT uq_nps_cliente_data UNIQUE (cliente_id, data_coleta),
    CONSTRAINT ck_nps_nota CHECK (nota BETWEEN 0 AND 10)
);

CREATE INDEX ix_nps_cliente ON avaliacao_nps (cliente_id, data_coleta DESC);

COMMENT ON COLUMN avaliacao_nps.categoria
    IS 'Coluna gerada pela regra fixa da metodologia NPS.';

-- =====================================================================
-- 6. MODELO DE IA (RNF04)
-- Os limiares vivem no modelo: trocar de versao troca a classificacao
-- sem alterar codigo.
-- =====================================================================

CREATE TABLE modelo_ia (
    id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    versao       varchar(20) NOT NULL,
    algoritmo    varchar(80) NOT NULL,
    descricao    text,
    limiar_medio numeric(4,3) NOT NULL DEFAULT 0.400,
    limiar_alto  numeric(4,3) NOT NULL DEFAULT 0.700,
    acuracia     numeric(5,4),
    treinado_em  date,
    ativo        boolean NOT NULL DEFAULT false,
    criado_em    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_modelo_versao UNIQUE (versao),
    CONSTRAINT ck_modelo_limiares
        CHECK (limiar_medio > 0 AND limiar_alto <= 1 AND limiar_alto > limiar_medio),
    CONSTRAINT ck_modelo_acuracia CHECK (acuracia IS NULL OR acuracia BETWEEN 0 AND 1)
);

-- Garante no maximo um modelo ativo por vez.
CREATE UNIQUE INDEX uq_modelo_ativo ON modelo_ia (ativo) WHERE ativo;

-- =====================================================================
-- 7. ANALISE DE RISCO E FATORES (RF06, RF07, RF09, RF12)
-- RESTRICT a partir de cliente: um DELETE acidental deve falhar, nao
-- apagar em silencio o historico que treina o modelo.
-- =====================================================================

CREATE TABLE analise_risco (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id   bigint        NOT NULL,
    modelo_id    integer       NOT NULL,
    score        numeric(5,4),
    nivel_risco  nivel_risco   NOT NULL DEFAULT 'SEM_SCORE',
    origem       origem_analise NOT NULL DEFAULT 'MANUAL',
    vigente      boolean       NOT NULL DEFAULT true,
    executada_em timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT fk_analise_cliente
        FOREIGN KEY (cliente_id) REFERENCES cliente (id) ON DELETE RESTRICT,
    CONSTRAINT fk_analise_modelo
        FOREIGN KEY (modelo_id) REFERENCES modelo_ia (id) ON DELETE RESTRICT,
    CONSTRAINT ck_analise_score CHECK (score IS NULL OR score BETWEEN 0 AND 1),
    -- UC06/A1: cliente sem dados suficientes fica sem score e fora do ranking.
    CONSTRAINT ck_analise_score_nivel
        CHECK ((score IS NULL     AND nivel_risco  = 'SEM_SCORE')
            OR (score IS NOT NULL AND nivel_risco <> 'SEM_SCORE'))
);

-- Invariante: no maximo uma analise vigente por cliente.
-- Esta e a camada de baixo, independente de codigo de aplicacao.
CREATE UNIQUE INDEX uq_analise_vigente ON analise_risco (cliente_id) WHERE vigente;

CREATE INDEX ix_analise_historico ON analise_risco (cliente_id, executada_em DESC);
CREATE INDEX ix_analise_painel    ON analise_risco (nivel_risco DESC, score DESC)
    WHERE vigente;

CREATE TABLE fator (
    codigo      varchar(40) PRIMARY KEY,
    nome        varchar(120) NOT NULL,
    descricao   text         NOT NULL,
    peso_padrao numeric(4,3) NOT NULL,

    CONSTRAINT ck_fator_peso CHECK (peso_padrao > 0 AND peso_padrao <= 1)
);

COMMENT ON TABLE fator
    IS 'Catalogo extraido na normalizacao para 2FN: a descricao depende so do fator, nao da analise.';

CREATE TABLE fator_risco (
    analise_id      bigint      NOT NULL,
    fator_codigo    varchar(40) NOT NULL,
    valor_observado numeric(12,2),
    contribuicao    numeric(5,4) NOT NULL,

    CONSTRAINT pk_fator_risco PRIMARY KEY (analise_id, fator_codigo),
    CONSTRAINT fk_fator_risco_analise
        FOREIGN KEY (analise_id) REFERENCES analise_risco (id) ON DELETE CASCADE,
    CONSTRAINT fk_fator_risco_fator
        FOREIGN KEY (fator_codigo) REFERENCES fator (codigo) ON DELETE RESTRICT,
    CONSTRAINT ck_fator_risco_contribuicao CHECK (contribuicao BETWEEN 0 AND 1)
);

COMMENT ON TABLE fator_risco
    IS 'RN: nunca sofre UPDATE apos gravado; alterar quebra a rastreabilidade do UC09/TA11.';

-- =====================================================================
-- 8. ACOES DE RETENCAO (RF10, RF11)
-- acao_aplicada resolve o N:N cliente x acao e ainda amarra a analise
-- que motivou a sugestao (UC10, TA12).
-- =====================================================================

CREATE TABLE acao_retencao (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo          varchar(30)  NOT NULL,
    nome            varchar(120) NOT NULL,
    descricao       text         NOT NULL,
    fator_codigo    varchar(40)  NOT NULL,
    nivel_minimo    nivel_risco  NOT NULL DEFAULT 'MEDIO',
    peso_prioridade smallint     NOT NULL DEFAULT 3,
    ativo           boolean      NOT NULL DEFAULT true,

    CONSTRAINT uq_acao_codigo UNIQUE (codigo),
    CONSTRAINT fk_acao_fator
        FOREIGN KEY (fator_codigo) REFERENCES fator (codigo) ON DELETE RESTRICT,
    CONSTRAINT ck_acao_prioridade CHECK (peso_prioridade BETWEEN 1 AND 5),
    CONSTRAINT ck_acao_nivel_minimo CHECK (nivel_minimo <> 'SEM_SCORE')
);

CREATE TABLE acao_aplicada (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id   bigint      NOT NULL,
    acao_id      integer     NOT NULL,
    analise_id   bigint,
    usuario_id   uuid,
    status       status_acao NOT NULL DEFAULT 'SUGERIDA',
    prioridade   smallint    NOT NULL DEFAULT 3,
    observacao   text,
    sugerida_em  timestamptz NOT NULL DEFAULT now(),
    executada_em timestamptz,

    CONSTRAINT fk_acao_aplicada_cliente
        FOREIGN KEY (cliente_id) REFERENCES cliente (id) ON DELETE RESTRICT,
    CONSTRAINT fk_acao_aplicada_acao
        FOREIGN KEY (acao_id) REFERENCES acao_retencao (id) ON DELETE RESTRICT,
    CONSTRAINT fk_acao_aplicada_analise
        FOREIGN KEY (analise_id) REFERENCES analise_risco (id) ON DELETE RESTRICT,
    CONSTRAINT fk_acao_aplicada_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE SET NULL,
    CONSTRAINT ck_acao_aplicada_prioridade CHECK (prioridade BETWEEN 1 AND 5),
    CONSTRAINT ck_acao_aplicada_execucao
        CHECK (status <> 'EXECUTADA' OR executada_em IS NOT NULL)
);

CREATE INDEX ix_acao_aplicada_cliente   ON acao_aplicada (cliente_id, sugerida_em DESC);
CREATE INDEX ix_acao_aplicada_pendentes ON acao_aplicada (status)
    WHERE status IN ('SUGERIDA', 'PLANEJADA');

-- =====================================================================
-- 9. TRIGGERS
-- Criterio: trigger para invariante, procedure para processo.
-- =====================================================================

-- 9.1 Carimbo de atualizacao ------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_atualizado_em()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.atualizado_em := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuario_atualizado
    BEFORE UPDATE ON usuario
    FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

CREATE TRIGGER trg_cliente_atualizado
    BEFORE UPDATE ON cliente
    FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

-- 9.2 Data de cancelamento --------------------------------------------
CREATE OR REPLACE FUNCTION fn_cliente_cancelamento()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'CANCELADO' AND NEW.data_cancelamento IS NULL THEN
        NEW.data_cancelamento := CURRENT_DATE;
    ELSIF NEW.status <> 'CANCELADO' THEN
        NEW.data_cancelamento := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cliente_cancelamento
    BEFORE INSERT OR UPDATE OF status ON cliente
    FOR EACH ROW EXECUTE FUNCTION fn_cliente_cancelamento();

-- 9.3 Vigencia da analise ---------------------------------------------
-- Desmarca a anterior ANTES de inserir a nova. Se falhar, o indice
-- unico parcial barra o estado invalido.
CREATE OR REPLACE FUNCTION fn_analise_vigencia()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE analise_risco
       SET vigente = false
     WHERE cliente_id = NEW.cliente_id
       AND vigente;

    NEW.vigente := true;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_analise_01_vigencia
    BEFORE INSERT ON analise_risco
    FOR EACH ROW EXECUTE FUNCTION fn_analise_vigencia();

-- 9.4 Classificacao do nivel (RF07, UC07, TA08) ------------------------
-- Invariante: nunca existe score sem nivel coerente, venha o INSERT
-- da aplicacao, de uma importacao ou do console do banco.
CREATE OR REPLACE FUNCTION fn_classificar_nivel_risco()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_limiar_medio numeric(4,3);
    v_limiar_alto  numeric(4,3);
BEGIN
    IF NEW.score IS NULL THEN
        NEW.nivel_risco := 'SEM_SCORE';
        RETURN NEW;
    END IF;

    SELECT limiar_medio, limiar_alto
      INTO v_limiar_medio, v_limiar_alto
      FROM modelo_ia
     WHERE id = NEW.modelo_id;

    IF v_limiar_medio IS NULL THEN
        RAISE EXCEPTION 'Modelo de IA % inexistente', NEW.modelo_id;
    END IF;

    NEW.nivel_risco := (CASE
        WHEN NEW.score >= v_limiar_alto  THEN 'ALTO'
        WHEN NEW.score >= v_limiar_medio THEN 'MEDIO'
        ELSE 'BAIXO'
    END)::nivel_risco;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_analise_02_classificar
    BEFORE INSERT OR UPDATE OF score ON analise_risco
    FOR EACH ROW EXECUTE FUNCTION fn_classificar_nivel_risco();

-- =====================================================================
-- 10. CATALOGOS INICIAIS
-- =====================================================================

INSERT INTO fator (codigo, nome, descricao, peso_padrao) VALUES
    ('QUEDA_USO',        'Queda de uso',
     'Reducao de acessos do mes fechado em relacao ao mes anterior.', 0.350),
    ('TICKETS_CRITICOS', 'Tickets criticos',
     'Volume de atendimentos de criticidade alta ou critica no periodo.', 0.250),
    ('NPS_BAIXO',        'NPS baixo',
     'Ultima avaliacao de satisfacao registrada na faixa de detrator.', 0.300),
    ('CONTRATO_RECENTE', 'Contrato recente',
     'Cliente com pouco tempo de casa, ainda em fase de adocao.', 0.100);

INSERT INTO acao_retencao (codigo, nome, descricao, fator_codigo, nivel_minimo, peso_prioridade) VALUES
    ('ONBOARDING_EXTRA',  'Sessao extra de onboarding',
     'Agendar treinamento para reativar o uso das funcionalidades principais.',
     'QUEDA_USO', 'MEDIO', 4),
    ('CHECKIN_USO',       'Check-in de uso',
     'Contato para entender a queda de acessos e mapear bloqueios.',
     'QUEDA_USO', 'MEDIO', 3),
    ('ESCALAR_SUPORTE',   'Escalar suporte tecnico',
     'Priorizar os chamados abertos e designar responsavel tecnico.',
     'TICKETS_CRITICOS', 'MEDIO', 5),
    ('REVISAO_SLA',       'Revisao de SLA',
     'Revisar tempos de resposta acordados com o cliente.',
     'TICKETS_CRITICOS', 'ALTO', 3),
    ('CONTATO_EXECUTIVO', 'Contato executivo',
     'Reuniao do gestor de CS com o decisor para tratar insatisfacao.',
     'NPS_BAIXO', 'ALTO', 5),
    ('PESQUISA_DETALHE',  'Pesquisa de detalhamento',
     'Coletar feedback qualitativo sobre os motivos da nota baixa.',
     'NPS_BAIXO', 'MEDIO', 2),
    ('ACOMPANHA_ADOCAO',  'Acompanhamento de adocao',
     'Ciclo de acompanhamento nos primeiros meses de contrato.',
     'CONTRATO_RECENTE', 'MEDIO', 3);

INSERT INTO modelo_ia (versao, algoritmo, descricao, limiar_medio, limiar_alto, treinado_em, ativo) VALUES
    ('1.0.0', 'Regressao logistica',
     'Versao inicial prevista no TAP para a Versao Alfa.',
     0.400, 0.700, CURRENT_DATE, true);

COMMIT;
