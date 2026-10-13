// --- SUCURSALES ORGANIZADAS POR GRUPO ---
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
let editingCaseId = null;

// Referencias DOM
const caseForm = document.getElementById('caseForm');
const operatorNameInput = document.getElementById('operatorName');
const storeSelect = document.getElementById('storeSelect');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const noveltyTypeSelect = document.getElementById('noveltyType');
const solutionTextInput = document.getElementById('solutionText');

const casesTableBody = document.getElementById('casesTableBody');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const tableCountInfo = document.getElementById('tableCountInfo');

const btnSetNow = document.getElementById('btnSetNow');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const btnSubmitForm = document.getElementById('btnSubmitForm');
const formTitle = document.getElementById('formTitle');
const btnClearAll = document.getElementById('btnClearAll');

const btnQuickReport = document.getElementById('btnQuickReport');
const reportModal = document.getElementById('reportModal');
const btnCloseReportModal = document.getElementById('btnCloseReportModal');
const reportTextarea = document.getElementById('reportTextarea');
const btnCopyReport = document.getElementById('btnCopyReport');
const btnExportCsv = document.getElementById('btnExportCsv');

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

// Poblar el menú desplegable con subgrupos (<optgroup>)
function populateStoreDropdown() {
  if (!storeSelect) return;
  storeSelect.innerHTML = '<option value="" disabled selected>Seleccione una sucursal...</option>';
  
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

// Renderizar tabla
function renderCases() {
  if (!casesTableBody) return;
  
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const filtered = cases.filter(c => 
    (c.store && c.store.toLowerCase().includes(query)) ||
    (c.novelty && c.novelty.toLowerCase().includes(query)) ||
    (c.solution && c.solution.toLowerCase().includes(query)) ||
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
        <td class="px-4 py-3">
          <div class="font-medium text-slate-100">${c.store}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">
            <i class="fa-regular fa-clock mr-1"></i>${c.startTime} - ${c.endTime}
          </div>
        </td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            ${c.novelty}
          </span>
        </td>
        <td class="px-4 py-3 max-w-xs">
          <p class="truncate text-slate-300 text-xs" title="${c.solution}">${c.solution}</p>
        </td>
        <td class="px-4 py-3 text-slate-400 whitespace-nowrap">
          ${c.operator}
        </td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <button onclick="editCase('${c.id}')" class="p-1 text-indigo-400 hover:text-indigo-300 mr-2" title="Editar">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button onclick="deleteCase('${c.id}')" class="p-1 text-rose-400 hover:text-rose-300" title="Eliminar">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;
      casesTableBody.appendChild(tr);
    });
  }

  if (tableCountInfo) tableCountInfo.textContent = `Mostrando ${filtered.length} de ${cases.length} registros`;
}

// Guardar / Editar Caso
if (caseForm) {
  caseForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const caseData = {
      id: editingCaseId || Date.now().toString(),
      operator: operatorNameInput.value.trim(),
      store: storeSelect.value,
      startTime: startTimeInput.value,
      endTime: endTimeInput.value,
      novelty: noveltyTypeSelect.value,
      solution: solutionTextInput.value.trim()
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
  editingCaseId = null;
  if (caseForm) caseForm.reset();
  if (formTitle) formTitle.textContent = "Registro de Novedad";
  if (btnSubmitForm) btnSubmitForm.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Caso`;
  if (btnCancelEdit) btnCancelEdit.classList.add('hidden');
  
  const savedOperator = localStorage.getItem('cctv_operator');
  if (savedOperator && operatorNameInput) operatorNameInput.value = savedOperator;
  setInitialTimes();
}

if (btnCancelEdit) btnCancelEdit.addEventListener('click', resetForm);

window.editCase = function(id) {
  const c = cases.find(item => item.id === id);
  if (!c) return;

  editingCaseId = c.id;
  operatorNameInput.value = c.operator;
  storeSelect.value = c.store;
  startTimeInput.value = c.startTime;
  endTimeInput.value = c.endTime;
  noveltyTypeSelect.value = c.novelty;
  solutionTextInput.value = c.solution;

  if (formTitle) formTitle.textContent = "Modificar Registro";
  if (btnSubmitForm) btnSubmitForm.innerHTML = `<i class="fa-solid fa-rotate"></i> Actualizar Caso`;
  if (btnCancelEdit) btnCancelEdit.classList.remove('hidden');
};

window.deleteCase = async function(id) {
  if (confirm('¿Deseas eliminar este registro?')) {
    try {
      const res = await fetch(`/api/casos/${id}`, { method: 'DELETE' });
      if (res.ok) await loadCasesFromServer();
    } catch (err) {
      console.error('Error al eliminar caso:', err);
    }
  }
};

if (btnClearAll) {
  btnClearAll.addEventListener('click', async () => {
    if (cases.length === 0) return;
    if (confirm('¿Estás seguro de borrar todos los registros del turno?')) {
      try {
        const res = await fetch('/api/casos', { method: 'DELETE' });
        if (res.ok) await loadCasesFromServer();
      } catch (err) {
        console.error('Error al limpiar registros:', err);
      }
    }
  });
}

if (searchInput) searchInput.addEventListener('input', renderCases);

// Exportar CSV / Excel
if (btnExportCsv) {
  btnExportCsv.addEventListener('click', () => {
    if (cases.length === 0) return alert('No hay datos para exportar.');

    const headers = ['Operador', 'Tienda', 'Hora Inicio', 'Hora Fin', 'Tipo Novedad', 'Solucion'];
    const rows = cases.map(c => [
      `"${c.operator || ''}"`,
      `"${c.store || ''}"`,
      `"${c.startTime || ''}"`,
      `"${c.endTime || ''}"`,
      `"${c.novelty || ''}"`,
      `"${(c.solution || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_CCTV_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

// Reporte WhatsApp (Abre chat directo al número +58 412-6615457)
if (btnQuickReport) {
  btnQuickReport.addEventListener('click', () => {
    if (cases.length === 0) return alert('No hay casos registrados en el turno.');

    let text = `🚨 *REPORTE NOVEDADES CCTV*\n-----------------------------------\n\n`;

    cases.forEach((c, idx) => {
      text += `*${idx + 1}. ${c.store}*\n`;
      text += `⏱️ *Hora:* ${c.startTime} a ${c.endTime}\n`;
      text += `📌 *Tipo:* ${c.novelty}\n`;
      text += `📝 *Solución:* ${c.solution}\n`;
      text += `👤 *Operador:* ${c.operator}\n\n`;
    });

    text += `-----------------------------------\n📊 *Total Novedades:* ${cases.length}`;

    const phoneNumber = "584126615457";
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`;

    window.open(whatsappUrl, '_blank');
  });
}

if (btnCloseReportModal) {
  btnCloseReportModal.addEventListener('click', () => {
    if (reportModal) reportModal.classList.add('hidden');
  });
}

if (btnCopyReport) {
  btnCopyReport.addEventListener('click', () => {
    if (!reportTextarea) return;
    reportTextarea.select();
    navigator.clipboard.writeText(reportTextarea.value).then(() => {
      btnCopyReport.innerHTML = `<i class="fa-solid fa-check"></i> ¡Copiado!`;
      setTimeout(() => {
        btnCopyReport.innerHTML = `<i class="fa-solid fa-copy"></i> Copiar al Portapapeles`;
      }, 2000);
    });
  });
}