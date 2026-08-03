import mysql, { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "quan_ly_nvqs",
      port: parseInt(process.env.DB_PORT || "3306", 10),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

export async function queryRows<T extends RowDataPacket[]>(
  sql: string,
  params?: unknown[]
): Promise<T> {
  const [rows] = await getPool().execute<T>(sql, params);
  return rows;
}

export async function queryExecute(
  sql: string,
  params?: unknown[]
): Promise<ResultSetHeader> {
  const [result] = await getPool().execute<ResultSetHeader>(sql, params);
  return result;
}

export async function query(sql: string, params?: unknown[]) {
  try {
    const [results] = await getPool().execute(sql, params);
    return results;
  } catch (error) {
    console.error("Database Error:", error);
    throw error;
  }
}

export async function pingDb(): Promise<boolean> {
  try {
    await getPool().query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
