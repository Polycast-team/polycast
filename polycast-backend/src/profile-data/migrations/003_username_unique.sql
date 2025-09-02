-- Create a unique index on username while allowing nulls
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
ON profiles (username)
WHERE username IS NOT NULL;


