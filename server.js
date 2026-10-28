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

// --- CLASIFICACIÓN Y PARSEO INTELIGENTE DE HISTÓRICOS ---

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

    const caseDateObj = new Date(fechaCreacionRaw);
    const caseDateStr = caseDateObj.toISOString().slice(0, 10);
    const minutosInicio = parseHoraAMinutos(c.startTime, fechaCreacionRaw);

    if (turno === 'dia') {
      return (caseDateStr === targetDateStr) && (minutosInicio >= 510 && minutosInicio < 1080);
    } 
    else if (turno === 'noche') {
      return (caseDateStr === targetDateStr) && (minutosInicio >= 1080 && minutosInicio < 1320);
    } 
    else if (turno === 'madrugada') {
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
    { header: 'Solución / Observaciones', key: 'solution', width: 50 },
    { header: 'Fecha Registro', key: 'createdAt', width: 22 }
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
      createdAt: (c.createdAt || c.created_at) ? new Date(c.createdAt || c.created_at).toLocaleString() : ''
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

// --- RUTAS DE API (REST API CON POSTGRESQL) ---

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

// --- RUTA DE BORRADO SELECTIVO CON SOPORTE DE ZONA HORARIA LOCAL ---
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

      // Convertir la fecha del registro a fecha local para evitar desfases de UTC
      const dateObj = new Date(rawDate);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const caseLocalDate = `${year}-${month}-${day}`;

      let match = true;

      // 1. Validar Fecha
      if (fecha && caseLocalDate !== fecha) {
        match = false;
      }

      // 2. Validar Sede (Flexible: sin importar mayúsculas, minúsculas o espacios)
      if (store && store !== 'ALL') {
        const storeDB = (c.store || '').trim().toLowerCase();
        const storeSearch = store.trim().toLowerCase();
        if (storeDB !== storeSearch) {
          match = false;
        }
      }

      // 3. Validar Operador (Flexible: coincidencia parcial)
      if (operator && operator.trim() !== '') {
        const opVal = (c.operator || '').toLowerCase();
        const searchOp = operator.toLowerCase();
        if (!opVal.includes(searchOp)) {
          match = false;
        }
      }

      if (match) {
        idsToDelete.push(row.id);
      }
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

app.post('/api/enviar-whatsapp', async (req, res) => {
  const { mensaje, numero } = req.body;
  const destino = numero || "584126615457";

  try {
    const INSTANCE_ID = process.env.WA_INSTANCE_ID; 
    const API_TOKEN = process.env.WA_API_TOKEN;

    if (!INSTANCE_ID || !API_TOKEN) {
      console.log(`[WA SIMULADO a ${destino}]:`, mensaje);
      return res.json({ success: true, message: "Mensaje procesado correctamente (Modo simulación)." });
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

async function ejecutarCorteYNotificar(turnoNombre) {
  try {
    const hoyStr = new Date().toISOString().slice(0, 10);
    const result = await pool.query('SELECT data, created_at FROM casos');
    const allCases = result.rows.map(r => r.data || {});
    const casosTurno = filtrarCasosPorTurno(allCases, hoyStr, turnoNombre);

    await generarExcelTurno(casosTurno, turnoNombre, hoyStr);

    const mensaje = `📊 *CIERRE AUTOMÁTICO DE TURNO CCTV* (${turnoNombre.toUpperCase()})\n📅 Fecha: ${hoyStr}\n📌 Total Casos Registrados: ${casosTurno.length}\n_Corte procesado automáticamente por el servidor._`;

    const INSTANCE_ID = process.env.WA_INSTANCE_ID; 
    const API_TOKEN = process.env.WA_API_TOKEN;
    if (INSTANCE_ID && API_TOKEN) {
      await fetch(`https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${API_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: "584126615457@c.us", message: mensaje })
      });
    }
    console.log(`✅ Corte automático Turno ${turnoNombre} completado.`);
  } catch (err) {
    console.error(`Error en cron job de Turno ${turnoNombre}:`, err);
  }
}

cron.schedule('0 18 * * *', () => ejecutarCorteYNotificar('dia'));
cron.schedule('0 22 * * *', () => ejecutarCorteYNotificar('noche'));
cron.schedule('0 7 * * *', () => ejecutarCorteYNotificar('madrugada'));

app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Servidor CCTV iniciado con PostgreSQL`);
  console.log(`📍 Acceso Local: http://localhost:${PORT}`);
  console.log(`===================================================`);
});