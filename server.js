const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la conexión a PostgreSQL (Render provee DATABASE_URL automáticamente)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Inicializar la tabla en la base de datos si no existe
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS casos (
        id VARCHAR(255) PRIMARY KEY,
        store TEXT NOT NULL,
        novelty TEXT NOT NULL,
        created_at TEXT,
        data JSONB
      );
    `);
    console.log("📦 Base de datos PostgreSQL conectada y tabla 'casos' lista.");
  } catch (err) {
    console.error("Error al inicializar la base de datos PostgreSQL:", err);
  }
}

initDB();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde el directorio raíz
app.use(express.static(__dirname));

// --- RUTAS DE API (REST API con PostgreSQL) ---

// 1. Obtener todos los casos
app.get('/api/casos', async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM casos ORDER BY created_at DESC');
    const cases = result.rows.map(row => row.data);
    res.json(cases);
  } catch (err) {
    console.error('Error al obtener casos:', err);
    res.status(500).json({ error: 'Error al consultar la base de datos' });
  }
});

// 2. Registrar o actualizar un caso
app.post('/api/casos', async (req, res) => {
  const newCase = req.body;
  
  if (!newCase || !newCase.store || !newCase.novelty) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    newCase.id = newCase.id || Date.now().toString();
    newCase.createdAt = newCase.createdAt || new Date().toISOString();

    const query = `
      INSERT INTO casos (id, store, novelty, created_at, data)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) 
      DO UPDATE SET store = EXCLUDED.store, novelty = EXCLUDED.novelty, data = EXCLUDED.data;
    `;

    await pool.query(query, [
      newCase.id, 
      newCase.store, 
      newCase.novelty, 
      newCase.createdAt, 
      JSON.stringify(newCase)
    ]);

    res.status(201).json({ status: 'ok', data: newCase });
  } catch (err) {
    console.error('Error al guardar caso:', err);
    res.status(500).json({ error: 'Error al guardar en la base de datos' });
  }
});

// 3. Eliminar un caso por ID
app.delete('/api/casos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM casos WHERE id = $1', [id]);
    res.json({ status: 'ok', message: 'Caso eliminado' });
  } catch (err) {
    console.error('Error al eliminar caso:', err);
    res.status(500).json({ error: 'Error al eliminar de la base de datos' });
  }
});

// 4. Limpiar todos los casos del turno
app.delete('/api/casos', async (req, res) => {
  try {
    await pool.query('DELETE FROM casos');
    res.json({ status: 'ok', message: 'Todos los casos fueron eliminados' });
  } catch (err) {
    console.error('Error al limpiar casos:', err);
    res.status(500).json({ error: 'Error al limpiar la base de datos' });
  }
});

// 5. Endpoint para envío automático de WhatsApp en segundo plano
app.post('/api/enviar-whatsapp', async (req, res) => {
    const { mensaje, numero } = req.body;
    const destino = numero || "584126615457";

    try {
        const INSTANCE_ID = process.env.WA_INSTANCE_ID; 
        const API_TOKEN = process.env.WA_API_TOKEN;

        if (!INSTANCE_ID || !API_TOKEN) {
            console.log("Mensaje procesado en backend:", mensaje);
            return res.json({ success: true, message: "Petición recibida correctamente en el servidor." });
        }

        const response = await fetch(`https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${API_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: `${destino}@c.us`,
                message: mensaje
            })
        });

        const data = await response.json();
        res.json({ success: true, data });
    } catch (error) {
        console.error("Error al enviar WhatsApp automático:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Ruta principal abre el index.html
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Servidor CCTV iniciado con PostgreSQL`);
  console.log(`📍 Acceso Local: http://localhost:${PORT}`);
  console.log(`===================================================`);
});