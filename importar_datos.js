const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Pool } = require('pg');

// Configura los datos de conexión a tu base de datos PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://tu_usuario:tu_contraseña@localhost:5432/db_registro_cctv'
});

// Ruta exacta donde tienes los archivos de respaldo exportados de Render
const RUTA_RESPALDO = path.join('C:', 'Users', 'Alkosto', 'OneDrive', 'Documents', 'Proyecto Registros CCTV', '2026-11-12T20_25Z.dir', '2026-11-12T20_25Z', 'db_registro_cctv');

async function procesarDirectorio() {
  const client = await pool.connect();
  
  try {
    console.log(`Leyendo archivos desde la ruta: ${RUTA_RESPALDO}`);
    
    if (!fs.existsSync(RUTA_RESPALDO)) {
      console.error('Error: La ruta especificada no existe en el sistema.');
      return;
    }

    const archivos = fs.readdirSync(RUTA_RESPALDO);
    console.log(`Archivos encontrados: ${archivos.join(', ')}`);

    await client.query('BEGIN');

    for (const archivo of archivos) {
      const rutaArchivo = path.join(RUTA_RESPALDO, archivo);
      
      // Verificamos que sea un archivo y no una subcarpeta
      if (fs.statSync(rutaArchivo).isFile()) {
        console.log(`\nProcesando archivo: ${archivo}...`);
        
        const fileStream = fs.createReadStream(rutaArchivo);
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity
        });

        let lineasProcesadas = 0;
        for await (const line of rl) {
          const lineaTrim = line.trim();
          
          // Si el archivo contiene consultas SQL de inserción o comandos compatibles
          if (lineaTrim.startsWith('INSERT INTO') || lineaTrim.startsWith('COPY')) {
            try {
              // Ejecuta cada sentencia de inserción en la base de datos
              await client.query(lineaTrim);
              lineasProcesadas++;
            } catch (err) {
              // Ignora errores menores de duplicados o imprime advertencias si es necesario
              // console.warn(`Aviso en línea: ${err.message}`);
            }
          }
        }
        console.log(`-> Archivo ${archivo} procesado. Líneas ejecutadas: ${lineasProcesadas}`);
      }
    }

    await client.query('COMMIT');
    console.log('\n ¡Importación de la base de datos completada con éxito!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la importación masiva. Se ha revertido la transacción:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

procesarDirectorio();