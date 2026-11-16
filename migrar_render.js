const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://db_registro_cctv_user:ZEdJV8hCEGsUxWmF7yvfnVV6AbZfujWK@dpg-db795he7bikc73a00d80-a.oregon-postgres.render.com/db_registro_cctv',
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000, // Tiempo de espera de 10 segundos para evitar cortes prematuros
  idleTimeoutMillis: 30000
});

const registrosHistoricos = [
  {
    "id": "1791558869514",
    "operator": "Jose Ignacion",
    "store": "Alkosto-10",
    "startTime": "10:16",
    "endTime": "10:31",
    "novelty": "Actitud Sospechosa",
    "solution": "Se realizo Recorrido Para determinar que ingreso con inteciones a la tienda",
    "createdAt": "2026-10-09T15:14:29.826Z"
  }
];

async function ejecutarMigracion() {
  console.log('🔄 Conectando a la base de datos en Render...');
  const client = await pool.connect();
  try {
    console.log('🚀 Conexión establecida. Iniciando inyección de registros...');
    await client.query('BEGIN');

    for (const item of registrosHistoricos) {
      const id = item.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);
      const store = item.store || 'Sucursal General';
      const novelty = item.novelty || 'General';
      const createdAt = item.createdAt || new Date().toISOString();

      const queryText = `
        INSERT INTO casos (id, store, novelty, created_at, data)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) 
        DO UPDATE SET store = EXCLUDED.store, novelty = EXCLUDED.novelty, created_at = EXCLUDED.created_at, data = EXCLUDED.data;
      `;

      const values = [id, store, novelty, createdAt, JSON.stringify(item)];
      
      await client.query(queryText, values);
      console.log(`✅ Insertado / Actualizado caso ID: ${id} [${store}]`);
    }

    await client.query('COMMIT');
    console.log('🎉 ¡Migración e inyección masiva completada con éxito en Render!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la migración, transacción revertida:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

ejecutarMigracion();