-- Reset admin password to admin123
-- Run this in Supabase SQL Editor

UPDATE "User" SET password = '$2b$10$.MOtaP8C.mcOlyodznh2ouPWHA1W4KKGj3qarcgRJtJlyG4DJ//Xi' WHERE username = 'admin';
