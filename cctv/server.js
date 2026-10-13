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

// Ruta principal abre el index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Servidor CCTV iniciado correctamente`);
  console.log(`📍 Acceso Local: http://localhost:${PORT}`);
  console.log(`===================================================`);
});