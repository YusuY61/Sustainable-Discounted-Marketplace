import mysql from 'mysql2/promise';

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

db.on('connection', (connection) => {
    connection.query("SET time_zone = '+03:00'");
});

export default db;