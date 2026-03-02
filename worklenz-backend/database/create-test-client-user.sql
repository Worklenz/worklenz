-- Create test client user for forgot password testing
-- Password will be: Test123!
-- Bcrypt hash for "Test123!"

INSERT INTO client_users (
    email, 
    password_hash, 
    user_id,
    created_at, 
    updated_at
) VALUES (
    'testclient@example.com',
    '$2b$10$K7L/NAqVmZ5H.N1G8hqB8OGNzg.hHb0zvkQzSqJ9pF5KqxT.MaBRm', -- Test123!
    NULL, -- standalone client user, not linked to Worklenz user
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING
RETURNING id, email, user_id, password_hash IS NOT NULL as has_password;
