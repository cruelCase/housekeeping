const mysql = require('mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({ host:'localhost', user:'root', password:'', database:'newdts' });
    const [rows] = await conn.execute('SELECT COUNT(*) AS total, SUM(archived=0) AS active, SUM(archived=1) AS archived FROM dts_documents');
    console.log(JSON.stringify(rows));
    await conn.end();
  } catch (e) {
    console.error('DB error', e.message);
    process.exit(1);
  }
})();
