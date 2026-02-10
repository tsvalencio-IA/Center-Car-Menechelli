/* ==================================================================
   DASHBOARD CENTER CAR MENECHELLI - V4.4 (BUSCA ENTREGUE)
   Desenvolvido por: thIAguinho Soluções
   ================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyDFbvRiLpUcXFJgVSwNobXi0fX_IceBK5k",
  authDomain: "centercarmenechelli-47e05.firebaseapp.com",
  databaseURL: "https://centercarmenechelli-47e05-default-rtdb.firebaseio.com",
  projectId: "centercarmenechelli-47e05",
  storageBucket: "centercarmenechelli-47e05.firebasestorage.app",
  messagingSenderId: "697435506647",
  appId: "1:697435506647:web:dce5cbf910f4960f732d92"
};

// ESTADO GLOBAL
let activeCloudinaryConfig = null;
let currentUser = null;
let allServiceOrders = {};
let allUsers = [];
let lightboxMedia = [];
let currentLightboxIndex = 0;
let filesToUpload = [];
const SESSION_KEY = 'centerCarSession';

const STATUS_LIST = [ 
    'Aguardando-Mecanico', 'Em-Analise', 'Orcamento-Enviado', 
    'Aguardando-Aprovacao', 'Servico-Autorizado', 'Em-Execucao', 
    'Finalizado-Aguardando-Retirada', 'Entregue' 
];

// --- NOTIFICAÇÕES ---
function showNotification(message, type = 'success') {
  const div = document.createElement('div');
  div.className = `notification ${type}`;
  div.innerHTML = `<i class='bx ${type === 'success' ? 'bx-check-circle' : 'bx-error-circle'} text-xl'></i> <span class="font-bold text-sm">${message}</span>`;
  document.body.appendChild(div);
  requestAnimationFrame(() => div.classList.add('show'));
  setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 300); }, 4000);
}

// --- CLOUDINARY ---
const uploadFileToCloudinary = async (file) => {
  if (!activeCloudinaryConfig) throw new Error('Mídia não configurada no Admin.');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', activeCloudinaryConfig.uploadPreset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${activeCloudinaryConfig.cloudName}/auto/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Erro ao enviar imagem.');
  const data = await res.json();
  return { url: data.secure_url, type: data.resource_type };
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
  try { firebase.initializeApp(firebaseConfig); } catch(e) { console.error(e); }
  const db = firebase.database();

  // 1. CARREGAR CONFIGS
  db.ref('cloudinaryConfigs').limitToLast(1).on('value', snap => {
      const val = snap.val();
      if(val) activeCloudinaryConfig = Object.values(val)[0];
  });

  // 2. CARREGAR USUÁRIOS
  db.ref('users').on('value', snap => {
      const data = snap.val();
      const select = document.getElementById('userSelect');
      if(!select) return;
      
      allUsers = [];
      select.innerHTML = '<option value="">Selecione...</option>';
      if (data) {
          Object.entries(data).forEach(([key, user]) => {
              allUsers.push({...user, id: key});
              const opt = document.createElement('option');
              opt.value = JSON.stringify({id: key, name: user.name, role: user.role || 'Colaborador', password: user.password});
              opt.textContent = user.name;
              select.appendChild(opt);
          });
      }
      renderAdminUserList();
      if (!currentUser) checkSession();
  });

  // 3. SESSÃO E LOGIN
  const checkSession = () => {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) return;
      try {
          const session = JSON.parse(stored);
          const now = new Date();
          const cutoff = new Date();
          cutoff.setHours(19, 0, 0, 0); 
          
          if (now > cutoff && new Date(session.loginTime) < cutoff) {
              localStorage.removeItem(SESSION_KEY);
              showNotification("Sessão expirada (fechamento diário).", "error");
              return;
          }
          performLogin(session.user);
      } catch (e) { localStorage.removeItem(SESSION_KEY); }
  };

  const performLogin = (user) => {
      currentUser = user;
      document.getElementById('userScreen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      document.getElementById('app').classList.add('flex');
      document.getElementById('currentUserName').textContent = user.name.split(' ')[0];
      document.getElementById('currentUserRole').textContent = user.role;
      
      const isManager = user.role === 'Gestor' || (user.name && user.name.includes('Thiago'));
      
      const desktopActions = document.getElementById('desktopAdminActions');
      const mobileAdmin = document.getElementById('adminBtnMobile');
      const mobileReports = document.getElementById('reportsBtnMobile');
      const adminZone = document.getElementById('adminZone');

      if (isManager) {
          if(desktopActions) { desktopActions.classList.remove('hidden'); desktopActions.classList.add('md:flex'); }
          if(mobileAdmin) mobileAdmin.classList.remove('hidden');
          if(mobileReports) mobileReports.classList.remove('hidden');
          if(adminZone) adminZone.classList.remove('hidden');
      } else {
          if(desktopActions) { desktopActions.classList.add('hidden'); desktopActions.classList.remove('md:flex'); }
          if(mobileAdmin) mobileAdmin.classList.add('hidden');
          if(mobileReports) mobileReports.classList.add('hidden');
          if(adminZone) adminZone.classList.add('hidden');
      }

      initKanban();
      listenOS();
  };

  const loginForm = document.getElementById('loginForm');
  if(loginForm) {
      loginForm.onsubmit = (e) => {
          e.preventDefault();
          const selectVal = document.getElementById('userSelect').value;
          const pass = document.getElementById('passwordInput').value;
          if(!selectVal) { document.getElementById('loginError').textContent = "Selecione um usuário."; return; }
          
          const user = JSON.parse(selectVal);
          if (user.password === pass) {
              localStorage.setItem(SESSION_KEY, JSON.stringify({ user: user, loginTime: new Date().toISOString() }));
              performLogin(user);
          } else {
              document.getElementById('loginError').textContent = "SENHA INCORRETA";
          }
      };
  }

  document.getElementById('logoutButton').onclick = () => { localStorage.removeItem(SESSION_KEY); location.reload(); };

  // --- MENU USUÁRIO & ADMIN TABS ---
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userDropdown = document.getElementById('userDropdown');
  if(userMenuBtn) userMenuBtn.onclick = (e) => { e.stopPropagation(); userDropdown.classList.toggle('hidden'); };
  document.addEventListener('click', (e) => {
      if (userDropdown && !userDropdown.classList.contains('hidden')) {
          if (!userDropdown.contains(e.target) && e.target !== userMenuBtn) userDropdown.classList.add('hidden');
      }
  });

  const toggleModal = (id) => {
      const el = document.getElementById(id);
      if(el) { el.classList.remove('hidden'); el.classList.add('flex'); }
      if(userDropdown) userDropdown.classList.add('hidden');
  };

  const adminBtn = document.getElementById('adminBtn');
  const adminBtnMobile = document.getElementById('adminBtnMobile');
  if(adminBtn) adminBtn.onclick = () => toggleModal('adminModal');
  if(adminBtnMobile) adminBtnMobile.onclick = () => toggleModal('adminModal');

  const reportsBtn = document.getElementById('reportsBtn');
  const reportsBtnMobile = document.getElementById('reportsBtnMobile');
  if(reportsBtn) reportsBtn.onclick = () => toggleModal('reportsModal');
  if(reportsBtnMobile) reportsBtnMobile.onclick = () => toggleModal('reportsModal');

  // ABAS DO ADMIN
  document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.onclick = () => {
          document.querySelectorAll('.admin-tab').forEach(t => {
              t.classList.remove('active', 'border-blue-600', 'text-blue-600', 'bg-blue-50/30');
              t.classList.add('text-gray-500');
          });
          tab.classList.add('active', 'border-blue-600', 'text-blue-600', 'bg-blue-50/30');
          tab.classList.remove('text-gray-500');
          document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
          document.getElementById(tab.dataset.target).classList.remove('hidden');
      };
  });

  // --- LÓGICA ADMIN (USUÁRIOS E CLOUD) ---
  const renderAdminUserList = () => {
      const list = document.getElementById('usersList');
      if(!list) return;
      list.innerHTML = allUsers.map(u => `
          <div class="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
              <div><p class="font-bold text-gray-800 text-sm">${u.name}</p><p class="text-xs text-gray-500">${u.role} | Senha: ${u.password}</p></div>
              ${u.name.includes('Thiago') ? '<span class="text-xs font-bold text-blue-600">MASTER</span>' : `<button onclick="window.removeUser('${u.id}')" class="text-red-500 p-2"><i class='bx bxs-trash'></i></button>`}
          </div>
      `).join('');
  };

  window.removeUser = (id) => { if(confirm('Remover usuário?')) db.ref(`users/${id}`).remove(); };

  document.getElementById('addUserForm').onsubmit = (e) => {
      e.preventDefault();
      db.ref('users').push({
          name: document.getElementById('newUserName').value,
          role: document.getElementById('newUserRole').value,
          password: document.getElementById('newUserPass').value
      });
      e.target.reset(); showNotification('Usuário Adicionado!');
  };

  document.getElementById('cloudinaryForm').onsubmit = (e) => {
      e.preventDefault();
      db.ref('cloudinaryConfigs').push({
          cloudName: document.getElementById('cloudNameInput').value,
          uploadPreset: document.getElementById('uploadPresetInput').value,
          updatedBy: currentUser.name,
          timestamp: new Date().toISOString()
      });
      showNotification('Configuração Cloudinary Salva!');
  };

  // --- LÓGICA RELATÓRIOS ---
  document.getElementById('reportsForm').onsubmit = (e) => {
      e.preventDefault();
      const start = new Date(document.getElementById('startDate').value);
      const end = new Date(document.getElementById('endDate').value);
      end.setHours(23, 59, 59);

      const filtered = Object.values(allServiceOrders).filter(os => {
          if(os.status !== 'Entregue') return false;
          const date = new Date(os.lastUpdate || os.createdAt);
          return date >= start && date <= end;
      });

      const container = document.getElementById('reportsResultContainer');
      const exportBtn = document.getElementById('exportReportBtn');
      
      if(filtered.length === 0) {
          container.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhum veículo entregue no período.</p>';
          exportBtn.classList.add('hidden');
          return;
      }

      let total = 0;
      const html = `<table class="w-full text-sm text-left"><thead class="bg-gray-100"><tr><th class="p-2">Data</th><th class="p-2">Placa</th><th class="p-2">Cliente</th></tr></thead><tbody>
          ${filtered.map(os => {
              total++;
              return `<tr class="border-b"><td class="p-2">${new Date(os.lastUpdate).toLocaleDateString()}</td><td class="p-2 font-bold">${os.placa}</td><td class="p-2">${os.cliente}</td></tr>`;
          }).join('')}
      </tbody></table><div class="mt-4 font-bold text-right">Total: ${total} Veículos</div>`;
      
      container.innerHTML = html;
      exportBtn.classList.remove('hidden');
      
      exportBtn.onclick = () => {
          const win = window.open('', '', 'width=800,height=600');
          win.document.write(`<html><head><title>Relatório</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f2f2f2}</style></head><body><h2>Relatório de Entregas</h2><p>Período: ${start.toLocaleDateString()} a ${end.toLocaleDateString()}</p>${html}<script>window.print()</script></body></html>`);
          win.document.close();
      };
  };

  // --- KANBAN (ATUALIZADO COM BUSCA EM ENTREGUE) ---
  const initKanban = () => {
      const board = document.getElementById('kanbanBoard');
      if(!board) return;
      board.innerHTML = STATUS_LIST.map(status => {
          // FEATURE: Input de busca específico para a coluna Entregue
          if (status === 'Entregue') {
              return `
                <div class="status-column">
                    <div class="column-header" style="display:block;">
                        <div class="flex justify-between items-center mb-1">
                            <span>${status.replace(/-/g, ' ')}</span>
                            <span class="bg-white/50 px-2 py-0.5 rounded text-[10px] border border-slate-300" id="count-${status}">0</span>
                        </div>
                        <input type="text" id="search-entregue-input" placeholder="Buscar Placa..." onkeyup="window.filterEntregue(this.value)" 
                               class="w-full p-1.5 text-[11px] rounded border border-slate-300 text-slate-700 bg-white/80 focus:bg-white outline-none focus:ring-1 focus:ring-blue-500 uppercase font-bold placeholder:font-normal placeholder:text-slate-400">
                    </div>
                    <div class="vehicle-list" id="col-${status}"></div>
                </div>`;
          }

          return `
            <div class="status-column">
                <div class="column-header">
                    <span>${status.replace(/-/g, ' ')}</span>
                    <span class="bg-white/50 px-2 py-0.5 rounded text-[10px] border border-slate-300" id="count-${status}">0</span>
                </div>
                <div class="vehicle-list" id="col-${status}"></div>
            </div>
          `;
      }).join('');
  };

  // FEATURE: Função de filtro para coluna Entregue
  window.filterEntregue = (term) => {
      const col = document.getElementById('col-Entregue');
      if(!col) return;
      const termUpper = term.toUpperCase();
      Array.from(col.children).forEach(card => {
          if(card.innerText.toUpperCase().includes(termUpper)) {
              card.classList.remove('hidden');
          } else {
              card.classList.add('hidden');
          }
      });
  };

  const listenOS = () => {
      db.ref('serviceOrders').on('value', snap => {
          const data = snap.val() || {};
          allServiceOrders = data;
          STATUS_LIST.forEach(s => {
              const col = document.getElementById(`col-${s}`);
              const count = document.getElementById(`count-${s}`);
              if(col) col.innerHTML = '';
              if(count) count.innerText = '0';
          });
          Object.entries(data).forEach(([id, os]) => {
              if(!os.status) return; os.id = id;
              const col = document.getElementById(`col-${os.status}`);
              if(col) col.innerHTML += createCard(os);
          });
          STATUS_LIST.forEach(s => {
              const col = document.getElementById(`col-${s}`);
              const count = document.getElementById(`count-${s}`);
              if(col) count.innerText = col.children.length;
          });
          
          // FEATURE: Re-aplica filtro de entregue se houver busca ativa após atualização do banco
          const searchInput = document.getElementById('search-entregue-input');
          if (searchInput && searchInput.value) {
              window.filterEntregue(searchInput.value);
          }

          updateAlerts();
          
          // Refresh modal se aberto
          const modal = document.getElementById('detailsModal');
          const logId = document.getElementById('logOsId').value;
          if(modal && !modal.classList.contains('hidden') && logId && allServiceOrders[logId]) {
              if(!document.querySelector('.editing-field')) refreshDetailsView(allServiceOrders[logId]);
              renderTimeline(allServiceOrders[logId]);
              renderGallery(allServiceOrders[logId]);
          }
      });
  };

  const createCard = (os) => {
      const placa = os.placa || '---';
      const modelo = os.modelo || '---';
      const cliente = os.cliente || '---';
      const km = os.km ? os.km + ' km' : '';
      
      let prioDot = '';
      if(os.priority === 'verde') prioDot = '<span class="priority-dot bg-prio-verde"></span>';
      if(os.priority === 'amarelo') prioDot = '<span class="priority-dot bg-prio-amarelo"></span>';
      if(os.priority === 'vermelho') prioDot = '<span class="priority-dot bg-prio-vermelho"></span>';

      const idx = STATUS_LIST.indexOf(os.status);
      const hasPrev = idx > 0;
      const hasNext = idx < STATUS_LIST.length - 1;

      const btnPrev = hasPrev ? `<button onclick="event.stopPropagation(); window.quickMove('${os.id}', 'prev')" class="text-slate-400 hover:text-blue-600 p-1"><i class='bx bx-chevron-left text-xl'></i></button>` : `<div class="w-7"></div>`;
      const btnNext = hasNext ? `<button onclick="event.stopPropagation(); window.quickMove('${os.id}', 'next')" class="text-slate-400 hover:text-blue-600 p-1"><i class='bx bx-chevron-right text-xl'></i></button>` : `<div class="w-7"></div>`;

      return `
      <div class="vehicle-card status-${os.status}" onclick="window.openDetails('${os.id}')">
          <div class="flex justify-between items-start mb-1">
              <div class="font-black text-slate-800 text-lg leading-none">${prioDot} ${placa}</div>
              ${os.priority === 'vermelho' ? '<i class="bx bxs-hot text-red-500 animate-pulse"></i>' : ''}
          </div>
          <div class="text-xs font-bold text-blue-700 uppercase mb-2 truncate">${modelo}</div>
          <div class="border-t border-dashed border-gray-200 pt-2 flex justify-between items-center text-[10px] text-gray-500 font-medium">
             <span class="flex items-center gap-1 truncate max-w-[60%]"><i class='bx bxs-user'></i> ${cliente.split(' ')[0]}</span>
             <span>${km}</span>
          </div>
          <div class="flex justify-between items-center mt-2 pt-1 border-t border-gray-100">
              ${btnPrev}
              <span class="text-[9px] text-gray-300 uppercase font-bold tracking-wider">Mover</span>
              ${btnNext}
          </div>
      </div>`;
  };

  // --- MOVIMENTAÇÃO RÁPIDA ---
  window.quickMove = (osId, dir) => {
      const os = allServiceOrders[osId];
      if(!os) return;
      const idx = STATUS_LIST.indexOf(os.status);
      let newStatus = null;
      if(dir === 'next' && idx < STATUS_LIST.length - 1) newStatus = STATUS_LIST[idx + 1];
      if(dir === 'prev' && idx > 0) newStatus = STATUS_LIST[idx - 1];
      
      if(newStatus) {
          const updates = { status: newStatus, lastUpdate: new Date().toISOString() };
          if (newStatus === 'Em-Analise') updates.responsibleForBudget = currentUser.name;
          else if (newStatus === 'Em-Execucao') updates.responsibleForService = currentUser.name;
          else if (newStatus === 'Entregue') updates.responsibleForDelivery = currentUser.name;
          
          db.ref(`serviceOrders/${osId}`).update(updates);
          db.ref(`serviceOrders/${osId}/logs`).push({
              user: currentUser.name, timestamp: new Date().toISOString(),
              description: `Status (Rápido): ${os.status} ➔ ${newStatus}`, type: 'status'
          });
          showNotification('Status atualizado!');
      }
  };

  // --- DETALHES ---
  window.openDetails = (id) => {
      const os = allServiceOrders[id];
      if(!os) return;
      
      document.getElementById('logOsId').value = id;
      document.getElementById('logForm').reset();
      const fn = document.getElementById('fileName'); if(fn) fn.innerText = '';
      filesToUpload = [];
      document.getElementById('post-log-actions').classList.add('hidden');
      
      refreshDetailsView(os);
      renderTimeline(os);
      renderGallery(os);
      
      const delBtn = document.getElementById('deleteOsBtn');
      if(delBtn) {
          delBtn.onclick = () => {
              document.getElementById('confirmDeleteText').innerHTML = `Apagar <strong>${os.placa}</strong>?`;
              const confirmBtn = document.getElementById('confirmDeleteBtn');
              
              confirmBtn.onclick = async () => {
                  await db.ref(`serviceOrders/${id}`).remove();
                  
                  // Força fechamento dos dois modais
                  const modalConfirm = document.getElementById('confirmDeleteModal');
                  modalConfirm.classList.add('hidden');
                  modalConfirm.classList.remove('flex');

                  const modalDetails = document.getElementById('detailsModal');
                  modalDetails.classList.add('hidden');
                  modalDetails.classList.remove('flex');
                  
                  showNotification('Excluído com sucesso.');
              };
              
              const modal = document.getElementById('confirmDeleteModal');
              modal.classList.remove('hidden'); modal.classList.add('flex');
          };
      }

      const exportBtn = document.getElementById('exportOsBtn');
      if(exportBtn) exportBtn.onclick = () => printOS(os);
      
      const modal = document.getElementById('detailsModal');
      modal.classList.remove('hidden'); modal.classList.add('flex');
  };

  const refreshDetailsView = (os) => {
      const isManager = currentUser && (currentUser.role === 'Gestor' || (currentUser.name && currentUser.name.includes('Thiago')));
      const editable = (field, value, label) => {
          if (!isManager) return `<span class="font-bold text-slate-700">${value || '-'}</span>`;
          return `
            <div class="flex items-center gap-2 group">
                <span id="view-${field}" class="font-bold text-slate-700">${value || '-'}</span>
                <i class='bx bx-edit-alt text-gray-400 hover:text-blue-600 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity' onclick="window.toggleEdit('${field}', '${os.id}')"></i>
                <div id="edit-${field}" class="hidden flex gap-1 items-center">
                    <input type="text" id="input-${field}" value="${value || ''}" class="p-1 text-sm border rounded w-full">
                    <button onclick="window.saveEdit('${field}', '${os.id}')" class="text-green-600 p-1"><i class='bx bx-check'></i></button>
                    <button onclick="window.cancelEdit('${field}')" class="text-red-500 p-1"><i class='bx bx-x'></i></button>
                </div>
            </div>`;
      };

      document.getElementById('modalTitlePlaca').innerHTML = isManager ? 
          `<div class="flex items-center gap-2">${os.placa} <i class='bx bx-edit text-sm text-gray-300 hover:text-gray-500 cursor-pointer' onclick="window.toggleEdit('placa', '${os.id}', true)"></i></div>` : os.placa;
      document.getElementById('modalTitleModelo').textContent = `${os.modelo} • ${os.cliente}`;

      document.getElementById('detailsInfoContent').innerHTML = `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div class="bg-gray-50 p-3 rounded border border-gray-100"><p class="text-xs text-slate-400 uppercase font-bold mb-1">Cliente</p>${editable('cliente', os.cliente)}</div>
              <div class="bg-gray-50 p-3 rounded border border-gray-100"><p class="text-xs text-slate-400 uppercase font-bold mb-1">Telefone</p>${editable('telefone', os.telefone)}</div>
              <div class="bg-gray-50 p-3 rounded border border-gray-100"><p class="text-xs text-slate-400 uppercase font-bold mb-1">Modelo</p>${editable('modelo', os.modelo)}</div>
              <div class="bg-gray-50 p-3 rounded border border-gray-100"><p class="text-xs text-slate-400 uppercase font-bold mb-1">Consultor</p><p class="font-bold text-slate-700">${os.responsible || '-'}</p></div>
          </div>
          <div class="bg-blue-50 p-3 rounded border border-blue-100 flex items-center justify-between mb-4">
              <div><p class="text-xs text-blue-800 uppercase font-bold">KM Atual</p><p class="font-black text-xl text-blue-900">${os.km ? os.km + ' km' : '---'}</p></div>
              <div class="flex gap-2 items-center"><input type="number" id="quickKmInput" placeholder="Novo KM" class="w-24 p-2 text-sm border border-blue-200 rounded text-center font-bold"><button onclick="window.saveKm('${os.id}')" class="btn bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs font-bold">OK</button></div>
          </div>
          <div class="bg-red-50 border-l-4 border-red-400 p-3 rounded text-sm text-red-800 relative group">
              <span class="font-bold block text-xs uppercase mb-1">Queixa:</span>
              ${isManager ? `
                <div id="view-observacoes" class="whitespace-pre-wrap">${os.observacoes || 'Sem queixa.'}</div>
                <i class='bx bx-edit absolute top-2 right-2 cursor-pointer opacity-0 group-hover:opacity-100' onclick="window.toggleEdit('observacoes', '${os.id}')"></i>
                <div id="edit-observacoes" class="hidden mt-2">
                    <textarea id="input-observacoes" class="w-full p-2 border rounded text-sm mb-2" rows="3">${os.observacoes || ''}</textarea>
                    <div class="flex justify-end gap-2"><button onclick="window.cancelEdit('observacoes')" class="text-xs underline">Cancelar</button><button onclick="window.saveEdit('observacoes', '${os.id}')" class="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold">Salvar</button></div>
                </div>
              ` : (os.observacoes || 'Sem queixa.')}
          </div>
      `;
  };

  // --- FUNÇÕES DE EDIÇÃO & KM ---
  window.toggleEdit = (field, osId, isPrompt = false) => {
      if(isPrompt && field === 'placa') {
          const os = allServiceOrders[osId];
          const newPlaca = prompt("Editar Placa:", os.placa);
          if(newPlaca && newPlaca !== os.placa) {
              db.ref(`serviceOrders/${osId}`).update({ placa: newPlaca.toUpperCase() });
              logEdit(osId, 'Placa', os.placa, newPlaca.toUpperCase());
          }
          return;
      }
      const view = document.getElementById(`view-${field}`);
      const edit = document.getElementById(`edit-${field}`);
      if(view && edit) { view.classList.add('hidden'); edit.classList.remove('hidden'); edit.classList.add('editing-field'); }
  };

  window.cancelEdit = (field) => {
      const view = document.getElementById(`view-${field}`);
      const edit = document.getElementById(`edit-${field}`);
      if(view && edit) { view.classList.remove('hidden'); edit.classList.add('hidden'); edit.classList.remove('editing-field'); }
  };

  window.saveEdit = (field, osId) => {
      const input = document.getElementById(`input-${field}`);
      const os = allServiceOrders[osId];
      if(!input || !os) return;
      const newValue = input.value.trim();
      const oldValue = os[field] || '';
      if(newValue !== oldValue) {
          const up = {}; up[field] = newValue;
          db.ref(`serviceOrders/${osId}`).update(up);
          logEdit(osId, field, oldValue, newValue);
          showNotification('Atualizado!');
      }
      window.cancelEdit(field);
  };

  window.saveKm = (osId) => {
      const input = document.getElementById('quickKmInput');
      if(!input || !input.value) return;
      db.ref(`serviceOrders/${osId}`).update({ km: input.value });
      db.ref(`serviceOrders/${osId}/logs`).push({ user: currentUser.name, timestamp: new Date().toISOString(), description: `KM atualizado: ${input.value} km`, type: 'log' });
      showNotification('KM Atualizado!');
      input.value = '';
  };

  const logEdit = (id, field, oldV, newV) => {
      db.ref(`serviceOrders/${id}/logs`).push({ user: currentUser.name, timestamp: new Date().toISOString(), description: `EDITADO: ${field} (${oldV} -> ${newV})`, type: 'log' });
  };

  // --- IMPRESSÃO (CORRIGIDO TAMANHO IMAGENS) ---
  const printOS = (os) => {
      const logs = os.logs ? Object.values(os.logs).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)) : [];
      const lines = logs.map(l => `<tr><td>${new Date(l.timestamp).toLocaleString('pt-BR')}</td><td>${l.user}</td><td>${l.description}</td><td>${l.parts||'-'}</td><td class="text-right">${l.value?`R$ ${l.value}`:'-'}</td></tr>`).join('');
      // BUG FIX PDF: Classes photo-grid e photo-box adicionadas para controle
      const imgs = os.media ? Object.values(os.media).filter(m => m.type && m.type.includes('image')).slice(0,6).map(m => `<div class="photo-box"><img src="${m.url}"></div>`).join('') : '';
      
      const html = `<html><head><title>${os.placa}</title><style>
            body{font-family:sans-serif;font-size:12px;padding:20px}
            .header{text-align:center;border-bottom:2px solid blue;margin-bottom:20px}
            table{width:100%;border-collapse:collapse;margin-bottom:20px}
            th,td{border-bottom:1px solid #ddd;padding:5px;text-align:left}
            .text-right{text-align:right}
            /* GRID DE MINIATURAS */
            .photos-container { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
            .photo-box { width: 100px; height: 100px; border: 1px solid #ccc; overflow: hidden; display: flex; align-items: center; justify-content: center; }
            .photo-box img { width: 100%; height: 100%; object-fit: cover; }
      </style></head><body>
      <div class="header"><h1>${os.placa} - ${os.modelo}</h1><p>Cliente: ${os.cliente}</p></div>
      <h3>Histórico</h3>
      <table><thead><tr><th>Data</th><th>Resp.</th><th>Desc.</th><th>Peças</th><th>Valor</th></tr></thead><tbody>${lines}</tbody></table>
      <h3>Evidências</h3>
      <div class="photos-container">${imgs}</div>
      <script>window.print()</script></body></html>`;
      
      const win = window.open('', '', 'width=900,height=800');
      win.document.write(html); win.document.close();
  };

  const renderTimeline = (os) => {
      const el = document.getElementById('timelineContainer');
      if(!os.logs) { el.innerHTML = '<p class="text-slate-400 text-center text-xs">Sem histórico.</p>'; return; }
      const logs = Object.entries(os.logs).sort((a,b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
      el.innerHTML = logs.map(([k, l]) => `
          <div class="timeline-item"><div class="timeline-dot"></div>
              <div class="flex justify-between mb-1"><span class="font-bold text-xs text-blue-900">${l.user}</span><span class="text-[10px] text-slate-400">${new Date(l.timestamp).toLocaleString('pt-BR')}</span></div>
              <div class="text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">${l.description} ${l.parts?`<div class="mt-1 pt-1 border-t text-xs font-bold text-green-700">Peças: ${l.parts} | R$ ${l.value}</div>`:''}</div>
              ${currentUser.role === 'Gestor' ? `<button onclick="window.deleteLog('${os.id}','${k}')" class="text-[10px] text-red-300 hover:text-red-500">Excluir</button>` : ''}
          </div>`).join('');
  };
  window.deleteLog = (id, key) => { if(confirm('Excluir?')) db.ref(`serviceOrders/${id}/logs/${key}`).remove(); };

  // --- GALERIA & LIGHTBOX ---
  const renderGallery = (os) => {
      const el = document.getElementById('thumbnail-grid');
      if(!os.media) { el.innerHTML = '<p class="col-span-full text-center text-slate-400 text-xs">Sem mídia.</p>'; return; }
      const media = Object.entries(os.media); lightboxMedia = media.map(m=>m[1]);
      el.innerHTML = media.map(([k, m], i) => {
          const isVid = m.type && m.type.includes('video');
          return `<div class="aspect-square bg-slate-100 rounded overflow-hidden relative cursor-pointer group" onclick="window.openLightbox(${i})">
              ${isVid ? '<div class="absolute inset-0 flex items-center justify-center text-blue-500 text-3xl"><i class="bx bx-play-circle"></i></div>' : `<img src="${m.url}" class="w-full h-full object-cover">`}
              ${currentUser.role === 'Gestor' ? `<button onclick="event.stopPropagation(); window.deleteMedia('${os.id}','${k}')" class="absolute top-1 right-1 bg-red-600 text-white w-5 h-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100">&times;</button>` : ''}
          </div>`;
      }).join('');
  };
  window.deleteMedia = (id, k) => { if(confirm('Excluir?')) db.ref(`serviceOrders/${id}/media/${k}`).remove(); };

  window.openLightbox = (i) => {
      currentLightboxIndex = i; const m = lightboxMedia[i];
      const content = document.getElementById('lightbox-content');
      if(m.type.includes('image')) content.innerHTML = `<img src="${m.url}" class="max-w-full max-h-full object-contain">`;
      else if(m.type.includes('video')) content.innerHTML = `<video src="${m.url}" controls autoplay class="max-w-full max-h-full"></video>`;
      else window.open(m.url);
      document.getElementById('lightbox-download').href = m.url;
      const lb = document.getElementById('lightbox');
      lb.classList.remove('hidden'); lb.classList.add('flex');
  };

  // --- BOTÕES MODAIS (CORREÇÃO AQUI) ---
  document.querySelectorAll('.btn-close-modal').forEach(b => b.onclick = (e) => {
      // Fecha modal padrão
      e.target.closest('.modal').classList.add('hidden'); 
      e.target.closest('.modal').classList.remove('flex');
      
      // Fecha lightbox especificamente se estiver aberto, removendo o flex
      const lb = document.getElementById('lightbox');
      lb.classList.remove('flex');
      lb.classList.add('hidden');
  });

  // CORREÇÃO: Remove explicitamente a classe 'flex' ao fechar
  document.getElementById('lightbox-close').onclick = () => {
      const lb = document.getElementById('lightbox');
      lb.classList.remove('flex'); // IMPORTANTE: Remove o display flex
      lb.classList.add('hidden');  // Adiciona o hidden
  };

  document.getElementById('lightbox-prev').onclick = () => { if(currentLightboxIndex>0) window.openLightbox(currentLightboxIndex-1); };
  document.getElementById('lightbox-next').onclick = () => { if(currentLightboxIndex<lightboxMedia.length-1) window.openLightbox(currentLightboxIndex+1); };

  // --- FORM LOG ---
  const logForm = document.getElementById('logForm');
  if(logForm) logForm.onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button'); btn.disabled=true; btn.innerText='...';
      const id = document.getElementById('logOsId').value;
      try {
          if(filesToUpload.length) {
              const res = await Promise.all(filesToUpload.map(f => uploadFileToCloudinary(f)));
              res.forEach(r => db.ref(`serviceOrders/${id}/media`).push(r));
          }
          const desc = document.getElementById('logDescricao').value;
          if(desc || document.getElementById('logValor').value) {
              await db.ref(`serviceOrders/${id}/logs`).push({
                  user: currentUser.name, timestamp: new Date().toISOString(),
                  description: desc, parts: document.getElementById('logPecas').value, value: document.getElementById('logValor').value
              });
          }
          showNotification('Salvo!'); e.target.reset(); filesToUpload = [];
          document.getElementById('fileName').innerText = '';
          document.getElementById('post-log-actions').classList.remove('hidden');
      } catch(err) { showNotification(err.message, 'error'); }
      btn.disabled=false; btn.innerText='SALVAR REGISTRO';
  };

  // --- BOTÕES DE MOVIMENTO (LOG FORM) ---
  const bNext = document.getElementById('btn-move-next');
  const bPrev = document.getElementById('btn-move-prev');
  const bStay = document.getElementById('btn-stay');
  if(bNext) bNext.onclick = () => window.quickMove(document.getElementById('logOsId').value, 'next');
  if(bPrev) bPrev.onclick = () => window.quickMove(document.getElementById('logOsId').value, 'prev');
  if(bStay) bStay.onclick = () => document.getElementById('post-log-actions').classList.add('hidden');

  // --- NOVA OS ---
  document.getElementById('addOSBtn').onclick = () => {
      document.getElementById('osForm').reset();
      document.getElementById('osResponsavel').innerHTML = document.getElementById('userSelect').innerHTML;
      const m = document.getElementById('osModal'); m.classList.remove('hidden'); m.classList.add('flex');
  };
  document.getElementById('osForm').onsubmit = (e) => {
      e.preventDefault();
      const prio = document.querySelector('input[name="osPrioridade"]:checked').value;
      const resp = JSON.parse(document.getElementById('osResponsavel').value).name;
      db.ref('serviceOrders').push({
          placa: document.getElementById('osPlaca').value.toUpperCase(),
          modelo: document.getElementById('osModelo').value,
          cliente: document.getElementById('osCliente').value,
          telefone: document.getElementById('osTelefone').value,
          km: document.getElementById('osKm').value,
          responsible: resp, observacoes: document.getElementById('osObservacoes').value,
          priority: prio, status: 'Aguardando-Mecanico', createdAt: new Date().toISOString()
      });
      document.getElementById('osModal').classList.add('hidden');
      showNotification('Criada!');
  };

  // --- INPUTS ---
  const fileInp = document.getElementById('media-input');
  if(fileInp) fileInp.onchange = (e) => { filesToUpload = Array.from(e.target.files); document.getElementById('fileName').innerText = `${filesToUpload.length} arqs`; };
  document.getElementById('openCameraBtn').onclick = () => { fileInp.setAttribute('capture','environment'); fileInp.click(); };
  document.getElementById('openGalleryBtn').onclick = () => { fileInp.removeAttribute('capture'); fileInp.click(); };

  // --- BUSCA ---
  document.getElementById('globalSearchInput').oninput = (e) => {
      const v = e.target.value.toUpperCase();
      const res = document.getElementById('globalSearchResults');
      if(v.length<2) { res.classList.add('hidden'); return; }
      const f = Object.values(allServiceOrders).filter(o=> (o.placa+o.cliente+o.modelo).toUpperCase().includes(v));
      res.innerHTML = f.length ? f.map(o=>`<div class="p-3 border-b hover:bg-slate-50 cursor-pointer" onclick="window.openDetails('${o.id}');document.getElementById('globalSearchResults').classList.add('hidden')"><b>${o.placa}</b> - ${o.modelo}</div>`).join('') : '<div class="p-3 text-center">Nada encontrado</div>';
      res.classList.remove('hidden');
  };

  const updateAlerts = () => {
      const alertPanel = document.getElementById('attention-panel');
      const led = document.getElementById('alert-led');
      const alerts = Object.values(allServiceOrders).filter(o => ['Aguardando-Mecanico','Servico-Autorizado'].includes(o.status));
      if(led) alerts.length ? (led.classList.remove('hidden'), led.classList.add('animate-ping')) : led.classList.add('hidden');
      if(alertPanel) alertPanel.innerHTML = alerts.map(o => `<div class="bg-slate-700 p-2 rounded text-white text-xs cursor-pointer" onclick="window.openDetails('${o.id}')"><b>${o.placa}</b> ${o.status.replace(/-/g,' ')}</div>`).join('');
  };
  document.getElementById('toggle-panel-btn').onclick = () => {
      const c = document.getElementById('attention-panel-container');
      c.style.maxHeight = c.style.maxHeight ? null : '200px';
  };
});
