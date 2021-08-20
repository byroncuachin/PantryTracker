require("dotenv").config();

const { Pool } = require("pg")

const pool = new Pool({
    // user: process.env.USERNAMELOCAL,
    // password: process.env.PASSWORDLOCAL,
    // host: process.env.HOSTLOCAL,
    // port: process.env.PORTLOCAL,
    // database: process.env.DATABASELOCAL,
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
})

module.exports = pool;