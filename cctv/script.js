let cases = JSON.parse(localStorage.getItem('cctv_cases')) || [];
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
  setInitialTimes();
  renderCases();

  const savedOperator = localStorage.getItem('cctv_operator');
  if (savedOperator) operatorNameInput.value = savedOperator;

  operatorNameInput.addEventListener('change', () => {
    localStorage.setItem('cctv_operator', operatorNameInput.value.trim());
  });
});

function setInitialTimes() {
  const now = new Date();
  endTimeInput.value = now.toTimeString().substring(0, 5);
  
  const past = new Date(now.getTime() - 15 * 60000);
  startTimeInput.value = past.toTimeString().substring(0, 5);
}

btnSetNow.addEventListener('click', () => {
  const now = new Date();
  endTimeInput.value = now.toTimeString().substring(0, 5);
});

// Renderizar tabla
function renderCases() {
  const query = searchInput.value.toLowerCase().trim();
  const filtered = cases.filter(c => 
    c.store.toLowerCase().includes(query) ||
    c.novelty.toLowerCase().includes(query) ||
    c.solution.toLowerCase().includes(query) ||
    c.operator.toLowerCase().includes(query)
  );

  casesTableBody.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    
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

  tableCountInfo.textContent = `Mostrando ${filtered.length} de ${cases.length} registros`;
}

// Guardar / Editar Caso
caseForm.addEventListener('submit', (e) => {
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

  if (editingCaseId) {
    const index = cases.findIndex(c => c.id === editingCaseId);
    if (index !== -1) cases[index] = caseData;
  } else {
    cases.unshift(caseData);
  }

  localStorage.setItem('cctv_cases', JSON.stringify(cases));
  resetForm();
  renderCases();
});

function resetForm() {
  editingCaseId = null;
  caseForm.reset();
  formTitle.textContent = "Registro de Novedad";
  btnSubmitForm.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Caso`;
  btnCancelEdit.classList.add('hidden');
  
  const savedOperator = localStorage.getItem('cctv_operator');
  if (savedOperator) operatorNameInput.value = savedOperator;
  setInitialTimes();
}

btnCancelEdit.addEventListener('click', resetForm);

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

  formTitle.textContent = "Modificar Registro";
  btnSubmitForm.innerHTML = `<i class="fa-solid fa-rotate"></i> Actualizar Caso`;
  btnCancelEdit.classList.remove('hidden');
};

window.deleteCase = function(id) {
  if (confirm('¿Deseas eliminar este registro?')) {
    cases = cases.filter(c => c.id !== id);
    localStorage.setItem('cctv_cases', JSON.stringify(cases));
    renderCases();
  }
};

btnClearAll.addEventListener('click', () => {
  if (cases.length === 0) return;
  if (confirm('¿Estás seguro de borrar todos los registros del turno?')) {
    cases = [];
    localStorage.removeItem('cctv_cases');
    renderCases();
  }
});

searchInput.addEventListener('input', renderCases);

// Exportar CSV / Excel
btnExportCsv.addEventListener('click', () => {
  if (cases.length === 0) return alert('No hay datos para exportar.');

  const headers = ['Operador', 'Tienda', 'Hora Inicio', 'Hora Fin', 'Tipo Novedad', 'Solucion'];
  const rows = cases.map(c => [
    `"${c.operator}"`,
    `"${c.store}"`,
    `"${c.startTime}"`,
    `"${c.endTime}"`,
    `"${c.novelty}"`,
    `"${c.solution.replace(/"/g, '""')}"`
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

// Reporte WhatsApp
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

  reportTextarea.value = text;
  reportModal.classList.remove('hidden');
});

btnCloseReportModal.addEventListener('click', () => reportModal.classList.add('hidden'));

btnCopyReport.addEventListener('click', () => {
  reportTextarea.select();
  navigator.clipboard.writeText(reportTextarea.value).then(() => {
    btnCopyReport.innerHTML = `<i class="fa-solid fa-check"></i> ¡Copiado!`;
    setTimeout(() => {
      btnCopyReport.innerHTML = `<i class="fa-solid fa-copy"></i> Copiar al Portapapeles`;
    }, 2000);
  });
});