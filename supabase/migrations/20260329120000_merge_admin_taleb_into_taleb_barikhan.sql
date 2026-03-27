-- Unifica i profili duplicati "ADMIN" e "TALEB" (non Barikhan) in "Taleb Barikhan" e li rimuove.
--
-- Target (univoco): lower(trim(first_name)) = 'taleb' AND lower(trim(last_name)) = 'barikhan'
-- Sorgenti: id <> target AND (
--   lower(trim(first_name)) = 'admin'
--   OR (lower(trim(first_name)) = 'taleb' AND lower(trim(coalesce(last_name,''))) <> 'barikhan')
-- )
--
-- Idempotente: seconda esecuzione → nessuna sorgente, solo NOTICE.
-- auth.users: rimuovere eventuali account duplicati dalla dashboard Supabase se usi login email.

-- Il trigger `set_shift_templates_updated_at` usa NEW.updated_at; su DB legacy la colonna può mancare.
ALTER TABLE public.shift_templates
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Alcuni DB non hanno ancora `updated_at` su `users` (merge lo aggiorna in chiusura).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $merge$
DECLARE
  target_id uuid;
  n_target int;
  src_ids uuid[];
  merged_modules jsonb;
  merged_features jsonb;
  merged_monthly jsonb;
  merged_ui jsonb;
  u_target public.users%ROWTYPE;
  urow public.users%ROWTYPE;
  any_admin boolean := false;
  new_role text;
BEGIN
  SELECT COUNT(*)::int INTO n_target
  FROM public.users
  WHERE lower(trim(first_name)) = 'taleb'
    AND lower(trim(last_name)) = 'barikhan';

  IF n_target = 0 THEN
    RAISE NOTICE 'merge_users: skip — nessun utente Taleb Barikhan trovato';
    RETURN;
  END IF;

  IF n_target > 1 THEN
    RAISE WARNING 'merge_users: abort — più utenti corrispondono a Taleb Barikhan (%)', n_target;
    RETURN;
  END IF;

  SELECT id INTO target_id
  FROM public.users
  WHERE lower(trim(first_name)) = 'taleb'
    AND lower(trim(last_name)) = 'barikhan'
  LIMIT 1;

  SELECT array_agg(id ORDER BY created_at NULLS LAST, id)
  INTO src_ids
  FROM public.users
  WHERE id <> target_id
    AND (
      lower(trim(first_name)) = 'admin'
      OR (
        lower(trim(first_name)) = 'taleb'
        AND lower(trim(coalesce(last_name, ''))) <> 'barikhan'
      )
    );

  IF src_ids IS NULL OR cardinality(src_ids) = 0 THEN
    RAISE NOTICE 'merge_users: skip — nessuna sorgente ADMIN / TALEB (non Barikhan)';
    RETURN;
  END IF;

  RAISE NOTICE 'merge_users: target_id=% sources=%', target_id, src_ids;

  UPDATE public.shifts SET user_id = target_id WHERE user_id = ANY (src_ids);
  UPDATE public.punch_records SET user_id = target_id WHERE user_id = ANY (src_ids);
  UPDATE public.holiday_requests SET user_id = target_id WHERE user_id = ANY (src_ids);

  UPDATE public.punch_audit_log
  SET actor_id = target_id
  WHERE actor_id IS NOT NULL AND actor_id = ANY (src_ids);

  UPDATE public.shifts s
  SET approved_by = target_id::text
  WHERE s.approved_by IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM unnest(src_ids) AS x(sid)
      WHERE trim(s.approved_by) = x.sid::text
    );

  UPDATE public.shift_templates st
  SET data = COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN elem->>'user_id' IS NOT NULL
            AND (elem->>'user_id') ~ '^[0-9a-fA-F-]{36}$'
            AND (elem->>'user_id')::uuid = ANY (src_ids)
          THEN jsonb_set(elem, '{user_id}', to_jsonb(target_id::text), true)
          ELSE elem
        END
        ORDER BY ord
      )
      FROM jsonb_array_elements(st.data) WITH ORDINALITY AS t(elem, ord)
    ),
    st.data
  )
  WHERE jsonb_typeof(st.data) = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(st.data) AS e
      WHERE (e->>'user_id') IS NOT NULL
        AND (e->>'user_id') ~ '^[0-9a-fA-F-]{36}$'
        AND (e->>'user_id')::uuid = ANY (src_ids)
    );

  SELECT * INTO u_target FROM public.users WHERE id = target_id;

  SELECT COALESCE(bool_or(lower(u.role) = 'admin'), false)
  INTO any_admin
  FROM public.users u
  WHERE u.id = target_id OR u.id = ANY (src_ids);

  IF any_admin THEN
    new_role := 'admin';
  ELSE
    new_role := u_target.role;
  END IF;

  SELECT COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(m))
      FROM (
        SELECT DISTINCT m
        FROM (
          SELECT jsonb_array_elements_text(COALESCE(u.enabled_modules, '[]'::jsonb)) AS m
          FROM public.users u
          WHERE u.id = target_id OR u.id = ANY (src_ids)
        ) q
        WHERE m IS NOT NULL AND length(trim(m)) > 0
      ) d
    ),
    '[]'::jsonb
  ) INTO merged_modules;

  merged_features := '{}'::jsonb;
  merged_monthly := '{}'::jsonb;
  merged_ui := '{}'::jsonb;

  FOR urow IN
    SELECT * FROM public.users WHERE id = ANY (src_ids) ORDER BY id
  LOOP
    merged_features := merged_features || COALESCE(urow.enabled_features, '{}'::jsonb);
    merged_monthly := merged_monthly || COALESCE(urow.monthly_confirmed, '{}'::jsonb);
    merged_ui := merged_ui || COALESCE(urow.ui_section_overrides, '{}'::jsonb);
  END LOOP;

  merged_features := merged_features || COALESCE(u_target.enabled_features, '{}'::jsonb);
  merged_monthly := merged_monthly || COALESCE(u_target.monthly_confirmed, '{}'::jsonb);
  merged_ui := merged_ui || COALESCE(u_target.ui_section_overrides, '{}'::jsonb);

  UPDATE public.users u
  SET
    role = new_role,
    can_create_shifts = COALESCE((
      SELECT bool_or(COALESCE(x.can_create_shifts, false))
      FROM public.users x
      WHERE x.id = target_id OR x.id = ANY (src_ids)
    ), false),
    can_approve_shifts = COALESCE((
      SELECT bool_or(COALESCE(x.can_approve_shifts, false))
      FROM public.users x
      WHERE x.id = target_id OR x.id = ANY (src_ids)
    ), false),
    can_view_total_hours = COALESCE((
      SELECT bool_or(COALESCE(x.can_view_total_hours, false))
      FROM public.users x
      WHERE x.id = target_id OR x.id = ANY (src_ids)
    ), false),
    can_edit_staff_pins = COALESCE((
      SELECT bool_or(COALESCE(x.can_edit_staff_pins, false))
      FROM public.users x
      WHERE x.id = target_id OR x.id = ANY (src_ids)
    ), false),
    can_manage_drafts = COALESCE((
      SELECT bool_or(COALESCE(x.can_manage_drafts, false))
      FROM public.users x
      WHERE x.id = target_id OR x.id = ANY (src_ids)
    ), false),
    can_request_holidays = COALESCE((
      SELECT bool_or(COALESCE(x.can_request_holidays, true))
      FROM public.users x
      WHERE x.id = target_id OR x.id = ANY (src_ids)
    ), true),
    can_punch_from_app = COALESCE((
      SELECT bool_or(COALESCE(x.can_punch_from_app, true))
      FROM public.users x
      WHERE x.id = target_id OR x.id = ANY (src_ids)
    ), true),
    enabled_modules = merged_modules,
    enabled_features = merged_features,
    monthly_confirmed = merged_monthly,
    ui_section_overrides = merged_ui,
    updated_at = now()
  WHERE u.id = target_id;

  DELETE FROM public.users WHERE id = ANY (src_ids);

  RAISE NOTICE 'merge_users: completato — uniti e rimossi % profili sorgente', cardinality(src_ids);
END
$merge$;
