const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'casos.json');

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde el directorio raíz
app.use(express.static(__dirname));

// Funciones auxiliares para la base de datos JSON local
function readCases() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
    return [];
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error al leer el archivo casos.json:', err);
    return [];
  }
}

function writeCases(cases) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(cases, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error al guardar en casos.json:', err);
  }
}

// --- RUTAS DE API (REST API) ---

// 1. Obtener todos los casos
app.get('/api/casos', (req, res) => {
  const cases = readCases();
  res.json(cases);
});

// 2. Registrar o actualizar un caso
app.post('/api/casos', (req, res) => {
  const newCase = req.body;
  
  if (!newCase || !newCase.store || !newCase.novelty) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  let cases = readCases();
  
  // Si ya existe el ID, se actualiza (editar)
  const existingIndex = cases.findIndex(c => c.id === newCase.id);
  if (existingIndex !== -1) {
    cases[existingIndex] = { ...cases[existingIndex], ...newCase };
  } else {
    // Si no existe, se inserta al inicio
    newCase.id = newCase.id || Date.now().toString();
    newCase.createdAt = newCase.createdAt || new Date().toISOString();
    cases.unshift(newCase);
  }

  writeCases(cases);
  res.status(201).json({ status: 'ok', data: newCase });
});

// 3. Eliminar un caso por ID
app.delete('/api/casos/:id', (req, res) => {
  const { id } = req.params;
  let cases = readCases();
  cases = cases.filter(c => c.id !== id);
  writeCases(cases);
  res.json({ status: 'ok', message: 'Caso eliminado' });
});

// 4. Limpiar todos los casos del turno
app.delete('/api/casos', (req, res) => {
  writeCases([]);
  res.json({ status: 'ok', message: 'Todos los casos fueron eliminados' });
});

// 5. Endpoint para envío automático de WhatsApp en segundo plano
app.post('/api/enviar-whatsapp', async (req, res) => {
    const { mensaje, numero } = req.body;
    const destino = numero || "584126615457"; // Número por defecto (+58 412-6615457)

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

// Ruta principal abre el index.html (Compatible con Express 5)
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Servidor CCTV iniciado correctamente`);
  console.log(`📍 Acceso Local: http://localhost:${PORT}`);
  console.log(`===================================================`);
});