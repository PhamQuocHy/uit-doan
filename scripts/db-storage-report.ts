/** Read-only storage report: metadata SELECT / SHOW only; never modifies tables. */
import { loadEnv } from './load-env';
import { getPool } from '../src/lib/db';
loadEnv();
async function main(){const p=getPool();try{
 for(const sql of [
 "SELECT VERSION() version",
 "SELECT TABLE_NAME,ENGINE,TABLE_ROWS,ROUND(DATA_LENGTH/1048576,2) data_mb,ROUND(INDEX_LENGTH/1048576,2) index_mb,ROUND(DATA_FREE/1048576,2) free_mb FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY DATA_LENGTH+INDEX_LENGTH DESC",
 "SELECT ROUND(SUM(DATA_LENGTH)/1048576,2) data_mb,ROUND(SUM(INDEX_LENGTH)/1048576,2) index_mb,ROUND(SUM(DATA_FREE)/1048576,2) reported_free_mb FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()",
 "SHOW VARIABLES WHERE Variable_name IN ('innodb_file_per_table','log_bin','expire_logs_days','binlog_expire_logs_seconds','innodb_data_file_path')",
 ]){const [rows]=await p.query(sql);console.log(JSON.stringify({sql,rows}));}
}finally{await p.end();}}
main().catch(()=>{console.error('Read-only audit unavailable');process.exitCode=1;});
