CREATE DATABASE pantryTracker;

-- Products table
CREATE TABLE products(
    id BIGSERIAL NOT NULL PRIMARY KEY,
    userId BIGSERIAL NOT NULL REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    qty INT NOT NULL check(
        qty >= 0
    )
);

-- Users table 
CREATE TABLE users (
  "id" BIGSERIAL PRIMARY KEY,
  "email" VARCHAR(100) UNIQUE,
  "username" VARCHAR(100) UNIQUE,
  "password" VARCHAR(500)
);

-- Sessions table
CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
	"sess" json NOT NULL,
	"expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX "IDX_session_expire" ON "session" ("expire");

-- Sample insert
-- INSERT INTO products(name, category, qty) VALUES('Chicken', 'Meat', '2');