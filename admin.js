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

const adminTableBody = document.getElementById('adminTableBody');
const adminEmptyState = document.getElementById('adminEmptyState');
const adminSearchInput = document.getElementById('adminSearchInput');
const adminTableCount = document.getElementById('adminTableCount');
const btnExportExcel = document.getElementById('btnExportExcel');
const btnClearAll = document.getElementById('btnClearAll');

// Modal Elements
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
  populateEditStoreDropdown();
  loadAdminCases();
});

async function loadAdminCases() {
  try {
    const res = await fetch('/api/casos');
    if (res.ok) {
      adminCases = await res.json();
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
          <div class="font-medium text-slate-100">${c.store}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">
            <i class="fa-regular fa-clock mr-1"></i>${c.startTime} - ${c.endTime}
          </div>
        </td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            ${c.novelty}
          </span>
        </td>
        <td class="px-4 py-3 max-w-xs">
          <p class="truncate text-slate-300 text-xs" title="${c.solution}">${c.solution}</p>
        </td>
        <td class="px-4 py-3 text-slate-400 whitespace-nowrap">
          ${c.operator}
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

// --- ACCIONES CRUD ---

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

  editModal.classList.remove('hidden');
};

function closeModal() {
  editModal.classList.add('hidden');
}

if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeModal);

// Guardar edición
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
        closeModal();
        loadAdminCases();
      } else {
        alert('Error al actualizar el caso.');
      }
    } catch (err) {
      console.error('Error en actualización:', err);
    }
  });
}

// Eliminar caso individual
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

// Limpiar todo
if (btnClearAll) {
  btnClearAll.addEventListener('click', async () => {
    if (!confirm('⚠️ ¿ADVERTENCIA! ¿Deseas eliminar TODOS los registros de la base de datos? Esta acción no se puede deshacer.')) return;

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

// --- EXPORTAR A EXCEL (SheetJS) ---
if (btnExportExcel) {
  btnExportExcel.addEventListener('click', () => {
    if (adminCases.length === 0) {
      alert('No hay registros para exportar.');
      return;
    }

    const dataFormatted = adminCases.map((c, index) => ({
      "N°": index + 1,
      "Tienda / Sucursal": c.store,
      "Operador CCTV": c.operator,
      "Hora Inicio": c.startTime,
      "Hora Fin": c.endTime,
      "Tipo de Novedad": c.novelty,
      "Solución / Observaciones": c.solution,
      "Fecha Registro": c.createdAt ? new Date(c.createdAt).toLocaleString() : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataFormatted);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Novedades CCTV");

    // Descargar archivo Excel
    XLSX.writeFile(workbook, `Reporte_CCTV_${new Date().toISOString().slice(0,10)}.xlsx`);
  });
}