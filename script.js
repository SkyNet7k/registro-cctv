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
const storeSelect = document.getElementById('storeSelect');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const noveltyTypeSelect = document.getElementById('noveltyType');
const noveltyDetailsInput = document.getElementById('noveltyDetails');
const actionTextInput = document.getElementById('actionText');
const actorsTextInput = document.getElementById('actorsText');

const casesTableBody = document.getElementById('casesTableBody');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const tableCountInfo = document.getElementById('tableCountInfo');

const btnSetNow = document.getElementById('btnSetNow');
const btnSubmitForm = document.getElementById('btnSubmitForm');
const formTitle = document.getElementById('formTitle');
const btnQuickReport = document.getElementById('btnQuickReport');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  populateStoreDropdown();
  setInitialTimes();
  loadCasesFromServer();

  const savedOperator = localStorage.getItem('cctv_operator');
  if (savedOperator) operatorNameInput.value = savedOperator;

  operatorNameInput.addEventListener('change', () => {
    localStorage.setItem('cctv_operator', operatorNameInput.value.trim());
  });
});

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

function setInitialTimes() {
  const now = new Date();
  if (endTimeInput) endTimeInput.value = now.toTimeString().substring(0, 5);
  
  const past = new Date(now.getTime() - 15 * 60000);
  if (startTimeInput) startTimeInput.value = past.toTimeString().substring(0, 5);
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

// Renderizar tabla limpia para el operador
function renderCases() {
  if (!casesTableBody) return;
  
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const filtered = cases.filter(c => 
    (c.store && c.store.toLowerCase().includes(query)) ||
    (c.novelty && c.novelty.toLowerCase().includes(query)) ||
    (c.details && c.details.toLowerCase().includes(query)) ||
    (c.actions && c.actions.toLowerCase().includes(query)) ||
    (c.actors && c.actors.toLowerCase().includes(query)) ||
    (c.operator && c.operator.toLowerCase().includes(query))
  );

  casesTableBody.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
  } else {
    if (emptyState) emptyState.classList.add('hidden');
    
    filtered.forEach(c => {
      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-750/50 transition border-b border-slate-700/40";
      
      tr.innerHTML = `
        <td class="px-4 py-3 align-top">
          <div class="font-medium text-slate-100">${c.store}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">
            <i class="fa-regular fa-clock mr-1"></i>${c.startTime} - ${c.endTime}
          </div>
        </td>
        <td class="px-4 py-3 max-w-xs align-top">
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-1">
            ${c.novelty}
          </span>
          <p class="text-slate-300 text-xs mb-1"><strong>Novedad:</strong> ${c.details}</p>
          <p class="text-slate-400 text-[11px]"><strong>Acciones:</strong> ${c.actions}</p>
        </td>
        <td class="px-4 py-3 text-slate-300 text-xs align-top">
          ${c.actors}
        </td>
      `;
      casesTableBody.appendChild(tr);
    });
  }

  if (tableCountInfo) tableCountInfo.textContent = `Mostrando ${filtered.length} de ${cases.length} registros`;
}

// Guardar Caso
if (caseForm) {
  caseForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const caseData = {
      id: Date.now().toString(),
      operator: operatorNameInput.value.trim(),
      store: storeSelect.value,
      startTime: startTimeInput.value,
      endTime: endTimeInput.value,
      novelty: noveltyTypeSelect.value,
      details: noveltyDetailsInput.value.trim(),
      actions: actionTextInput.value.trim(),
      actors: actorsTextInput.value.trim(),
      // Mantenemos compatibilidad con el panel admin mapeando solution y novelty generales
      solution: `Acciones: ${actionTextInput.value.trim()} | Actuantes: ${actorsTextInput.value.trim()}`
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
  if (savedOperator && operatorNameInput) operatorNameInput.value = savedOperator;
  setInitialTimes();
}

if (searchInput) searchInput.addEventListener('input', renderCases);

// Reporte WhatsApp bajo el formato exacto solicitado
if (btnQuickReport) {
  btnQuickReport.addEventListener('click', () => {
    if (cases.length === 0) return alert('No hay casos registrados en el turno.');

    let text = `🚨 *DPTO. DE SEGURIDAD ELECTRÓNICA*\n===================================\n\n`;

    cases.forEach((c, idx) => {
      text += `*${idx + 1}. Sede: ${c.store}*\n`;
      text += `⏱️ *Horario:* ${c.startTime} a ${c.endTime}\n`;
      text += `📌 *Tipo:* ${c.novelty}\n`;
      text += `📝 *Novedad:* ${c.details}\n`;
      text += `⚙️ *Acciones:* ${c.actions}\n`;
      text += `👤 *Actuante / Involucrados:* ${c.actors}\n\n`;
    });

    text += `===================================\n📊 *Total Novedades en Turno:* ${cases.length}`;

    const phoneNumber = "584126615457";
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`;

    window.open(whatsappUrl, '_blank');
  });
}