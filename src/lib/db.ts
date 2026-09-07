import mysql, { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { ExecuteValues } from "mysql2";

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
      // DATE trả chuỗi yyyy-MM-dd — tránh Date→toISOString trừ 1 ngày (UTC+7)
      dateStrings: ["DATE"],
    });
  }
  return pool;
}
export async function queryRows<T extends RowDataPacket[]>(
  sql: string,
  params?: readonly unknown[]
): Promise<T> {
  // nội bộ: params luôn là mảng scalar SQL hợp lệ (gọi bởi queryRows/* callers)
  const values = params as ExecuteValues | undefined;
  const [rows] = await getPool().execute<T>(sql, values);
  return rows;
}

export async function queryExecute(
  sql: string,
  params?: readonly unknown[]
): Promise<ResultSetHeader> {
  // nội bộ: params luôn là mảng scalar SQL hợp lệ
  const values = params as ExecuteValues | undefined;
  const [result] = await getPool().execute<ResultSetHeader>(sql, values);
  return result;
}

export async function query(sql: string, params?: readonly unknown[]) {
  try {
    const [results] = await getPool().execute(sql, params as ExecuteValues | undefined);
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
