const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const ExcelJS = require('exceljs');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la conexión a PostgreSQL
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

// --- CLASIFICACIÓN Y PARSEO INTELIGENTE DE TURNOS ---

function parseHoraAMinutos(horaStr, defaultDate) {
  if (!horaStr) {
    if (!defaultDate) return 0;
    const d = new Date(defaultDate);
    return d.getHours() * 60 + d.getMinutes();
  }

  if (typeof horaStr === 'string' && horaStr.includes(':')) {
    const parts = horaStr.trim().split(':');
    let h = parseInt(parts[0], 10) || 0;
    let m = parseInt(parts[1], 10) || 0;

    const isPM = horaStr.toLowerCase().includes('pm');
    const isAM = horaStr.toLowerCase().includes('am');
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;

    return h * 60 + m;
  }

  return 0;
}

// Filtrado adaptado a tus horarios exactos:
// Turno A: 07:00 AM (420 min) a 06:00 PM (1080 min)
// Turno B: 06:00 PM (1080 min) a 10:00 PM (1320 min)
// Turno Nocturno: 10:00 PM (1320 min) a 07:00 AM (420 min del día siguiente)
function filtrarCasosPorTurno(casos, fechaStr, turno) {
  const targetDateStr = fechaStr;
  const [year, month, day] = fechaStr.split('-').map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  const nextDateObj = new Date(targetDate);
  nextDateObj.setDate(nextDateObj.getDate() + 1);
  const nextDateStr = nextDateObj.toISOString().slice(0, 10);

  return casos.filter(c => {
    const fechaCreacionRaw = c.createdAt || c.created_at;
    if (!fechaCreacionRaw) return false;

    // Comparación limpia por texto local (YYYY-MM-DD)
    const caseDateStr = String(fechaCreacionRaw).slice(0, 10);
    const minutosInicio = parseHoraAMinutos(c.startTime, fechaCreacionRaw);

    if (turno === 'A' || turno === 'dia') {
      return (caseDateStr === targetDateStr) && (minutosInicio >= 420 && minutosInicio < 1080);
    } 
    else if (turno === 'B' || turno === 'tarde') {
      return (caseDateStr === targetDateStr) && (minutosInicio >= 1080 && minutosInicio < 1320);
    } 
    else if (turno === 'nocturno' || turno === 'madrugada') {
      const esNocheMismaFecha = (caseDateStr === targetDateStr) && (minutosInicio >= 1320);
      const esMadrugadaDiaSiguiente = (caseDateStr === nextDateStr) && (minutosInicio < 420);
      return esNocheMismaFecha || esMadrugadaDiaSiguiente;
    }

    return false;
  });
}

async function generarExcelTurno(casosTurno, nombreTurno, fechaStr) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema CCTV';
  workbook.created = new Date();

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

  const wsDetalle = workbook.addWorksheet('Detalle de Novedades');
  wsDetalle.views = [{ showGridLines: true }];

  wsDetalle.columns = [
    { header: 'N°', key: 'index', width: 6 },
    { header: 'Tienda / Sucursal', key: 'store', width: 22 },
    { header: 'Operador CCTV', key: 'operator', width: 20 },
    { header: 'Hora Inicio', key: 'startTime', width: 12 },
    { header: 'Hora Fin', key: 'endTime', width: 12 },
    { header: 'Tipo de Novedad', key: 'novelty', width: 25 },
    { header: 'Novedad / Detalle', key: 'details', width: 40 },
    { header: 'Soluciones', key: 'solution', width: 40 },
    { header: 'Acciones Tomadas', key: 'actions', width: 40 },
    { header: 'Actuantes / Involucrados', key: 'actors', width: 30 },
    { header: 'Fecha Registro', key: 'createdAt', width: 22 }
  ];

  const headerRow = wsDetalle.getRow(1);
  headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '334155' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'center' };
  headerRow.height = 25;

  casosTurno.forEach((c, idx) => {
    const rawDate = c.createdAt || c.created_at || '';
    const formattedDate = rawDate ? rawDate.replace('T', ' ').slice(0, 19) : '';

    const row = wsDetalle.addRow({
      index: idx + 1,
      store: c.store || 'N/A',
      operator: c.operator || 'Operador',
      startTime: c.startTime || '00:00',
      endTime: c.endTime || '00:00',
      novelty: c.novelty || 'General',
      details: c.details || '-',
      solution: c.solution || '-',
      actions: c.actions || '-',
      actors: c.actors || '-',
      createdAt: formattedDate
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
    const result = await pool.query('SELECT id, data, created_at FROM casos ORDER BY created_at DESC');
    const cases = result.rows.map(row => {
      let caseObj = row.data || {};
      caseObj.id = row.id;
      if (!caseObj.createdAt) {
        caseObj.createdAt = row.created_at || new Date().toISOString();
      }
      return caseObj;
    });

    // Oñemohenda pyahuvégui yvyguotyo
    cases.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    res.json(cases);
  } catch (err) {
    console.error('Error al obtener casos:', err);
    res.status(500).json({ error: 'Error al consultar la base de datos' });
  }
});

app.post('/api/casos', async (req, res) => {
  const newCase = req.body;
  console.log("📥 Datos recibidos para guardar:", newCase);

  if (!newCase || !newCase.store || !newCase.novelty) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }
  try {
    newCase.id = newCase.id || Date.now().toString();
    newCase.createdAt = newCase.createdAt || new Date().toISOString().slice(0, 19);

    const query = `
      INSERT INTO casos (id, store, novelty, created_at, data)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) 
      DO UPDATE SET store = EXCLUDED.store, novelty = EXCLUDED.novelty, created_at = EXCLUDED.created_at, data = EXCLUDED.data
      RETURNING *;
    `;
    
    const result = await pool.query(query, [
      newCase.id, 
      newCase.store, 
      newCase.novelty, 
      newCase.createdAt, 
      JSON.stringify(newCase)
    ]);

    console.log("✅ Caso guardado exitosamente en PostgreSQL ID:", newCase.id);
    res.status(201).json({ status: 'ok', data: newCase });
  } catch (err) {
    console.error('❌ Error al guardar caso en PostgreSQL:', err);
    res.status(500).json({ error: 'Error al guardar en la base de datos' });
  }
});

app.put('/api/casos/:id', async (req, res) => {
  const { id } = req.params;
  const updatedCase = req.body;
  try {
    const createdAt = updatedCase.createdAt || new Date().toISOString().slice(0, 19);
    const query = `UPDATE casos SET store = $1, novelty = $2, created_at = $3, data = $4 WHERE id = $5;`;
    await pool.query(query, [updatedCase.store, updatedCase.novelty, createdAt, JSON.stringify(updatedCase), id]);
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
  const { fecha, store, operator } = req.query;
  try {
    if (!fecha && (!store || store === 'ALL') && (!operator || operator.trim() === '')) {
      await pool.query('DELETE FROM casos');
      return res.json({ status: 'ok', message: 'Todos los casos fueron eliminados' });
    }

    const result = await pool.query('SELECT id, data, created_at FROM casos');
    const idsToDelete = [];

    result.rows.forEach(row => {
      const c = row.data || {};
      const rawDate = c.createdAt || row.created_at;
      if (!rawDate) return;

      const caseLocalDate = String(rawDate).slice(0, 10);

      let match = true;
      if (fecha && caseLocalDate !== fecha) match = false;
      if (store && store !== 'ALL' && (c.store || '').trim().toLowerCase() !== store.trim().toLowerCase()) match = false;
      if (operator && operator.trim() !== '' && !(c.operator || '').toLowerCase().includes(operator.toLowerCase())) match = false;

      if (match) idsToDelete.push(row.id);
    });

    if (idsToDelete.length > 0) {
      for (const id of idsToDelete) {
        await pool.query('DELETE FROM casos WHERE id = $1', [id]);
      }
    }

    res.json({ status: 'ok', message: `Se eliminaron ${idsToDelete.length} registros coincidentes.` });
  } catch (err) {
    console.error('Error en borrado selectivo:', err);
    res.status(500).json({ error: 'Error al depurar la base de datos' });
  }
});

app.post('/api/reportes/turno', async (req, res) => {
  const { fecha, turno } = req.body;
  if (!fecha || !turno) {
    return res.status(400).json({ error: 'Faltan parámetros fecha o turno' });
  }

  try {
    const result = await pool.query('SELECT data, created_at FROM casos');
    const allCases = result.rows.map(row => {
      let c = row.data || {};
      if (!c.createdAt) c.createdAt = row.created_at;
      return c;
    });

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

app.use('/reportes', express.static(reportesDir));

// --- ENVIAR CORTE AUTOMÁTICO DE WHATSAPP CON DESGLOSE DE CASOS ---
async function ejecutarCorteYNotificar(turnoNombre) {
  try {
    const hoyStr = new Date().toISOString().slice(0, 10);
    const result = await pool.query('SELECT data, created_at FROM casos');
    const allCases = result.rows.map(r => r.data || {});
    const casosTurno = filtrarCasosPorTurno(allCases, hoyStr, turnoNombre);

    // Generar archivo Excel de respaldo
    await generarExcelTurno(casosTurno, turnoNombre, hoyStr);

    // Armar el mensaje para WhatsApp con el resumen completo de novedades
    let mensaje = `🚨 *CORTE AUTOMÁTICO DE TURNO ${turnoNombre.toUpperCase()}* 🚨\n`;
    mensaje += `📅 *Fecha:* ${hoyStr}\n`;
    mensaje += `📌 *Total de Novedades Registradas:* ${casosTurno.length}\n`;
    mensaje += `===================================\n\n`;

    if (casosTurno.length === 0) {
      mensaje += `✅ *Sin novedades registradas durante este turno.*\n`;
    } else {
      casosTurno.forEach((c, idx) => {
        mensaje += `*${idx + 1}. Sede:* ${c.store || 'N/A'}\n`;
        mensaje += `⏰ *Horario:* ${c.startTime || ''} - ${c.endTime || ''}\n`;
        mensaje += `📌 *Tipo:* ${c.novelty || 'General'}\n`;
        mensaje += `📝 *Novedad:* ${c.details || 'Sin detalle'}\n`;
        mensaje += `💡 *Solución:* ${c.solution || '-'}\n`;
        mensaje += `⚙️ *Acciones:* ${c.actions || '-'}\n`;
        mensaje += `👤 *Actuantes:* ${c.actors || '-'}\n`;
        mensaje += `-----------------------------------\n`;
      });
    }

    const INSTANCE_ID = process.env.WA_INSTANCE_ID; 
    const API_TOKEN = process.env.WA_API_TOKEN;

    if (INSTANCE_ID && API_TOKEN) {
      await fetch(`https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${API_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: "584126615457@c.us", message: mensaje })
      });
      console.log(`✅ WhatsApp enviado con éxito para el Turno ${turnoNombre}.`);
    } else {
      console.log(`[WA SIMULADO - Turno ${turnoNombre}]:\n`, mensaje);
    }
  } catch (err) {
    console.error(`Error en cron job de Turno ${turnoNombre}:`, err);
  }
}

// --- PROGRAMACIÓN DE CRON JOBS (3 TURNOS) ---
// 1. Cierre Turno A (7:00 AM - 6:00 PM) -> Se ejecuta a las 18:00 (6:00 PM)
cron.schedule('0 18 * * *', () => ejecutarCorteYNotificar('A'));

// 2. Cierre Turno B (6:00 PM - 10:00 PM) -> Se ejecuta a las 22:00 (10:00 PM)
cron.schedule('0 22 * * *', () => ejecutarCorteYNotificar('B'));

// 3. Cierre Turno Nocturno (10:00 PM - 7:00 AM) -> Se ejecuta a las 07:00 AM
cron.schedule('0 7 * * *', () => ejecutarCorteYNotificar('nocturno'));

app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Servidor CCTV iniciado con PostgreSQL`);
  console.log(`📍 Acceso Local: http://localhost:${PORT}`);
  console.log(`===================================================`);
});