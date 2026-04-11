INSERT INTO branding (store_name, primary_color, secondary_color, logo_url)
SELECT 'Jedami', '#E91E8C', '#1E1E2E', NULL
WHERE NOT EXISTS (SELECT 1 FROM branding);
