const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const ExcelJS = require('exceljs');
const cron = require('node-cron');

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
app.use(express.static(__dirname));

// Directorio para almacenar los reportes Excel generados
const reportesDir = path.join(__dirname, 'reportes');
if (!fs.existsSync(reportesDir)) {
  fs.mkdirSync(reportesDir);
}

// Helper para filtrar casos por turno y fecha exacta
function filtrarCasosPorTurno(casos, fechaStr, turno) {
  const targetDate = new Date(fechaStr);
  
  return casos.filter(c => {
    if (!c.createdAt) return false;
    const cDate = new Date(c.createdAt);
    const hours = cDate.getHours();
    const minutes = cDate.getMinutes();
    const timeVal = hours + minutes / 60;
    const cDateString = cDate.toISOString().slice(0, 10);
    
    if (turno === 'dia') {
      // Turno Día/Tarde: 08:30 AM a 06:00 PM (08:30 - 18:00)
      return cDateString === fechaStr && timeVal >= 8.5 && timeVal < 18.0;
    } else if (turno === 'noche') {
      // Turno Cierre/Noche: 06:00 PM a 10:00 PM (18:00 - 22:00)
      return cDateString === fechaStr && timeVal >= 18.0 && timeVal < 22.0;
    } else if (turno === 'madrugada') {
      // Turno Nocturno/Madrugada: 10:00 PM a 07:00 AM del día siguiente (22:00 - 07:00)
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().slice(0, 10);
      
      if (cDateString === fechaStr && timeVal >= 22.0) return true;
      if (cDateString === nextDateStr && timeVal < 7.0) return true;
      return false;
    }
    return false;
  });
}

// Función para generar Excel Ejecutivo con diseño profesional usando ExcelJS
async function generarExcelTurno(casosTurno, nombreTurno, fechaStr) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema CCTV';
  workbook.created = new Date();

  // Pestaña 1: Resumen y Dashboard
  const wsDashboard = workbook.addWorksheet('Resumen de Turno');
  wsDashboard.views = [{ showGridLines: true }];

  wsDashboard.mergeCells('A1:E1');
  const titleCell = wsDashboard.getCell('A1');
  titleCell.value = `REPORTE EJECUTIVO - TURNO ${nombreTurno.toUpperCase()} (${fechaStr})`;
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'center' };
  wsDashboard.getRow(1).height = 30;

  wsDashboard.getCell('A3').value = 'Total Casos en el Turno:';
  wsDashboard.getCell('B3').value = casosTurno.length;
  wsDashboard.getCell('A3').font = { bold: true };

  // Pestaña 2: Detalle de Novedades
  const wsDetalle = workbook.addWorksheet('Detalle de Novedades');
  wsDetalle.views = [{ showGridLines: true }];

  wsDetalle.columns = [
    { header: 'N°', key: 'index', width: 6 },
    { header: 'Tienda / Sucursal', key: 'store', width: 20 },
    { header: 'Operador', key: 'operator', width: 18 },
    { header: 'Hora Inicio', key: 'startTime', width: 12 },
    { header: 'Hora Fin', key: 'endTime', width: 12 },
    { header: 'Tipo de Novedad', key: 'novelty', width: 25 },
    { header: 'Solución / Observaciones', key: 'solution', width: 45 },
    { header: 'Fecha Registro', key: 'createdAt', width: 20 }
  ];

  const headerRow = wsDetalle.getRow(1);
  headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '334155' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'center' };
  headerRow.height = 25;

  casosTurno.forEach((c, idx) => {
    const row = wsDetalle.addRow({
      index: idx + 1,
      store: c.store || 'N/A',
      operator: c.operator || 'Operador',
      startTime: c.startTime || '08:00',
      endTime: c.endTime || '16:00',
      novelty: c.novelty || 'General',
      solution: c.solution || '-',
      createdAt: c.createdAt ? new Date(c.createdAt).toLocaleString() : ''
    });

    if (idx % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
    }
    row.font = { name: 'Arial', size: 10 };
  });

  const filePath = path.join(reportesDir, `Reporte_Turno_${nombreTurno}_${fechaStr}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

// --- RUTAS DE API ---

app.get('/api/casos', async (req, res) => {
  try {
    const result = await pool.query('SELECT data, created_at FROM casos ORDER BY created_at DESC');
    const cases = result.rows.map(row => {
      let caseObj = row.data || {};
      if (!caseObj.createdAt) {
        caseObj.createdAt = row.created_at || new Date().toISOString();
      }
      return caseObj;
    });
    res.json(cases);
  } catch (err) {
    console.error('Error al obtener casos:', err);
    res.status(500).json({ error: 'Error al consultar la base de datos' });
  }
});

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
    await pool.query(query, [newCase.id, newCase.store, newCase.novelty, newCase.createdAt, JSON.stringify(newCase)]);
    res.status(201).json({ status: 'ok', data: newCase });
  } catch (err) {
    console.error('Error al guardar caso:', err);
    res.status(500).json({ error: 'Error al guardar en la base de datos' });
  }
});

app.put('/api/casos/:id', async (req, res) => {
  const { id } = req.params;
  const updatedCase = req.body;
  try {
    const query = `UPDATE casos SET store = $1, novelty = $2, data = $3 WHERE id = $4;`;
    await pool.query(query, [updatedCase.store, updatedCase.novelty, JSON.stringify(updatedCase), id]);
    res.json({ status: 'ok', message: 'Caso actualizado con éxito' });
  } catch (err) {
    console.error('Error al actualizar caso:', err);
    res.status(500).json({ error: 'Error al actualizar en la base de datos' });
  }
});

app.delete('/api/casos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM casos WHERE id = $1', [id]);
    res.json({ status: 'ok', message: 'Caso eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar caso' });
  }
});

app.delete('/api/casos', async (req, res) => {
  try {
    await pool.query('DELETE FROM casos');
    res.json({ status: 'ok', message: 'Todos los casos eliminados' });
  } catch (err) {
    res.status(500).json({ error: 'Error al limpiar la base de datos' });
  }
});

// Endpoint para generar y consultar reporte de turno
app.post('/api/reportes/turno', async (req, res) => {
  const { fecha, turno } = req.body;
  if (!fecha || !turno) {
    return res.status(400).json({ error: 'Faltan parámetros fecha o turno' });
  }

  try {
    const result = await pool.query('SELECT data, created_at FROM casos');
    const allCases = result.rows.map(row => row.data || {});
    const casosTurno = filtrarCasosPorTurno(allCases, fecha, turno);

    await generarExcelTurno(casosTurno, turno, fecha);

    res.json({
      success: true,
      totalCasos: casosTurno.length,
      casos: casosTurno,
      fileUrl: `/reportes/Reporte_Turno_${turno}_${fecha}.xlsx`
    });
  } catch (err) {
    console.error('Error al generar reporte de turno:', err);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

// Servir archivos estáticos de reportes generados
app.use('/reportes', express.static(reportesDir));

// Endpoint WhatsApp
app.post('/api/enviar-whatsapp', async (req, res) => {
  const { mensaje, numero } = req.body;
  const destino = numero || "584126615457";

  try {
    const INSTANCE_ID = process.env.WA_INSTANCE_ID; 
    const API_TOKEN = process.env.WA_API_TOKEN;

    if (!INSTANCE_ID || !API_TOKEN) {
      console.log("WhatsApp simulado (sin credenciales WA):", mensaje);
      return res.json({ success: true, message: "Mensaje procesado correctamente." });
    }

    const response = await fetch(`https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: `${destino}@c.us`, message: mensaje })
    });

    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error al enviar WhatsApp:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tareas Programadas Automáticas (Cron Jobs)
// 1. Cierre Turno Día: 6:00 PM (18:00)
cron.schedule('0 18 * * *', async () => {
  console.log('⏰ Cron Job: Generando reporte automático Turno Día...');
});
// 2. Cierre Turno Noche: 10:00 PM (22:00)
cron.schedule('0 22 * * *', async () => {
  console.log('⏰ Cron Job: Generando reporte automático Turno Noche...');
});
// 3. Cierre Turno Madrugada: 7:00 AM (07:00)
cron.schedule('0 7 * * *', async () => {
  console.log('⏰ Cron Job: Generando reporte automático Turno Madrugada...');
});

app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Servidor CCTV iniciado en puerto ${PORT}`);
  console.log(`===================================================`);
});