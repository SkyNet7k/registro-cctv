const STORE_GROUPS = {
  "Alkosto": [
    "Alkosto-1", "Alkosto-2", "Alkosto-3", "Alkosto-4", "Alkosto-5",
    "Alkosto-6", "Alkosto-7", "Alkosto-8", "Alkosto-9", "Alkosto-10"
  ],
  "Familia Center": [
    "FC-1", "FC-2", "FC-3", "FC-4", "FC-5", "FC-6", "FC-7", "FC-8"
  ],
  "Vecinos": [
    "Vecinos-1", "Vecinos-2"
  ]
};

let adminCases = [];
let pendingImportCases = [];
let trendChartInstance = null;
let doughnutChartInstance = null;
let shiftPreviewChartInstance = null;

const adminTableBody = document.getElementById('adminTableBody');
const adminEmptyState = document.getElementById('adminEmptyState');
const adminSearchInput = document.getElementById('adminSearchInput');
const adminTableCount = document.getElementById('adminTableCount');
const btnExportExcel = document.getElementById('btnExportExcel');
const btnClearAll = document.getElementById('btnClearAll');
const txtFileInput = document.getElementById('txtFileInput');
const shiftDateInput = document.getElementById('shiftDateInput');

// KPI Elements
const kpiTotalCases = document.getElementById('kpiTotalCases');
const kpiTopNovelty = document.getElementById('kpiTopNovelty');
const kpiTopStore = document.getElementById('kpiTopStore');
const kpiTopOperator = document.getElementById('kpiTopOperator');

// Modal de Edición Elements
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editId = document.getElementById('editId');
const editOperator = document.getElementById('editOperator');
const editStore = document.getElementById('editStore');
const editStartTime = document.getElementById('editStartTime');
const editEndTime = document.getElementById('editEndTime');
const editNovelty = document.getElementById('editNovelty');
const editSolution = document.getElementById('editSolution');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelEdit = document.getElementById('btnCancelEdit');

document.addEventListener('DOMContentLoaded', () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (shiftDateInput) {
    shiftDateInput.value = todayStr;
  }
  
  const queryDateInput = document.getElementById('queryDateInput');
  if (queryDateInput) {
    queryDateInput.value = todayStr;
  }

  populateEditStoreDropdown();
  populateQueryStoreDropdown();
  populateBulkStoreDropdown();
  loadAdminCases();
});

async function loadAdminCases() {
  try {
    const res = await fetch('/api/casos');
    if (res.ok) {
      adminCases = await res.json();
      updateDashboard();
      renderAdminTable();
    }
  } catch (err) {
    console.error('Error al cargar casos en panel admin:', err);
  }
}

function populateEditStoreDropdown() {
  if (!editStore) return;
  editStore.innerHTML = '';
  for (const [groupName, storeList] of Object.entries(STORE_GROUPS)) {
    const optGroup = document.createElement('optgroup');
    optGroup.label = groupName;
    storeList.forEach(store => {
      const option = document.createElement('option');
      option.value = store;
      option.textContent = store;
      optGroup.appendChild(option);
    });
    editStore.appendChild(optGroup);
  }
}

function populateQueryStoreDropdown() {
  const storeSelect = document.getElementById('queryStoreSelect');
  if (!storeSelect) return;

  for (const [groupName, storeList] of Object.entries(STORE_GROUPS)) {
    const optGroup = document.createElement('optgroup');
    optGroup.label = groupName;
    storeList.forEach(store => {
      const option = document.createElement('option');
      option.value = store;
      option.textContent = store;
      optGroup.appendChild(option);
    });
    storeSelect.appendChild(optGroup);
  }
}

function populateBulkStoreDropdown() {
  const bulkSelect = document.getElementById('bulkStoreSelect');
  if (!bulkSelect) return;

  for (const [groupName, storeList] of Object.entries(STORE_GROUPS)) {
    const optGroup = document.createElement('optgroup');
    optGroup.label = groupName;
    storeList.forEach(store => {
      const option = document.createElement('option');
      option.value = store;
      option.textContent = store;
      optGroup.appendChild(option);
    });
    bulkSelect.appendChild(optGroup);
  }
}

// --- CONSULTA AVANZADA POR TIENDA, FECHA, TURNO Y NOVEDAD ---
function ejecutarConsultaAvanzada() {
  const fechaSeleccionada = document.getElementById('queryDateInput').value;
  const tiendaSeleccionada = document.getElementById('queryStoreSelect').value;
  const turnoSeleccionado = document.getElementById('queryShiftSelect').value;
  const novedadSeleccionada = document.getElementById('queryNoveltySelect').value;

  const container = document.getElementById('queryResultsContainer');
  const tbody = document.getElementById('queryResultsTableBody');
  const totalEl = document.getElementById('qResultTotal');
  const managerEl = document.getElementById('qResultManager');
  const operatorsEl = document.getElementById('qResultOperators');

  if (!container || !tbody) return;

  let casosFiltrados = adminCases.filter(c => {
    const fechaCreacion = c.createdAt || c.created_at;
    if (!fechaCreacion) return false;
    const caseDateStr = new Date(fechaCreacion).toISOString().slice(0, 10);
    return caseDateStr === fechaSeleccionada;
  });

  if (turnoSeleccionado !== 'ALL') {
    casosFiltrados = filtrarCasosPorTurnoLocal(casosFiltrados, fechaSeleccionada, turnoSeleccionado);
  }

  if (tiendaSeleccionada !== 'ALL') {
    casosFiltrados = casosFiltrados.filter(c => c.store === tiendaSeleccionada);
  }

  if (novedadSeleccionada !== 'ALL') {
    casosFiltrados = casosFiltrados.filter(c => c.novelty && c.novelty.toLowerCase().includes(novedadSeleccionada.toLowerCase()));
  }

  totalEl.textContent = casosFiltrados.length;

  const operatorsSet = new Set();
  casosFiltrados.forEach(c => { if (c.operator) operatorsSet.add(c.operator); });
  operatorsEl.textContent = operatorsSet.size > 0 ? Array.from(operatorsSet).join(', ') : 'N/A';

  const managersFound = new Set();
  casosFiltrados.forEach(c => {
    const text = (c.solution || '').toLowerCase();
    if (text.includes('mehad')) managersFound.add('Gerente Mehad');
    if (text.includes('omar')) managersFound.add('Gerente Omar');
    if (text.includes('osman')) managersFound.add('Gerente Osman');
  });
  managerEl.textContent = managersFound.size > 0 ? Array.from(managersFound).join(', ') : 'Turno Regular';

  tbody.innerHTML = '';
  if (casosFiltrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-3 py-6 text-center text-slate-500">No se encontraron registros para los filtros seleccionados.</td></tr>`;
  } else {
    casosFiltrados.forEach(c => {
      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-750/50 border-b border-slate-700/40";
      tr.innerHTML = `
        <td class="px-3 py-2 font-medium text-slate-100">${c.store || 'N/A'}</td>
        <td class="px-3 py-2 text-slate-400">${c.startTime || '08:00'} - ${c.endTime || '16:00'}</td>
        <td class="px-3 py-2">
          <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">${c.novelty || 'General'}</span>
        </td>
        <td class="px-3 py-2 text-slate-300 max-w-xs truncate" title="${c.solution || ''}">${c.solution || '-'}</td>
        <td class="px-3 py-2 text-slate-400">${c.operator || 'Operador'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  container.classList.remove('hidden');
}

function filtrarCasosPorTurnoLocal(casos, fechaStr, turno) {
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
    const minutosInicio = parseHoraAMinutosLocal(c.startTime, fechaCreacionRaw);

    if (turno === 'dia') {
      return (caseDateStr === fechaStr) && (minutosInicio >= 510 && minutosInicio < 1080);
    } else if (turno === 'noche') {
      return (caseDateStr === fechaStr) && (minutosInicio >= 1080 && minutosInicio < 1320);
    } else if (turno === 'madrugada') {
      const esNocheMismaFecha = (caseDateStr === fechaStr) && (minutosInicio >= 1320);
      const esMadrugadaDiaSiguiente = (caseDateStr === nextDateStr) && (minutosInicio < 420);
      return esNocheMismaFecha || esMadrugadaDiaSiguiente;
    }
    return true;
  });
}

function parseHoraAMinutosLocal(horaStr, defaultDate) {
  if (!horaStr) {
    if (!defaultDate) return 0;
    const d = new Date(defaultDate);
    return d.getHours() * 60 + d.getMinutes();
  }
  if (typeof horaStr === 'string' && horaStr.includes(':')) {
    const parts = horaStr.trim().split(':');
    let h = parseInt(parts[0], 10) || 0;
    let m = parseInt(parts[1], 10) || 0;
    if (horaStr.toLowerCase().includes('pm') && h < 12) h += 12;
    if (horaStr.toLowerCase().includes('am') && h === 12) h = 0;
    return h * 60 + m;
  }
  return 0;
}

// --- IMPORTACIÓN MASIVA DESDE TXT CON MODAL DE VISTA PREVIA ---
if (txtFileInput) {
  txtFileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    pendingImportCases = [];

    for (const file of files) {
      try {
        const textContent = await readFileContent(file);
        if (!textContent || textContent.trim() === "") continue;

        const parsedCases = parseTxtReportWhatsApp(textContent);
        pendingImportCases.push(...parsedCases);
      } catch (err) {
        console.error(`Error al procesar el archivo ${file.name}:`, err);
      }
    }

    txtFileInput.value = '';

    if (pendingImportCases.length === 0) {
      alert('No se detectaron reportes válidos en el archivo TXT cargado.');
      return;
    }

    openImportTxtModal();
  });
}

function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = (error) => reject(error);
    reader.readAsText(file, 'UTF-8');
  });
}

function openImportTxtModal() {
  const modal = document.getElementById('importTxtModal');
  const countEl = document.getElementById('importTxtCount');
  const tbody = document.getElementById('importTxtTableBody');

  if (!modal || !tbody) return;

  if (countEl) countEl.textContent = `${pendingImportCases.length} registros detectados`;
  tbody.innerHTML = '';

  pendingImportCases.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-750/50";

    let storeOptionsHtml = `<option value="Sucursal General">Sucursal General</option>`;
    for (const [groupName, storeList] of Object.entries(STORE_GROUPS)) {
      storeOptionsHtml += `<optgroup label="${groupName}">`;
      storeList.forEach(st => {
        const selected = item.store === st ? 'selected' : '';
        storeOptionsHtml += `<option value="${st}" ${selected}>${st}</option>`;
      });
      storeOptionsHtml += `</optgroup>`;
    }

    tr.innerHTML = `
      <td class="px-3 py-2 text-center text-slate-400 font-mono">${index + 1}</td>
      <td class="px-3 py-2">
        <select onchange="updatePendingCaseStore(${index}, this.value)" class="row-store-select w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:ring-1 focus:ring-purple-500">
          ${storeOptionsHtml}
        </select>
      </td>
      <td class="px-3 py-2">
        <select onchange="updatePendingCaseNovelty(${index}, this.value)" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-purple-300 focus:ring-1 focus:ring-purple-500">
          <option value="Faltante / Caja" ${item.novelty === 'Faltante / Caja' ? 'selected' : ''}>Faltante / Caja</option>
          <option value="Personal Interno" ${item.novelty === 'Personal Interno' ? 'selected' : ''}>Personal Interno</option>
          <option value="Hurto / Tentativa" ${item.novelty === 'Hurto / Tentativa' ? 'selected' : ''}>Hurto / Tentativa</option>
          <option value="Objetos Olvidados" ${item.novelty === 'Objetos Olvidados' ? 'selected' : ''}>Objetos Olvidados</option>
          <option value="Daños / Infraestructura" ${item.novelty === 'Daños / Infraestructura' ? 'selected' : ''}>Daños / Infraestructura</option>
          <option value="Otro / General" ${item.novelty === 'Otro / General' ? 'selected' : ''}>Otro / General</option>
        </select>
      </td>
      <td class="px-3 py-2 text-slate-300 text-xs">
        <div class="line-clamp-2" title="${item.details}">${item.details}</div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  modal.classList.remove('hidden');
}

function closeImportTxtModal() {
  const modal = document.getElementById('importTxtModal');
  if (modal) modal.classList.add('hidden');
  pendingImportCases = [];
}

window.aplicarSedeMasiva = function(storeValue) {
  if (!storeValue) return;
  pendingImportCases.forEach(c => c.store = storeValue);
  document.querySelectorAll('.row-store-select').forEach(select => {
    select.value = storeValue;
  });
};

window.updatePendingCaseStore = function(index, storeValue) {
  if (pendingImportCases[index]) {
    pendingImportCases[index].store = storeValue;
  }
};

window.updatePendingCaseNovelty = function(index, noveltyValue) {
  if (pendingImportCases[index]) {
    pendingImportCases[index].novelty = noveltyValue;
  }
};

window.confirmarImportacionMasiva = async function() {
  if (pendingImportCases.length === 0) return;

  const btnConfirm = document.getElementById('btnConfirmImportTxt');
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando...`;
  }

  let importedCount = 0;

  for (const caseData of pendingImportCases) {
    try {
      const res = await fetch('/api/casos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(caseData)
      });
      if (res.ok) importedCount++;
    } catch (err) {
      console.error('Error al guardar caso masivo:', err);
    }
  }

  if (btnConfirm) {
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Confirmar e Importar a DB`;
  }

  closeImportTxtModal();
  alert(`¡Importación masiva completada! Se guardaron ${importedCount} registros en la base de datos.`);
  loadAdminCases();
};

function parseTxtReportWhatsApp(text) {
  const cases = [];
  const rawBlocks = text.split(/(?=\[\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?\])/i);

  rawBlocks.forEach((block) => {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    const fullText = lines.join(' ');
    const lowerText = fullText.toLowerCase();

    // FILTRO INTELIGENTE PARA DESCARTAR RUIDO, SALUDOS, LLEGADAS DE GERENTES Y TURNOS
    if (lowerText.includes('mensajes y las llamadas están cifrados') || 
        lowerText.includes('imagen omitida') || 
        lowerText.includes('sticker omitido') || 
        lowerText.includes('mensaje de voz omitido') ||
        lowerText.includes('gerente') ||
        lowerText.includes('turno b') ||
        lowerText.includes('turno a') ||
        lowerText.includes('llegada del gerente') ||
        lowerText.includes('ya llegó') ||
        lowerText.includes('aun no lo he visto') ||
        lowerText.includes('aún no lo he visto') ||
        lowerText.includes('me indicas cuando llegue') ||
        lowerText.includes('sin novedad') ||
        lowerText.includes('ya se fue') ||
        lowerText.includes('agradecida') ||
        fullText.length < 15) {
      return;
    }

    let detectedStore = "Sucursal General";
    for (const [groupName, storeList] of Object.entries(STORE_GROUPS)) {
      for (const st of storeList) {
        const storeClean = st.toLowerCase().replace('-', '');
        if (lowerText.includes(st.toLowerCase()) || lowerText.includes(storeClean)) {
          detectedStore = st;
          break;
        }
      }
    }

    let category = "Otro / General";
    if (lowerText.includes('faltante') || lowerText.includes('cuadre') || lowerText.includes('caja') || lowerText.includes('billete')) {
      category = "Faltante / Caja";
    } else if (lowerText.includes('almacen') || lowerText.includes('emplead') || lowerText.includes('promotor') || lowerText.includes('cajera')) {
      category = "Personal Interno";
    } else if (lowerText.includes('hurto') || lowerText.includes('robo') || lowerText.includes('bolso') || lowerText.includes('salia')) {
      category = "Hurto / Tentativa";
    } else if (lowerText.includes('olvid') || lowerText.includes('telefono') || lowerText.includes('cartera')) {
      category = "Objetos Olvidados";
    } else if (lowerText.includes('se cayo') || lowerText.includes('roto') || lowerText.includes('danado')) {
      category = "Daños / Infraestructura";
    }

    let startTime = "08:00";
    const timeMatch = block.match(/\[\d{1,2}\/\d{1,2}\/\d{2,4},\s*(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?)/i);
    if (timeMatch && timeMatch[1]) {
      startTime = timeMatch[1];
    }

    let operator = "WhatsApp Importado";
    const senderMatch = block.match(/\]\s*([^:]+):/);
    if (senderMatch && senderMatch[1]) {
      operator = senderMatch[1].trim();
    }

    // Extraer limpiamente el mensaje real de la novedad reportada en el chat
    const cleanedDetails = fullText.replace(/^\[[^\]]+\]\s*[^:]+:\s*/, '').trim();

    cases.push({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      operator: operator,
      store: detectedStore,
      startTime: startTime,
      endTime: startTime,
      novelty: category,
      details: cleanedDetails,
      solution: cleanedDetails, // <-- Aquí guardamos la novedad real en lugar de una frase genérica
      createdAt: new Date().toISOString()
    });
  });

  return cases;
}

// --- ACTUALIZAR KPIS Y GRÁFICOS GENERALES ---
function updateDashboard() {
  const total = adminCases.length;
  if (kpiTotalCases) kpiTotalCases.textContent = total;

  if (total === 0) {
    if (kpiTopNovelty) kpiTopNovelty.textContent = "Ninguna";
    if (kpiTopStore) kpiTopStore.textContent = "Ninguna";
    if (kpiTopOperator) kpiTopOperator.textContent = "Ninguno";
    renderCharts({}, {});
    return;
  }

  const noveltyCounts = {};
  const storeCounts = {};
  const operatorCounts = {};

  adminCases.forEach(c => {
    if (c.novelty) noveltyCounts[c.novelty] = (noveltyCounts[c.novelty] || 0) + 1;
    if (c.store) storeCounts[c.store] = (storeCounts[c.store] || 0) + 1;
    if (c.operator) operatorCounts[c.operator] = (operatorCounts[c.operator] || 0) + 1;
  });

  const topNovelty = Object.keys(noveltyCounts).length > 0 
    ? Object.keys(noveltyCounts).reduce((a, b) => noveltyCounts[a] > noveltyCounts[b] ? a : b) 
    : "Ninguna";

  const topStore = Object.keys(storeCounts).length > 0 
    ? Object.keys(storeCounts).reduce((a, b) => storeCounts[a] > storeCounts[b] ? a : b) 
    : "Ninguna";

  const topOperator = Object.keys(operatorCounts).length > 0 
    ? Object.keys(operatorCounts).reduce((a, b) => operatorCounts[a] > operatorCounts[b] ? a : b) 
    : 'N/A';

  if (kpiTopNovelty) { kpiTopNovelty.textContent = topNovelty; kpiTopNovelty.title = topNovelty; }
  if (kpiTopStore) { kpiTopStore.textContent = topStore; kpiTopStore.title = topStore; }
  if (kpiTopOperator) { kpiTopOperator.textContent = topOperator; kpiTopOperator.title = topOperator; }

  renderCharts(noveltyCounts, storeCounts);
}

function renderCharts(noveltyCounts, storeCounts) {
  const trendCanvas = document.getElementById('trendChart');
  const doughnutCanvas = document.getElementById('doughnutChart');

  if (!trendCanvas || !doughnutCanvas) return;

  const noveltyLabels = Object.keys(noveltyCounts);
  const noveltyData = Object.values(noveltyCounts);

  if (trendChartInstance) trendChartInstance.destroy();
  trendChartInstance = new Chart(trendCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: noveltyLabels.length > 0 ? noveltyLabels : ['Sin datos'],
      datasets: [{
        label: 'Incidencias',
        data: noveltyData.length > 0 ? noveltyData : [0],
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#a855f7'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#334155' } },
        y: { ticks: { color: '#94a3b8', font: { size: 10 }, precision: 0 }, grid: { color: '#334155' } }
      }
    }
  });

  if (doughnutChartInstance) doughnutChartInstance.destroy();
  doughnutChartInstance = new Chart(doughnutCanvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: noveltyLabels.length > 0 ? noveltyLabels : ['Sin datos'],
      datasets: [{
        data: noveltyData.length > 0 ? noveltyData : [1],
        backgroundColor: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#64748b'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', boxWidth: 12, font: { size: 10 } }
        }
      },
      cutout: '70%'
    }
  });
}

// --- VISTA PREVIA Y CORTES POR TURNO ---
async function previsualizarTurno(turno) {
  const fecha = shiftDateInput ? shiftDateInput.value : new Date().toISOString().slice(0, 10);
  try {
    const res = await fetch('/api/reportes/turno', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, turno })
    });
    if (res.ok) {
      const data = await res.json();
      openShiftModal(turno, fecha, data);
    } else {
      alert('Error al generar la vista previa del turno.');
    }
  } catch (err) {
    console.error('Error al conectar con API de turnos:', err);
  }
}

function openShiftModal(turno, fecha, data) {
  const modal = document.getElementById('shiftModal');
  const title = document.getElementById('shiftModalTitle');
  const totalEl = document.getElementById('shiftModalTotal');
  const topStoreEl = document.getElementById('shiftModalTopStore');
  const topOperatorEl = document.getElementById('shiftModalOperator');

  const turnoNombres = {
    'dia': 'Día / Tarde (08:30 - 18:00)',
    'noche': 'Cierre / Noche (18:00 - 22:00)',
    'madrugada': 'Madrugada (22:00 - 07:00)'
  };

  title.innerHTML = `<i class="fa-solid fa-chart-pie text-purple-400 mr-2"></i> Corte Turno ${turnoNombres[turno] || turno.toUpperCase()} - ${fecha}`;
  totalEl.textContent = data.totalCasos;

  const storeCounts = {};
  const operatorCounts = {};

  data.casos.forEach(c => { 
    const st = c.store || 'Sin Especificar';
    storeCounts[st] = (storeCounts[st] || 0) + 1;

    const op = c.operator || 'Sin Asignar';
    operatorCounts[op] = (operatorCounts[op] || 0) + 1;
  });

  const topStore = Object.keys(storeCounts).length ? Object.keys(storeCounts).reduce((a, b) => storeCounts[a] > storeCounts[b] ? a : b) : 'Ninguna';
  topStoreEl.textContent = topStore;

  const topOperator = Object.keys(operatorCounts).length ? Object.keys(operatorCounts).reduce((a, b) => operatorCounts[a] > operatorCounts[b] ? a : b) : 'No especificado';
  if (topOperatorEl) topOperatorEl.textContent = topOperator;

  const novCounts = {};
  data.casos.forEach(c => { 
    const nov = c.novelty || 'Otro / General';
    novCounts[nov] = (novCounts[nov] || 0) + 1; 
  });

  const canvas = document.getElementById('shiftPreviewChart');
  if (shiftPreviewChartInstance) shiftPreviewChartInstance.destroy();

  const labels = Object.keys(novCounts).length ? Object.keys(novCounts) : ['Sin incidencias'];
  const chartData = Object.values(novCounts).length ? Object.values(novCounts) : [0];

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, '#a855f7');
  gradient.addColorStop(1, 'rgba(168, 85, 247, 0.2)');

  shiftPreviewChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Casos Registrados',
        data: chartData,
        backgroundColor: gradient,
        borderColor: '#c084fc',
        borderWidth: 1.5,
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 50
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#e2e8f0',
          bodyColor: '#c084fc',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            afterLabel: () => `👤 Operador: ${topOperator}`
          }
        }
      },
      scales: {
        x: { 
          ticks: { color: '#94a3b8', font: { size: 11, weight: '500' } }, 
          grid: { display: false } 
        },
        y: { 
          beginAtZero: true,
          ticks: { color: '#94a3b8', font: { size: 10 }, precision: 0, stepSize: 1 }, 
          grid: { color: '#334155', strokeDash: [4, 4] } 
        }
      }
    }
  });

  document.getElementById('btnDownloadShiftExcel').onclick = () => {
    window.location.href = data.fileUrl;
  };

  document.getElementById('btnSendShiftWhatsApp').onclick = async () => {
    const mensaje = `📊 *REPORTE DE TURNO CCTV*\n⏰ Turno: ${turno.toUpperCase()}\n📅 Fecha: ${fecha}\n👤 Operador: ${topOperator}\n📌 Total Casos: ${data.totalCasos}\n🏢 Tienda Principal: ${topStore}\n\n_Corte generado desde el sistema administrativo_`;
    try {
      const r = await fetch('/api/enviar-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje })
      });
      const resp = await r.json();
      if (resp.success) {
        alert('¡Reporte de turno enviado por WhatsApp con éxito!');
      } else {
        alert('Aviso: Petición recibida pero sin credenciales de WhatsApp activas.');
      }
    } catch (e) {
      alert('Error al enviar por WhatsApp');
    }
  };

  if (modal) modal.classList.remove('hidden');
}

window.closeShiftModal = function() {
  const modal = document.getElementById('shiftModal');
  if (modal) modal.classList.add('hidden');
};

// --- RENDERIZAR TABLA PRINCIPAL ---
function renderAdminTable() {
  if (!adminTableBody) return;
  
  const query = adminSearchInput ? adminSearchInput.value.toLowerCase().trim() : '';
  const filtered = adminCases.filter(c => 
    (c.store && c.store.toLowerCase().includes(query)) ||
    (c.novelty && c.novelty.toLowerCase().includes(query)) ||
    (c.solution && c.solution.toLowerCase().includes(query)) ||
    (c.operator && c.operator.toLowerCase().includes(query))
  );

  adminTableBody.innerHTML = '';

  if (filtered.length === 0) {
    if (adminEmptyState) adminEmptyState.classList.remove('hidden');
  } else {
    if (adminEmptyState) adminEmptyState.classList.add('hidden');
    
    filtered.forEach(c => {
      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-750/50 transition border-b border-slate-700/40";
      
      tr.innerHTML = `
        <td class="px-4 py-3">
          <div class="font-medium text-slate-100">${c.store || 'N/A'}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">
            <i class="fa-regular fa-clock mr-1"></i>${c.startTime || '08:00'} - ${c.endTime || '16:00'}
          </div>
        </td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            ${c.novelty || 'Otro'}
          </span>
        </td>
        <td class="px-4 py-3 max-w-xs">
          <p class="truncate text-slate-300 text-xs" title="${c.solution || ''}">${c.solution || '-'}</p>
        </td>
        <td class="px-4 py-3 text-slate-400 whitespace-nowrap">
          ${c.operator || 'Operador Importado'}
        </td>
        <td class="px-4 py-3 text-center whitespace-nowrap space-x-2">
          <button onclick="openEditModal('${c.id}')" class="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded transition" title="Editar">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button onclick="deleteCase('${c.id}')" class="px-2 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 rounded transition" title="Eliminar">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;
      adminTableBody.appendChild(tr);
    });
  }

  if (adminTableCount) adminTableCount.textContent = `Mostrando ${filtered.length} de ${adminCases.length} registros`;
}

if (adminSearchInput) adminSearchInput.addEventListener('input', renderAdminTable);

// --- MODAL DE EDICIÓN CRUD ---
window.openEditModal = function(id) {
  const c = adminCases.find(item => item.id === id);
  if (!c) return;

  editId.value = c.id;
  editOperator.value = c.operator || '';
  editStore.value = c.store || '';
  editStartTime.value = c.startTime || '';
  editEndTime.value = c.endTime || '';
  editNovelty.value = c.novelty || '';
  editSolution.value = c.solution || '';

  if (editModal) editModal.classList.remove('hidden');
};

function closeEditModal() {
  if (editModal) editModal.classList.add('hidden');
}

if (btnCloseModal) btnCloseModal.addEventListener('click', closeEditModal);
if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEditModal);

if (editForm) {
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const updatedData = {
      id: editId.value,
      operator: editOperator.value.trim(),
      store: editStore.value,
      startTime: editStartTime.value,
      endTime: editEndTime.value,
      novelty: editNovelty.value,
      solution: editSolution.value.trim()
    };

    try {
      const res = await fetch(`/api/casos/${updatedData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      if (res.ok) {
        closeEditModal();
        loadAdminCases();
      } else {
        alert('Error al actualizar el caso.');
      }
    } catch (err) {
      console.error('Error en actualización:', err);
    }
  });
}

window.deleteCase = async function(id) {
  if (!confirm('¿Estás seguro de eliminar este registro de novedad?')) return;

  try {
    const res = await fetch(`/api/casos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadAdminCases();
    } else {
      alert('Error al eliminar el caso.');
    }
  } catch (err) {
    console.error('Error al eliminar:', err);
  }
};

if (btnClearAll) {
  btnClearAll.addEventListener('click', async () => {
    if (!confirm('⚠️ ¡ADVERTENCIA! ¿Deseas eliminar TODOS los registros de la base de datos? Esta acción no se puede deshacer.')) return;

    try {
      const res = await fetch('/api/casos', { method: 'DELETE' });
      if (res.ok) {
        loadAdminCases();
      }
    } catch (err) {
      console.error('Error al limpiar base de datos:', err);
    }
  });
}

// --- EXPORTAR A EXCEL GLOBAL ---
if (btnExportExcel) {
  btnExportExcel.addEventListener('click', () => {
    if (adminCases.length === 0) {
      alert('No hay registros para exportar.');
      return;
    }

    const dataFormatted = adminCases.map((c, index) => ({
      "N°": index + 1,
      "Tienda / Sucursal": c.store || 'N/A',
      "Operador CCTV": c.operator || 'Operador',
      "Hora Inicio": c.startTime || '08:00',
      "Hora Fin": c.endTime || '16:00',
      "Tipo de Novedad": c.novelty || 'General',
      "Solución / Observaciones": c.solution || '-',
      "Fecha Registro": c.createdAt ? new Date(c.createdAt).toLocaleString() : ''
    }));

    const workbook = XLSX.utils.book_new();
    const wsDetails = XLSX.utils.json_to_sheet(dataFormatted);
    XLSX.utils.book_append_sheet(workbook, wsDetails, "Novedades CCTV");
    XLSX.writeFile(workbook, `Reporte_Ejecutivo_CCTV_${new Date().toISOString().slice(0,10)}.xlsx`);
  });
}