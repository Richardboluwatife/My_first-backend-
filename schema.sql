CREATE DATABASE notes_app;
USE notes_app;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (title, contents) 
VALUES
('alice', 'hashed_password_1'),
('bob', 'hashed_password_2');