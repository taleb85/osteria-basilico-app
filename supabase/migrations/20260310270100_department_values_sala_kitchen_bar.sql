-- Use fixed department values for i18n: sala, kitchen, bar
COMMENT ON COLUMN users.department IS 'Reparto: valori fissi sala, kitchen, bar (etichette tradotte in app)';

-- Migrate existing Italian values to fixed keys
UPDATE users SET department = 'kitchen' WHERE department = 'Cucina';
UPDATE users SET department = 'sala'    WHERE department = 'Sala';
UPDATE users SET department = 'bar'     WHERE department = 'Bar';
