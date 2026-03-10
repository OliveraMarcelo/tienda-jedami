BEGIN;
-- Creamos un usuario administrador por defecto
INSERT INTO users(email, password_hash)
VALUES 
('admin@jedami.com','$2b$10$Zjjg2LIvda6dlOFp9ZO4YeOHg8ampzT3y7.526gm2pzBZxzZ.wFIm')
ON CONFLICT (email) DO NOTHING;
-- Asignamos el rol de administrador al usuario creado
INSERT INTO user_roles(user_id, role_id)
SELECT u.id , r.id
FROM users u, roles r
WHERE u.email='admin@jedami.com' AND r.name='admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;