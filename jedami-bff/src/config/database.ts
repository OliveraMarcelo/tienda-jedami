//Conexion a postgresql
import { Pool } from 'pg';
import { ENV } from './env.js';

export const pool = new Pool({
    connectionString: ENV.DATABASE_URL,
});

export async function connectDB() {
    try {
        console.log('Bases de datos conectada');
    } catch (error) {
        console.log('Database connection error:', error);
        throw error;
        
    }
}