/* ==================================================================
   DASHBOARD CENTER CAR MENECHELLI - V3.7 (QUICK ACTIONS & EDIT)
   Desenvolvido por: thIAguinho Soluções
   ================================================================== */

// CONFIGURAÇÃO REAL DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDFbvRiLpUcXFJgVSwNobXi0fX_IceBK5k",
  authDomain: "centercarmenechelli-47e05.firebaseapp.com",
  databaseURL: "https://centercarmenechelli-47e05-default-rtdb.firebaseio.com",
  projectId: "centercarmenechelli-47e05",
  storageBucket: "centercarmenechelli-47e05.firebasestorage.app",
  messagingSenderId: "697435506647",
  appId: "1:697435506647:web:dce5cbf910f4960f732d92"
};

// Variáveis de Estado
let activeCloudinaryConfig = null;
let currentUser = null;
let allServiceOrders = {};
let lightboxMedia = [];
let currentLightboxIndex = 0;
let filesToUpload = [];

// Definição Estrita dos Status
const STATUS_LIST = [ 
    'Aguardando-Mecanico', 'Em-Analise', 'Orcamento-Enviado', 
    'Aguardando-Aprovacao', 'Servico-Autorizado', 'Em-Execucao', 
    'Finalizado-Aguardando-Retirada', 'Entregue' 
];

// --- TOAST NOTIFICATIONS (UI FEEDBACK) ---
function showNotification(message, type = 'success') {
  const div = document.createElement('div');
  div.className = `notification ${type}`;
  div.innerHTML = `<i class='bx ${type === 'success' ? 'bx-check-circle' : 'bx-error-circle'} text-xl'></i> <span class="font-bold text-sm">${message}</span>`;
  document.body.appendChild(div);
  
  requestAnimationFrame(() => div.classList.add('show'));
  setTimeout(() => {
      div.classList.remove('show');
      setTimeout(() => div.remove(), 300);
  }, 4000);
}

// --- CLOUDINARY SERVICE ---
const uploadFileToCloudinary = async (file) => {
  if (!activeCloudinaryConfig) throw new Error('Mídia não configurada no Admin.');
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', activeCloudinaryConfig.uploadPreset);
  
  const res = await fetch(`https://api.cloudinary.com/v1_1/${activeCloudinaryConfig.cloudName}/auto/upload`, {
      method: 'POST', body: formData
  });
  
  if (!res.ok) throw new Error('Erro ao enviar imagem. Verifique a conexão.');
  const data = await res.json();
  return { url: data.secure_url, type: data.resource_type };
};

// --- INIT APP ---
document.addEventListener('DOMContentLoaded', () => {
  try {
      firebase.initializeApp(firebaseConfig);
  } catch(e) {
      console.error("Erro ao inicializar Firebase:", e);
      return;
  }
  
  const db = firebase.database();

  // 1. CARREGAMENTO DE USUÁRIOS
  db.ref('users').on('value', snap => {
      const data = snap.val();
      const select = document.getElementById('userSelect');
      if(!select) return;

      select.innerHTML = '<option value="">Selecione...</option>';
      if (data) {
          Object.entries(data).forEach(([key, user]) => {
              if (!user.name) return;
              const opt = document.createElement('option');
              opt.value = JSON.stringify({id: key, name: user.name, role: user.role || 'Colaborador', password: user.password});
              opt.textContent = user.name;
              select.appendChild(opt);
          });
      }
  });

  // 2. CONFIGURAÇÃO DE MÍDIA
  db.ref('cloudinaryConfigs').limitToLast(1).on('value', snap => {
      const val = snap.val();
      if(val) activeCloudinaryConfig = Object.values(val)[0];
  });

  // 3. LOGIN HANDLER
  const loginForm = document.getElementById('loginForm');
  if(loginForm) {
      loginForm.onsubmit = (e) => {
          e.preventDefault();
          const selectVal = document.getElementById('userSelect').value;
          const pass = document.getElementById('passwordInput').value;
          
          if(!selectVal) {
              document.getElementById('loginError').textContent = "Selecione um usuário.";
              return;
          }
          
          try {
              const user = JSON.parse(selectVal);
              if (user.password === pass) {
                  currentUser = user;
                  document.getElementById('userScreen').classList.add('hidden');
                  document.getElementById('app').classList.remove('hidden');
                  document.getElementById('app').classList.add('flex');
                  document.getElementById('currentUserName').textContent = user.name.split(' ')[0];
                  
                  if(user.role === 'Gestor' || user.name.includes('Thiago')) {
                      const adminBtn = document.getElementById('adminBtn');
                      const reportsBtn = document.getElementById('reportsBtn');
                      const adminZone = document.getElementById('adminZone');
                      if(adminBtn) adminBtn.classList.remove('hidden');
                      if(reportsBtn) reportsBtn.classList.remove('hidden');
                      if(adminZone) adminZone.classList.remove('hidden');
                  }
                  
                  initKanban();
                  listenOS();
              } else {
                  document.getElementById('loginError').textContent = "SENHA INCORRETA";
              }
          } catch (err) {
              console.error("Erro no login:", err);
              document.getElementById('loginError').textContent = "Erro ao processar login.";
          }
      };
  }

  // 4. KANBAN RENDERER
  const initKanban = () => {
      const board = document.getElementById('kanbanBoard');
      if(!board) return;

      board.innerHTML = STATUS_LIST.map(status => `
        <div class="status-column">
            <div class="column-header">
                <span>${status.replace(/-/g, ' ')}</span>
                <span class="bg-white/50 px-2 py-0.5 rounded text-[10px] border border-slate-300" id="count-${status}">0</span>
            </div>
            <div class="vehicle-list" id="col-${status}"></div>
        </div>
      `).join('');
  };

  // 5. CORE LOGIC: LISTENERS REALTIME
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
              if(!os.status) return; 
              os.id = id;
              const col = document.getElementById(`col-${os.status}`);
              if(col) col.innerHTML += createCard(os);
          });

          STATUS_LIST.forEach(s => {
              const col = document.getElementById(`col-${s}`);
              const count = document.getElementById(`count-${s}`);
              if(col && count) count.innerText = col.children.length;
          });
          
          updateAlerts();
          
          const modal = document.getElementById('detailsModal');
          const openLogId = document.getElementById('logOsId');
          
          if(modal && !modal.classList.contains('hidden') && openLogId && openLogId.value) {
              const currentOs = allServiceOrders[openLogId.value];
              if(currentOs) {
                  // Se não estiver editando, atualiza os campos (evita sobrescrever enquanto digita)
                  if(!document.querySelector('.editing-field')) {
                      refreshDetailsView(currentOs);
                  }
                  renderTimeline(currentOs);
                  renderGallery(currentOs);
              }
          }
      });
  };

  const createCard = (os) => {
      const placa = os.placa || 'SEM PLACA';
      const modelo = os.modelo || 'Desconhecido';
      const cliente = os.cliente || 'Anônimo';
      const km = os.km ? os.km + ' km' : '';
      
      let prioDot = '';
      if(os.priority === 'verde') prioDot = '<span class="priority-dot bg-prio-verde" title="Normal"></span>';
      if(os.priority === 'amarelo') prioDot = '<span class="priority-dot bg-prio-amarelo" title="Atenção"></span>';
      if(os.priority === 'vermelho') prioDot = '<span class="priority-dot bg-prio-vermelho" title="Urgente"></span>';

      // Lógica dos Botões de Movimentação Rápida
      const currentIdx = STATUS_LIST.indexOf(os.status);
      const hasPrev = currentIdx > 0;
      const hasNext = currentIdx < STATUS_LIST.length - 1;

      const btnPrev = hasPrev ? 
          `<button onclick="event.stopPropagation(); window.quickMove('${os.id}', 'prev')" class="text-slate-400 hover:text-blue-600 p-1 transition-colors" title="Voltar Status"><i class='bx bx-chevron-left text-xl'></i></button>` 
          : `<div class="w-7"></div>`;
      
      const btnNext = hasNext ? 
          `<button onclick="event.stopPropagation(); window.quickMove('${os.id}', 'next')" class="text-slate-400 hover:text-blue-600 p-1 transition-colors" title="Avançar Status"><i class='bx bx-chevron-right text-xl'></i></button>` 
          : `<div class="w-7"></div>`;

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
          
          <!-- BOTÕES RÁPIDOS -->
          <div class="flex justify-between items-center mt-2 pt-1 border-t border-gray-100">
              ${btnPrev}
              <span class="text-[9px] text-gray-300 uppercase font-bold tracking-wider">Mover</span>
              ${btnNext}
          </div>
      </div>`;
  };

  // --- MOVIMENTAÇÃO RÁPIDA (GLOBAL) ---
  window.quickMove = (osId, dir) => {
      const os = allServiceOrders[osId];
      if(!os) return;
      
      const idx = STATUS_LIST.indexOf(os.status);
      let newStatus = null;
      
      if(dir === 'next' && idx < STATUS_LIST.length - 1) newStatus = STATUS_LIST[idx + 1];
      if(dir === 'prev' && idx > 0) newStatus = STATUS_LIST[idx - 1];
      
      if(newStatus) {
          const updates = { status: newStatus, lastUpdate: new Date().toISOString() };
          
          // Atribuição automática de responsabilidade ao mover
          if (newStatus === 'Em-Analise') updates.responsibleForBudget = currentUser.name;
          else if (newStatus === 'Em-Execucao') updates.responsibleForService = currentUser.name;
          else if (newStatus === 'Entregue') updates.responsibleForDelivery = currentUser.name;

          db.ref(`serviceOrders/${osId}`).update(updates);
          db.ref(`serviceOrders/${osId}/logs`).push({
              user: currentUser.name, // Registra quem clicou no botão rápido
              timestamp: new Date().toISOString(),
              description: `Status alterado (Rápido): ${os.status} ➔ ${newStatus}`,
              type: 'status'
          });
          showNotification('Status atualizado!');
      }
  };

  // 6. DETALHES & MODAIS
  window.openDetails = (id) => {
      const os = allServiceOrders[id];
      if(!os) return;
      
      document.getElementById('logOsId').value = id;
      
      // Limpa formulários
      document.getElementById('logForm').reset();
      const fileNameDisplay = document.getElementById('fileName');
      if(fileNameDisplay) fileNameDisplay.innerText = '';
      filesToUpload = [];
      const postActions = document.getElementById('post-log-actions');
      if(postActions) postActions.classList.add('hidden');
      
      refreshDetailsView(os); // Renderiza os dados
      renderTimeline(os);
      renderGallery(os);
      
      // Configurar Botão Excluir (Gestores)
      const delBtn = document.getElementById('deleteOsBtn');
      if(delBtn) {
          delBtn.onclick = () => {
              document.getElementById('confirmDeleteText').innerHTML = `Apagar ficha de <strong>${os.placa}</strong>?`;
              document.getElementById('confirmDeleteBtn').onclick = async () => {
                  await db.ref(`serviceOrders/${id}`).remove();
                  document.getElementById('confirmDeleteModal').classList.add('hidden');
                  document.getElementById('detailsModal').classList.add('hidden');
                  showNotification('Ficha excluída.');
              };
              document.getElementById('confirmDeleteModal').classList.remove('hidden');
          };
      }

      const exportBtn = document.getElementById('exportOsBtn');
      if(exportBtn) exportBtn.onclick = () => printOS(os);
      
      const modal = document.getElementById('detailsModal');
      if(modal) modal.classList.remove('hidden');
  };

  // Função auxiliar para renderizar os dados e permitir edição
  const refreshDetailsView = (os) => {
      const isManager = currentUser && (currentUser.role === 'Gestor' || currentUser.name.includes('Thiago'));
      
      // Helper para criar campo editável
      const editable = (field, value, label) => {
          if (!isManager) return `<span class="font-bold text-slate-700">${value || '-'}</span>`;
          return `
            <div class="flex items-center gap-2 group">
                <span id="view-${field}" class="font-bold text-slate-700">${value || '-'}</span>
                <i class='bx bx-edit-alt text-gray-400 hover:text-blue-600 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity' onclick="window.toggleEdit('${field}', '${os.id}')"></i>
                <div id="edit-${field}" class="hidden flex gap-1 items-center">
                    <input type="text" id="input-${field}" value="${value || ''}" class="p-1 text-sm border rounded w-full">
                    <button onclick="window.saveEdit('${field}', '${os.id}')" class="text-green-600 hover:bg-green-100 p-1 rounded"><i class='bx bx-check'></i></button>
                    <button onclick="window.cancelEdit('${field}')" class="text-red-500 hover:bg-red-100 p-1 rounded"><i class='bx bx-x'></i></button>
                </div>
            </div>`;
      };

      document.getElementById('modalTitlePlaca').innerHTML = isManager ? 
          `<div class="flex items-center gap-2">${os.placa} <i class='bx bx-edit text-sm text-gray-300 hover:text-gray-500 cursor-pointer' onclick="window.toggleEdit('placa', '${os.id}', true)"></i></div>` : os.placa;
          
      // Input especial para Placa (aparece como modal/prompt se clicar no lapis do titulo)
      // Para simplificar, vou usar o mesmo sistema inline para os outros campos abaixo

      document.getElementById('modalTitleModelo').textContent = `${os.modelo || ''} • ${os.cliente || ''}`;

      // Painel de Informações Principais com Edição
      const infoContent = document.getElementById('detailsInfoContent');
      if(infoContent) {
          infoContent.innerHTML = `
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <!-- Dados Editáveis -->
                  <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <p class="text-xs text-slate-400 uppercase font-bold mb-1">Cliente</p>
                      ${editable('cliente', os.cliente, 'Cliente')}
                  </div>
                  <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <p class="text-xs text-slate-400 uppercase font-bold mb-1">Telefone</p>
                      ${editable('telefone', os.telefone, 'Telefone')}
                  </div>
                  <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <p class="text-xs text-slate-400 uppercase font-bold mb-1">Modelo/Veículo</p>
                      ${editable('modelo', os.modelo, 'Modelo')}
                  </div>
                  <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <p class="text-xs text-slate-400 uppercase font-bold mb-1">Consultor</p>
                      <p class="font-bold text-slate-700">${os.responsible || '-'}</p>
                  </div>
              </div>

              <!-- Atualização de KM (Para Todos) -->
              <div class="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center justify-between mb-4">
                  <div>
                      <p class="text-xs text-blue-800 uppercase font-bold">KM Atual</p>
                      <p class="font-black text-xl text-blue-900">${os.km ? os.km + ' km' : '---'}</p>
                  </div>
                  <div class="flex gap-2 items-center">
                      <input type="number" id="quickKmInput" placeholder="Novo KM" class="w-24 p-2 text-sm border border-blue-200 rounded text-center font-bold">
                      <button onclick="window.saveKm('${os.id}')" class="btn bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs uppercase font-bold shadow-sm">
                          Atualizar
                      </button>
                  </div>
              </div>

              <!-- Queixa (Editável) -->
              <div class="bg-red-50 border-l-4 border-red-400 p-3 rounded text-sm text-red-800 relative group">
                  <span class="font-bold block text-xs uppercase mb-1">Queixa do Cliente:</span>
                  ${isManager ? `
                    <div id="view-observacoes" class="whitespace-pre-wrap">${os.observacoes || 'Sem queixa registrada.'}</div>
                    <i class='bx bx-edit absolute top-2 right-2 cursor-pointer opacity-0 group-hover:opacity-100' onclick="window.toggleEdit('observacoes', '${os.id}')"></i>
                    <div id="edit-observacoes" class="hidden mt-2">
                        <textarea id="input-observacoes" class="w-full p-2 border rounded text-sm mb-2" rows="3">${os.observacoes || ''}</textarea>
                        <div class="flex justify-end gap-2">
                            <button onclick="window.cancelEdit('observacoes')" class="text-xs text-gray-500 underline">Cancelar</button>
                            <button onclick="window.saveEdit('observacoes', '${os.id}')" class="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold">Salvar Alteração</button>
                        </div>
                    </div>
                  ` : (os.observacoes || 'Sem queixa registrada.')}
              </div>
          `;
      }
  };

  // --- FUNÇÕES DE EDIÇÃO E KM ---
  window.toggleEdit = (field, osId, isPrompt = false) => {
      if(isPrompt && field === 'placa') {
          // Edição Especial para Placa via Prompt (mais seguro para layout)
          const os = allServiceOrders[osId];
          const newPlaca = prompt("Editar Placa:", os.placa);
          if(newPlaca && newPlaca !== os.placa) {
              const updates = { placa: newPlaca.toUpperCase() };
              db.ref(`serviceOrders/${osId}`).update(updates);
              logEdit(osId, 'Placa', os.placa, newPlaca.toUpperCase());
          }
          return;
      }

      const viewEl = document.getElementById(`view-${field}`);
      const editEl = document.getElementById(`edit-${field}`);
      if(viewEl && editEl) {
          viewEl.classList.add('hidden');
          editEl.classList.remove('hidden');
          editEl.classList.add('editing-field'); // Marcador para evitar refresh automatico
          const input = document.getElementById(`input-${field}`);
          if(input) input.focus();
      }
  };

  window.cancelEdit = (field) => {
      const viewEl = document.getElementById(`view-${field}`);
      const editEl = document.getElementById(`edit-${field}`);
      if(viewEl && editEl) {
          viewEl.classList.remove('hidden');
          editEl.classList.add('hidden');
          editEl.classList.remove('editing-field');
      }
  };

  window.saveEdit = (field, osId) => {
      const input = document.getElementById(`input-${field}`);
      const os = allServiceOrders[osId];
      if(!input || !os) return;

      const newValue = input.value.trim();
      const oldValue = os[field] || '';

      if (newValue !== oldValue) {
          const updates = {};
          updates[field] = newValue;
          db.ref(`serviceOrders/${osId}`).update(updates);
          logEdit(osId, field, oldValue, newValue);
          showNotification('Informação atualizada!');
      }
      window.cancelEdit(field);
  };

  window.saveKm = (osId) => {
      const input = document.getElementById('quickKmInput');
      if(!input || !input.value) return;
      
      const newKm = input.value;
      db.ref(`serviceOrders/${osId}`).update({ km: newKm });
      
      // Log específico de KM
      db.ref(`serviceOrders/${osId}/logs`).push({
          user: currentUser.name,
          timestamp: new Date().toISOString(),
          description: `KM atualizado: ${newKm} km`,
          type: 'log' // ou um tipo 'info' se quiser ícone diferente
      });
      showNotification('Quilometragem atualizada!');
      input.value = '';
  };

  const logEdit = (osId, field, oldVal, newVal) => {
      db.ref(`serviceOrders/${osId}/logs`).push({
          user: currentUser.name,
          timestamp: new Date().toISOString(),
          description: `EDITADO: ${field} alterado de "${oldVal}" para "${newVal}".`,
          type: 'log'
      });
  };

  // --- IMPRESSÃO (Mantida e Estável) ---
  const printOS = (os) => {
      const logs = os.logs ? Object.values(os.logs).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)) : [];
      let totalPecas = 0;

      const linhasTabela = logs.map(log => {
          const valor = log.value ? parseFloat(log.value) : 0;
          totalPecas += valor;
          return `
          <tr>
              <td>${new Date(log.timestamp).toLocaleString('pt-BR')}</td>
              <td>${log.user}</td>
              <td>${log.description}</td>
              <td>${log.parts || '-'}</td>
              <td class="text-right">${valor > 0 ? `R$ ${valor.toFixed(2)}` : '-'}</td>
          </tr>`;
      }).join('');

      const midia = os.media ? Object.values(os.media).filter(m => m && ( (m.type && m.type.includes('image')) || (m.url && m.url.match(/\.(jpeg|jpg|png|webp)$/i)) )).slice(0, 6) : []; 

      const fotosHtml = midia.length ? `
          <div class="section">
              <h3>Registro Fotográfico</h3>
              <div class="photos-grid">
                  ${midia.map(m => `<div class="photo-box"><img src="${m.url}"></div>`).join('')}
              </div>
          </div>` : '';

      const printContent = `
        <html>
        <head>
            <title>OS ${os.placa}</title>
            <style>
                body { font-family: sans-serif; font-size: 12px; color: #333; padding: 20px; }
                .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 20px; }
                .header h1 { margin: 0; color: #1e40af; font-size: 24px; text-transform: uppercase; }
                .header p { margin: 2px 0; font-size: 10px; color: #666; }
                .box { border: 1px solid #ccc; border-radius: 5px; padding: 10px; margin-bottom: 15px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
                h3 { font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 0; text-transform: uppercase; color: #444; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; }
                th { background: #f3f4f6; text-align: left; padding: 5px; border-bottom: 1px solid #ddd; }
                td { padding: 5px; border-bottom: 1px solid #eee; vertical-align: top; }
                .text-right { text-align: right; }
                .total { text-align: right; font-size: 16px; font-weight: bold; margin-top: 10px; color: #1e40af; }
                .photos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .photo-box img { width: 100%; height: 150px; object-fit: cover; border: 1px solid #ddd; }
                .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ccc; padding-top: 10px; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Center Car Menechelli</h1>
                <p>Relatório Técnico de Serviço • Emitido em ${new Date().toLocaleString('pt-BR')}</p>
            </div>
            <div class="box">
                <div class="info-grid">
                    <div><strong>Placa:</strong> ${os.placa}</div>
                    <div><strong>Modelo:</strong> ${os.modelo || '-'}</div>
                    <div><strong>KM:</strong> ${os.km || '-'}</div>
                    <div><strong>Cliente:</strong> ${os.cliente || '-'}</div>
                    <div><strong>Tel:</strong> ${os.telefone || '-'}</div>
                    <div><strong>Consultor:</strong> ${os.responsible || '-'}</div>
                </div>
            </div>
            ${os.observacoes ? `<div class="box"><h3>Reclamação Inicial</h3><p>${os.observacoes}</p></div>` : ''}
            <div class="box">
                <h3>Histórico de Serviços</h3>
                <table>
                    <thead><tr><th>Data</th><th>Técnico</th><th>Descrição</th><th>Peças</th><th class="text-right">Valor</th></tr></thead>
                    <tbody>${linhasTabela || '<tr><td colspan="5" style="text-align:center">Sem registros</td></tr>'}</tbody>
                </table>
                <div class="total">Total Estimado: R$ ${totalPecas.toFixed(2)}</div>
            </div>
            ${fotosHtml}
            <div class="footer">
                <p>Este documento é um registro interno de acompanhamento.</p>
                <p>Sistema Desenvolvido por thIAguinho Soluções</p>
            </div>
            <script>window.print();</script>
        </body>
        </html>
      `;
      
      const win = window.open('', '', 'width=900,height=800');
      win.document.write(printContent);
      win.document.close();
  };

  // --- TIMELINE ---
  const renderTimeline = (os) => {
      const container = document.getElementById('timelineContainer');
      if (!os.logs) { container.innerHTML = '<p class="text-slate-400 text-center text-xs py-4">Nenhum histórico.</p>'; return; }
      
      const logs = Object.entries(os.logs).sort((a,b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
      
      container.innerHTML = logs.map(([key, log]) => `
          <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="flex justify-between items-baseline mb-1">
                  <span class="font-bold text-xs text-blue-900 uppercase">${log.user}</span>
                  <span class="text-[10px] text-slate-400">${new Date(log.timestamp).toLocaleString('pt-BR')}</span>
              </div>
              <div class="text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                  ${log.description}
                  ${log.parts ? `<div class="mt-2 pt-2 border-t border-slate-200 text-xs font-medium text-slate-600 flex justify-between"><span>🔧 ${log.parts}</span> <span class="text-green-600 font-bold">R$ ${log.value}</span></div>` : ''}
              </div>
              ${currentUser && currentUser.role === 'Gestor' ? `<button onclick="deleteLog('${os.id}','${key}')" class="text-[10px] text-red-300 hover:text-red-500 mt-1">Excluir</button>` : ''}
          </div>
      `).join('');
  };

  window.deleteLog = (osId, key) => { if(confirm('Excluir log?')) db.ref(`serviceOrders/${osId}/logs/${key}`).remove(); };

  // --- GALERIA ---
  const renderGallery = (os) => {
      const grid = document.getElementById('thumbnail-grid');
      if(!os.media) { grid.innerHTML = '<p class="col-span-full text-center text-slate-400 text-xs py-2">Sem fotos.</p>'; return; }
      
      const midia = Object.entries(os.media);
      lightboxMedia = midia.map(m => m[1]); 

      grid.innerHTML = midia.map(([key, m], idx) => {
          const fileType = (m && m.type) ? m.type : '';
          const fileUrl = (m && m.url) ? m.url : '';
          
          const isVideo = fileType.includes('video') || fileUrl.match(/\.(mp4|webm|ogg)$/i);
          const isPdf = fileType.includes('pdf') || fileUrl.match(/\.pdf$/i);

          let content = `<img src="${fileUrl}" class="w-full h-full object-cover">`;
          if(isVideo) content = '<div class="absolute inset-0 flex items-center justify-center text-blue-500 text-3xl"><i class="bx bx-play-circle"></i></div>';
          if(isPdf) content = '<div class="absolute inset-0 flex items-center justify-center text-red-500 text-3xl"><i class="bx bxs-file-pdf"></i></div>';

          const canDelete = currentUser && (currentUser.role === 'Gestor' || currentUser.name.includes('Thiago'));

          return `
          <div class="aspect-square bg-slate-100 rounded-lg overflow-hidden relative group border border-slate-200 cursor-pointer" onclick="window.openLightbox(${idx})">
              ${content}
              ${canDelete ? `<button onclick="event.stopPropagation(); deleteMedia('${os.id}','${key}')" class="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center shadow">&times;</button>` : ''}
          </div>
      `}).join('');
  };

  window.deleteMedia = (osId, key) => { if(confirm('Apagar imagem?')) db.ref(`serviceOrders/${osId}/media/${key}`).remove(); };
  
  window.openLightbox = (idx) => {
      currentLightboxIndex = idx;
      const m = lightboxMedia[idx];
      if(!m || !m.url) return;

      const content = document.getElementById('lightbox-content');
      const fileType = m.type || '';
      
      if(fileType.includes('image') || m.url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
          content.innerHTML = `<img src="${m.url}" class="max-w-full max-h-full object-contain rounded shadow-2xl">`;
      }
      else if(fileType.includes('video') || m.url.match(/\.(mp4|webm)$/i)) {
          content.innerHTML = `<video src="${m.url}" controls autoplay class="max-w-full max-h-full rounded shadow-2xl"></video>`;
      }
      else {
          window.open(m.url); 
          return;
      }

      const dlBtn = document.getElementById('lightbox-download');
      if(dlBtn) dlBtn.href = m.url;
      
      const lb = document.getElementById('lightbox');
      if(lb) {
          lb.classList.remove('hidden');
          lb.classList.add('flex');
      }
  };

  // --- ACTIONS FORM ---
  const logForm = document.getElementById('logForm');
  if(logForm) {
      logForm.onsubmit = async (e) => {
          e.preventDefault();
          const btn = e.target.querySelector('button[type="submit"]');
          const originalText = btn.innerHTML;
          btn.disabled = true; btn.innerHTML = 'Salvando...';
          
          const osId = document.getElementById('logOsId').value;
          
          try {
              if(filesToUpload.length) {
                  const res = await Promise.all(filesToUpload.map(f => uploadFileToCloudinary(f)));
                  res.forEach(r => db.ref(`serviceOrders/${osId}/media`).push(r));
              }
              
              const desc = document.getElementById('logDescricao').value;
              const parts = document.getElementById('logPecas').value;
              const val = document.getElementById('logValor').value;

              if(desc || parts || val) {
                  await db.ref(`serviceOrders/${osId}/logs`).push({
                      user: currentUser.name,
                      timestamp: new Date().toISOString(),
                      description: desc,
                      parts: parts,
                      value: val
                  });
              }
              
              showNotification('Atualizado!');
              e.target.reset();
              filesToUpload = []; 
              const fn = document.getElementById('fileName');
              if(fn) fn.innerText = '';
              
              const actions = document.getElementById('post-log-actions');
              if(actions) actions.classList.remove('hidden');
              
          } catch(err) {
              showNotification(err.message, 'error');
          } finally {
              btn.disabled = false; btn.innerHTML = originalText;
          }
      };
  }

  // Movimentação (Manual via Log)
  const moveStatus = (dir) => {
      const id = document.getElementById('logOsId').value;
      const os = allServiceOrders[id];
      if(!os) return;

      const idx = STATUS_LIST.indexOf(os.status);
      let newStatus = null;
      
      if(dir === 'next' && idx < STATUS_LIST.length - 1) newStatus = STATUS_LIST[idx + 1];
      if(dir === 'prev' && idx > 0) newStatus = STATUS_LIST[idx - 1];
      
      if(newStatus) {
          db.ref(`serviceOrders/${id}`).update({status: newStatus, lastUpdate: new Date().toISOString()});
          db.ref(`serviceOrders/${id}/logs`).push({
              user: currentUser.name,
              timestamp: new Date().toISOString(),
              description: `Status alterado: ${os.status} ➔ ${newStatus}`,
              type: 'status'
          });
          
          showNotification('Veículo movido!');
          const modal = document.getElementById('detailsModal');
          if(modal) modal.classList.add('hidden');
      }
  };
  
  const btnNext = document.getElementById('btn-move-next');
  const btnPrev = document.getElementById('btn-move-prev');
  const btnStay = document.getElementById('btn-stay');
  
  if(btnNext) btnNext.onclick = () => moveStatus('next');
  if(btnPrev) btnPrev.onclick = () => moveStatus('prev');
  if(btnStay) btnStay.onclick = () => document.getElementById('post-log-actions').classList.add('hidden');

  // --- ALERTA LED ---
  const updateAlerts = () => {
      const alertPanel = document.getElementById('attention-panel');
      const container = document.getElementById('attention-panel-container');
      const led = document.getElementById('alert-led');
      
      const alerts = Object.values(allServiceOrders).filter(o => 
          o.status === 'Aguardando-Mecanico' || o.status === 'Servico-Autorizado'
      );
      
      if(led) {
          if(alerts.length > 0) {
              led.classList.remove('hidden');
              led.classList.add('animate-ping');
          } else {
              led.classList.add('hidden');
          }
      }
      
      if(alertPanel) {
          alertPanel.innerHTML = alerts.map(o => `
              <div class="bg-slate-700 p-3 rounded border-l-4 ${o.status.includes('Mecanico') ? 'border-yellow-500' : 'border-green-500'} cursor-pointer hover:bg-slate-600 transition" onclick="window.openDetails('${o.id}')">
                  <p class="text-[10px] font-bold text-white uppercase opacity-70">${o.status.replace(/-/g,' ')}</p>
                  <div class="flex justify-between items-center text-white font-bold">
                      <span>${o.placa}</span> <span class="text-xs font-normal opacity-50">${o.modelo}</span>
                  </div>
              </div>
          `).join('');
      }
  };
  
  const toggleBtn = document.getElementById('toggle-panel-btn');
  if(toggleBtn) {
      toggleBtn.onclick = () => {
          const c = document.getElementById('attention-panel-container');
          if(c) c.style.maxHeight = c.style.maxHeight === '0px' || c.style.maxHeight === '' ? '300px' : '0px';
      };
  }

  // --- INPUTS MÍDIA ---
  const fileInp = document.getElementById('media-input');
  if(fileInp) {
      fileInp.onchange = (e) => {
          if(e.target.files.length) {
              filesToUpload = Array.from(e.target.files);
              const fn = document.getElementById('fileName');
              if(fn) fn.innerText = `${filesToUpload.length} arquivo(s) selecionado(s)`;
          }
      };
  }
  
  const camBtn = document.getElementById('openCameraBtn');
  const galBtn = document.getElementById('openGalleryBtn');
  
  if(camBtn) camBtn.onclick = () => { fileInp.setAttribute('capture','environment'); fileInp.click(); };
  if(galBtn) galBtn.onclick = () => { fileInp.removeAttribute('capture'); fileInp.click(); };

  // --- FECHAR MODAIS ---
  document.querySelectorAll('.btn-close-modal').forEach(b => b.onclick = (e) => {
      e.target.closest('.modal').classList.add('hidden');
      const lb = document.getElementById('lightbox');
      if(lb) lb.classList.add('hidden');
  });
  
  const lbClose = document.getElementById('lightbox-close');
  if(lbClose) lbClose.onclick = () => document.getElementById('lightbox').classList.add('hidden');
  
  const lbNext = document.getElementById('lightbox-next');
  if(lbNext) lbNext.onclick = () => { if(currentLightboxIndex < lightboxMedia.length-1) openLightbox(currentLightboxIndex+1); };
  
  const lbPrev = document.getElementById('lightbox-prev');
  if(lbPrev) lbPrev.onclick = () => { if(currentLightboxIndex > 0) openLightbox(currentLightboxIndex-1); };
  
  // --- NOVA OS ---
  const btnAddOS = document.getElementById('addOSBtn');
  if(btnAddOS) {
      btnAddOS.onclick = () => {
          document.getElementById('osForm').reset();
          const sel = document.getElementById('osResponsavel');
          const loginSel = document.getElementById('userSelect');
          if(sel && loginSel) sel.innerHTML = loginSel.innerHTML;
          document.getElementById('osModal').classList.remove('hidden');
          document.getElementById('osModal').classList.add('flex');
      };
  }
  
  const osForm = document.getElementById('osForm');
  if(osForm) {
      osForm.onsubmit = (e) => {
          e.preventDefault();
          const prioEl = document.querySelector('input[name="osPrioridade"]:checked');
          const prio = prioEl ? prioEl.value : 'verde';
          
          const respJson = document.getElementById('osResponsavel').value;
          let respName = 'Não Atribuído';
          try { if(respJson) respName = JSON.parse(respJson).name; } catch(e){}

          const newOS = {
              placa: document.getElementById('osPlaca').value.toUpperCase(),
              modelo: document.getElementById('osModelo').value,
              cliente: document.getElementById('osCliente').value,
              telefone: document.getElementById('osTelefone').value,
              km: document.getElementById('osKm').value,
              responsible: respName,
              observacoes: document.getElementById('osObservacoes').value,
              priority: prio,
              status: 'Aguardando-Mecanico',
              createdAt: new Date().toISOString()
          };
          
          db.ref('serviceOrders').push(newOS);
          document.getElementById('osModal').classList.add('hidden');
          showNotification('Nova Ficha Criada!');
      };
  }

  // --- BUSCA ---
  const searchInp = document.getElementById('globalSearchInput');
  if(searchInp) {
      searchInp.oninput = (e) => {
          const term = e.target.value.toUpperCase();
          const res = document.getElementById('globalSearchResults');
          
          if(term.length < 2) { res.classList.add('hidden'); return; }
          
          const found = Object.values(allServiceOrders).filter(o => 
              (o.placa && o.placa.includes(term)) || 
              (o.cliente && o.cliente.toUpperCase().includes(term)) || 
              (o.modelo && o.modelo.toUpperCase().includes(term))
          );
          
          if(found.length) {
              res.innerHTML = found.map(o => `
                  <div class="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-0 flex justify-between items-center" onclick="window.openDetails('${o.id}'); document.getElementById('globalSearchResults').classList.add('hidden')">
                      <div>
                          <p class="font-bold text-slate-800">${o.placa}</p>
                          <p class="text-xs text-slate-500">${o.modelo} • ${o.cliente}</p>
                      </div>
                      <span class="text-[10px] bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold">${o.status.replace(/-/g,' ')}</span>
                  </div>
              `).join('');
              res.classList.remove('hidden');
          } else {
              res.innerHTML = '<p class="p-3 text-center text-slate-400 text-xs">Nada encontrado.</p>';
              res.classList.remove('hidden');
          }
      };
  }
  
  const logoutBtn = document.getElementById('logoutButton');
  if(logoutBtn) logoutBtn.onclick = () => location.reload();
});
