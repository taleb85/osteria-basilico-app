-- Rimuove profili il cui nome è esattamente "Alex" (qualsiasi maiuscolo/minuscolo).
-- Non coinvolge "Alexis", "Alessandro", ecc.: solo lower(trim(first_name)) = 'alex'.
-- Turni, timbrature e ferie collegati vengono eliminati in CASCADE (schema base).

DELETE FROM public.users
WHERE lower(trim(first_name)) = 'alex';
