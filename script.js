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

let cases = [];

// Referencias DOM
const caseForm = document.getElementById('caseForm');
const operatorNameInput = document.getElementById('operatorName');
const displayOperator = document.getElementById('displayOperator');
const storeSelect = document.getElementById('storeSelect');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const caseDateInput = document.getElementById('caseDate'); // Referencia al campo de fecha
const noveltyTypeSelect = document.getElementById('noveltyType');
const noveltyDetailsInput = document.getElementById('noveltyDetails');
const solutionTextInput = document.getElementById('solutionText');
const actionTextInput = document.getElementById('actionText');
const actorsTextInput = document.getElementById('actorsText');

const casesTableBody = document.getElementById('casesTableBody');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const tableCountInfo = document.getElementById('tableCountInfo');

const btnSetNow = document.getElementById('btnSetNow');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  populateStoreDropdown();
  setInitialTimesAndDate();
  loadCasesFromServer();

  const savedOperator = localStorage.getItem('cctv_operator');
  if (savedOperator) {
    operatorNameInput.value = savedOperator;
    updateOperatorDisplay(savedOperator);
  }

  operatorNameInput.addEventListener('input', () => {
    const name = operatorNameInput.value.trim();
    localStorage.setItem('cctv_operator', name);
    updateOperatorDisplay(name);
  });
});

function updateOperatorDisplay(name) {
  if (displayOperator) {
    displayOperator.textContent = name ? `Op: ${name}` : 'Operador: No asignado';
  }
}

function populateStoreDropdown() {
  if (!storeSelect) return;
  storeSelect.innerHTML = '<option value="" disabled selected>Seleccione sede...</option>';
  
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

function setInitialTimesAndDate() {
  const now = new Date();
  if (endTimeInput) endTimeInput.value = now.toTimeString().substring(0, 5);
  
  const past = new Date(now.getTime() - 15 * 60000);
  if (startTimeInput) startTimeInput.value = past.toTimeString().substring(0, 5);

  // Inicializar el campo de fecha con el día actual del sistema (YYYY-MM-DD)
  if (caseDateInput) {
    caseDateInput.value = now.toISOString().slice(0, 10);
  }
}

if (btnSetNow) {
  btnSetNow.addEventListener('click', () => {
    const now = new Date();
    endTimeInput.value = now.toTimeString().substring(0, 5);
  });
}

// --- API CONEXIÓN A NODE.JS SERVER ---
async function loadCasesFromServer() {
  try {
    const res = await fetch('/api/casos');
    if (res.ok) {
      cases = await res.json();
      renderCases();
    }
  } catch (err) {
    console.error('Error conectando con el servidor:', err);
  }
}

// Renderizar tabla con fecha extraída de la DB y botón de WhatsApp individual
function renderCases() {
  if (!casesTableBody) return;
  
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const filtered = cases.filter(c => {
    const store = c.store || '';
    const novelty = c.novelty || '';
    const details = c.details || '';
    const solution = c.solution || '';
    const actions = c.actions || '';
    const actors = c.actors || '';
    const operator = c.operator || '';

    return store.toLowerCase().includes(query) ||
           novelty.toLowerCase().includes(query) ||
           details.toLowerCase().includes(query) ||
           solution.toLowerCase().includes(query) ||
           actions.toLowerCase().includes(query) ||
           actors.toLowerCase().includes(query) ||
           operator.toLowerCase().includes(query);
  });

  casesTableBody.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
  } else {
    if (emptyState) emptyState.classList.add('hidden');
    
    filtered.forEach(c => {
      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-750/50 transition border-b border-slate-700/40";
      
      const detailsText = c.details ? c.details : 'Sin detalle registrado';
      const solutionText = c.solution ? c.solution : 'N/A';
      const actionsText = c.actions ? c.actions : 'N/A';
      const actorsText = c.actors ? c.actors : '-';

      // Formatear la fecha guardada en la base de datos
      const fechaReporte = c.createdAt ? new Date(c.createdAt).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC'
      }) : 'Fecha s/n';

      tr.innerHTML = `
        <td class="px-4 py-3 align-top">
          <div class="font-medium text-slate-100">${c.store}</div>
          <div class="text-[10px] text-purple-400 mt-0.5">
            <i class="fa-solid fa-calendar-days mr-1"></i>${fechaReporte}
          </div>
          <div class="text-[10px] text-slate-400 mt-0.5">
            <i class="fa-regular fa-clock mr-1"></i>${c.startTime} - ${c.endTime}
          </div>
        </td>
        <td class="px-4 py-3 max-w-xs align-top">
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-1">
            ${c.novelty || 'General'}
          </span>
          <p class="text-slate-300 text-xs mb-1"><strong>Novedad:</strong> ${detailsText}</p>
          <p class="text-slate-300 text-xs mb-1"><strong>Soluciones:</strong> ${solutionText}</p>
          <p class="text-slate-400 text-[11px]"><strong>Acciones:</strong> ${actionsText}</p>
        </td>
        <td class="px-4 py-3 text-slate-300 text-xs align-top">
          ${actorsText}
        </td>
        <td class="px-4 py-3 text-right align-top">
          <button onclick="enviarReporteIndividual('${c.id}')" class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow transition" title="Enviar este reporte por WhatsApp">
            <i class="fa-brands fa-whatsapp"></i>
            <span>Enviar</span>
          </button>
        </td>
      `;
      casesTableBody.appendChild(tr);
    });
  }

  if (tableCountInfo) tableCountInfo.textContent = `Mostrando ${filtered.length} de ${cases.length} registros`;

  // Forzar scroll arriba para visualizar inmediatamente el registro recién guardado
  const containerTable = casesTableBody.closest('.overflow-x-auto');
  if (containerTable) {
    containerTable.scrollTop = 0;
  }
}

// Guardar Caso con la fecha personalizada elegida
if (caseForm) {
  caseForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedDate = caseDateInput ? caseDateInput.value : new Date().toISOString().slice(0, 10);
    const nowTime = new Date();
    const fullIsoDate = new Date(`${selectedDate}T${String(nowTime.getHours()).padStart(2, '0')}:${String(nowTime.getMinutes()).padStart(2, '0')}:${String(nowTime.getSeconds()).padStart(2, '0')}`).toISOString();

    const caseData = {
      id: Date.now().toString(),
      operator: operatorNameInput.value.trim(),
      store: storeSelect.value,
      startTime: startTimeInput.value,
      endTime: endTimeInput.value,
      novelty: noveltyTypeSelect.value,
      details: noveltyDetailsInput.value.trim(),
      solution: solutionTextInput.value.trim(),
      actions: actionTextInput.value.trim(),
      actors: actorsTextInput.value.trim(),
      createdAt: fullIsoDate // Fecha elegida por el operador
    };

    try {
      const res = await fetch('/api/casos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(caseData)
      });

      if (res.ok) {
        await loadCasesFromServer();
        resetForm();
      }
    } catch (err) {
      console.error('Error al guardar el caso:', err);
    }
  });
}

function resetForm() {
  if (caseForm) caseForm.reset();
  const savedOperator = localStorage.getItem('cctv_operator');
  if (savedOperator && operatorNameInput) {
    operatorNameInput.value = savedOperator;
    updateOperatorDisplay(savedOperator);
  }
  setInitialTimesAndDate();
}

if (searchInput) searchInput.addEventListener('input', renderCases);

// Función exclusiva para enviar únicamente el reporte seleccionado por ID
function enviarReporteIndividual(id) {
  const c = cases.find(item => item.id === id);
  if (!c) return alert('No se encontró el registro seleccionado.');

  const detailsText = c.details ? c.details : 'Sin detalle registrado';
  const solutionText = c.solution ? c.solution : 'N/A';
  const actionsText = c.actions ? c.actions : 'N/A';
  const actorsText = c.actors ? c.actors : '-';

  const fechaReporte = c.createdAt ? new Date(c.createdAt).toLocaleDateString('es-ES', { timeZone: 'UTC' }) : '';

  let text = `🔒 *DPTO. DE SEGURIDAD ELECTRÓNICA*\n===================================\n\n`;
  if (fechaReporte) text += `📅 *Fecha:* ${fechaReporte}\n`;
  text += `*Sede:* ${c.store}\n`;
  text += `⏰ *Horario:* ${c.startTime} a ${c.endTime}\n`;
  text += `📌 *Tipo:* ${c.novelty || 'General'}\n`;
  text += `📝 *Novedad:* ${detailsText}\n`;
  text += `💡 *Soluciones:* ${solutionText}\n`;
  text += `⚙️ *Acciones:* ${actionsText}\n`;
  text += `👤 *Actuante / Involucrados:* ${actorsText}`;

  const phoneNumber = "584126615457";
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`;

  window.open(whatsappUrl, '_blank');
}