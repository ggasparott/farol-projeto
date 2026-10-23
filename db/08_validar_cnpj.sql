-- Atualizacao de bancos existentes: adiciona a validacao completa do CNPJ.
-- Execute antes de reaplicar 02, 05 e 07.

BEGIN;

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

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM cliente
         WHERE cnpj IS NOT NULL
           AND NOT fn_cnpj_valido(cnpj)
    ) THEN
        RAISE EXCEPTION 'Corrija os CNPJs existentes invalidos antes de aplicar a nova constraint';
    END IF;
END;
$$;

ALTER TABLE cliente DROP CONSTRAINT IF EXISTS ck_cliente_cnpj;
ALTER TABLE cliente
    ADD CONSTRAINT ck_cliente_cnpj
    CHECK (cnpj IS NULL OR fn_cnpj_valido(cnpj));

COMMENT ON COLUMN cliente.cnpj
    IS 'CNPJ com digitos verificadores validos; mascara e responsabilidade da interface.';

COMMIT;
