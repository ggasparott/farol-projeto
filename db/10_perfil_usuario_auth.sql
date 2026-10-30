-- Mantem um perfil de aplicacao para cada conta criada no Supabase Auth.
-- Execute apos db/09_isolamento_contas.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_criar_perfil_usuario_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_nome  text;
    v_email text;
BEGIN
    v_nome := left(
        coalesce(
            nullif(btrim(NEW.raw_user_meta_data ->> 'nome'), ''),
            nullif(btrim(NEW.raw_user_meta_data ->> 'name'), ''),
            nullif(split_part(coalesce(NEW.email, ''), '@', 1), ''),
            'Analista CS'
        ),
        120
    );
    IF length(btrim(v_nome)) < 3 THEN
        v_nome := 'Analista CS';
    END IF;

    v_email := left(
        coalesce(
            nullif(btrim(NEW.email), ''),
            nullif(btrim(NEW.phone), ''),
            NEW.id::text || '@auth.local'
        ),
        160
    );

    INSERT INTO public.usuario (id, nome, email)
    VALUES (NEW.id, v_nome, v_email)
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_criar_perfil_usuario_auth() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_auth_user_criar_perfil ON auth.users;
CREATE TRIGGER trg_auth_user_criar_perfil
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_criar_perfil_usuario_auth();

-- Repara contas que foram criadas antes da instalacao do trigger.
INSERT INTO public.usuario (id, nome, email)
SELECT
    u.id,
    CASE
        WHEN length(btrim(coalesce(
            nullif(u.raw_user_meta_data ->> 'nome', ''),
            nullif(u.raw_user_meta_data ->> 'name', ''),
            nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
            ''
        ))) >= 3
        THEN left(btrim(coalesce(
            nullif(u.raw_user_meta_data ->> 'nome', ''),
            nullif(u.raw_user_meta_data ->> 'name', ''),
            nullif(split_part(coalesce(u.email, ''), '@', 1), '')
        )), 120)
        ELSE 'Analista CS'
    END,
    left(coalesce(
        nullif(btrim(u.email), ''),
        nullif(btrim(u.phone), ''),
        u.id::text || '@auth.local'
    ), 160)
FROM auth.users AS u
WHERE NOT EXISTS (
    SELECT 1
      FROM public.usuario AS perfil
     WHERE perfil.id = u.id
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
