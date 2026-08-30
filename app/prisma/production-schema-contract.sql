-- migration履歴が分岐した既存DBでも、案件作成に必要な実schemaと認可を保証する。
DO $$
DECLARE
  expected_column record;
BEGIN
  FOR expected_column IN
    SELECT *
    FROM (VALUES
      ('activity_style_tags', 'jsonb', 'pg_catalog', 'jsonb'),
      ('required_qualifications', 'jsonb', 'pg_catalog', 'jsonb'),
      ('min_age', 'integer', 'pg_catalog', 'int4'),
      ('max_age', 'integer', 'pg_catalog', 'int4'),
      ('category', 'character varying', 'pg_catalog', 'varchar'),
      ('participation_mode', 'USER-DEFINED', 'public', 'participation_mode'),
      ('status', 'USER-DEFINED', 'public', 'opportunity_status')
    ) AS expected(column_name, data_type, udt_schema, udt_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns actual
      WHERE actual.table_schema = 'public'
        AND actual.table_name = 'm_opportunity'
        AND actual.column_name = expected_column.column_name
        AND actual.data_type = expected_column.data_type
        AND actual.udt_schema = expected_column.udt_schema
        AND actual.udt_name = expected_column.udt_name
    ) THEN
      RAISE EXCEPTION 'm_opportunity column contract mismatch: %',
        expected_column.column_name;
    END IF;
  END LOOP;

  IF NOT has_table_privilege('authenticated', 'public.m_opportunity', 'SELECT')
    OR NOT has_table_privilege('authenticated', 'public.m_opportunity', 'INSERT')
    OR NOT has_table_privilege('authenticated', 'public.m_opportunity', 'UPDATE')
    OR NOT has_table_privilege('anon', 'public.m_opportunity', 'SELECT')
    OR has_table_privilege('anon', 'public.m_opportunity', 'INSERT')
    OR has_table_privilege('anon', 'public.m_opportunity', 'UPDATE')
  THEN
    RAISE EXCEPTION 'm_opportunity privilege contract mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'm_opportunity'
      AND policyname = '団体は自分の案件を作成可能'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'm_opportunity'
      AND policyname = '団体は自分の案件を更新可能'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'm_opportunity'
      AND policyname = '公開済み案件は全員閲覧可能'
  ) THEN
    RAISE EXCEPTION 'm_opportunity RLS policy contract mismatch';
  END IF;
END;
$$;
