/* ==================================================================
   DASHBOARD CENTER CAR MENECHELLI - V2.1 (MASTER)
   Desenvolvido por: thIAguinho Soluções
   ================================================================== */

// CONFIGURAÇÃO REAL DO FIREBASE (Extraída do seu ZIP)
const firebaseConfig = {
  apiKey: "AIzaSyDFbvRiLpUcXFJgVSwNobXi0fX_IceBK5k",
  authDomain: "centercarmenechelli-47e05.firebaseapp.com",
  databaseURL: "https://centercarmenechelli-47e05-default-rtdb.firebaseio.com",
  projectId: "centercarmenechelli-47e05",
  storageBucket: "centercarmenechelli-47e05.firebasestorage.app",
  messagingSenderId: "697435506647",
  appId: "1:697435506647:web:dce5cbf910f4960f732d92"
};

// --- VARIÁVEIS GLOBAIS ---
let activeCloudinaryConfig = null;
let currentUser = null;
let allServiceOrders = {};
let allUsers = [];
let lightboxMedia = [];
let currentLightboxIndex = 0;
let filesToUpload = [];

// --- SISTEMA DE NOTIFICAÇÕES ---
function showNotification(message, type = 'success') {
  const existing = document.getElementById('notification');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.id = 'notification';
  div.className = `fixed top-5 right-5 z-[200] px-4 py-3 rounded-lg shadow-xl text-white font-bold transform transition-all duration-300 translate-x-full ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`;
  div.innerText = message;
  document.body.appendChild(div);
  requestAnimationFrame(() => div.classList.remove('translate-x-full'));
  setTimeout(() => div.remove(), 4000);
}

// --- CLOUDINARY UPLOAD ---
const uploadFileToCloudinary = async (file) => {
  if (!activeCloudinaryConfig) throw new Error('Configure a Mídia na Engrenagem!');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', activeCloudinaryConfig.uploadPreset);
  
  const res = await fetch(`https://api.cloudinary.com/v1_1/${activeCloudinaryConfig.cloudName}/auto/upload`, {
      method: 'POST', body: formData
  });
  if (!res.ok) throw new Error('Falha no Upload');
  const data = await res.json();
  return { url: data.secure_url, type: data.resource_type };
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  const STATUS_LIST = [ 'Aguardando-Mecanico', 'Em-Analise', 'Orcamento-Enviado', 'Aguardando-Aprovacao', 'Servico-Autorizado', 'Em-Execucao', 'Finalizado-Aguardando-Retirada', 'Entregue' ];

  // 1. CARREGAR/CRIAR USUÁRIOS
  const usersRef = db.ref('users');
  usersRef.on('value', snapshot => {
      const data = snapshot.val();
      const select = document.getElementById('userSelect');
      select.innerHTML = '<option value="">Selecione...</option>';
      allUsers = [];

      // Se não tiver usuários, cria o Admin Padrão
      if (!data) {
          const master = { name: 'Thiago Ventura Valencio', role: 'Gestor', password: 'dev' };
          usersRef.push(master);
          return;
      }

      Object.entries(data).forEach(([key, user]) => {
          user.id = key;
          allUsers.push(user);
          const opt = document.createElement('option');
          opt.value = user.id;
          opt.textContent = user.name;
          select.appendChild(opt);
      });
      renderAdminUserList();
  });

  // 2. CARREGAR CONFIG MÍDIA
  db.ref('cloudinaryConfigs').limitToLast(1).on('value', snap => {
      const val = snap.val();
      if(val) activeCloudinaryConfig = Object.values(val)[0];
  });

  // 3. LOGIN
  document.getElementById('loginForm').onsubmit = (e) => {
      e.preventDefault();
      const userId = document.getElementById('userSelect').value;
      const pass = document.getElementById('passwordInput').value;
      const user = allUsers.find(u => u.id === userId);

      if (user && user.password === pass) {
          loginUser(user);
      } else {
          document.getElementById('loginError').textContent = "Senha Incorreta!";
      }
  };

  const loginUser = (user) => {
      currentUser = user;
      document.getElementById('userScreen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      document.getElementById('app').classList.add('flex');
      document.getElementById('currentUserName').textContent = user.name;

      // REGRA MESTRE: Se for Thiago ou Gestor, libera Admin
      if (user.role === 'Gestor' || user.name === 'Thiago Ventura Valencio') {
          document.getElementById('adminControls').classList.remove('hidden');
          document.getElementById('adminControls').classList.add('flex');
      }

      initKanban();
      listenOS();
  };

  // 4. KANBAN (BOARD)
  const initKanban = () => {
      const board = document.getElementById('kanbanBoard');
      board.innerHTML = STATUS_LIST.map(status => `
        <div class="status-column">
            <div class="p-3 bg-gray-200 rounded-t-xl flex justify-between font-bold text-gray-700 text-sm uppercase">
                <span>${status.replace(/-/g, ' ')}</span>
                <span class="bg-white px-2 rounded-full" id="count-${status}">0</span>
            </div>
            <div class="vehicle-list space-y-3" id="col-${status}"></div>
        </div>
      `).join('');
  };

  // 5. ESCUTAR ORDENS DE SERVIÇO
  const listenOS = () => {
      db.ref('serviceOrders').on('value', snap => {
          const data = snap.val() || {};
          allServiceOrders = data;
          
          // Limpa colunas
          STATUS_LIST.forEach(s => {
              document.getElementById(`col-${s}`).innerHTML = '';
              document.getElementById(`count-${s}`).innerText = '0';
          });

          // Popula colunas
          Object.entries(data).forEach(([id, os]) => {
              os.id = id;
              const col = document.getElementById(`col-${os.status}`);
              if(col) col.innerHTML += createCard(os);
          });

          // Atualiza contadores
          STATUS_LIST.forEach(s => {
              document.getElementById(`count-${s}`).innerText = document.getElementById(`col-${s}`).children.length;
          });
          
          updateAlerts();
      });
  };

  const createCard = (os) => {
      const priorityClass = os.priority === 'vermelho' ? 'border-red-500 bg-red-50' : 
                            os.priority === 'amarelo' ? 'border-yellow-500' : 'border-l-4';
      return `
      <div class="vehicle-card status-${os.status} ${priorityClass}" onclick="openDetails('${os.id}')">
          <div class="flex justify-between font-black text-gray-800 text-lg">
              ${os.placa}
              ${os.priority === 'vermelho' ? '<i class="bx bxs-flame text-red-600 animate-pulse"></i>' : ''}
          </div>
          <div class="text-xs font-bold text-blue-700 uppercase">${os.modelo}</div>
          <div class="text-xs text-gray-500 mt-1">${os.cliente}</div>
      </div>`;
  };

  // 6. DETALHES E FUNÇÕES
  window.openDetails = (id) => {
      const os = allServiceOrders[id];
      if(!os) return;
      
      document.getElementById('logOsId').value = id;
      document.getElementById('detailsHeader').innerHTML = `
          <h1 class="text-3xl font-black">${os.placa}</h1>
          <p class="text-lg text-blue-700 font-bold">${os.modelo}</p>
          <p class="text-sm text-gray-500">Cliente: ${os.cliente} | Tel: ${os.telefone}</p>
          <p class="text-xs text-gray-400 mt-1">Responsável: ${os.responsible}</p>
      `;
      
      if(os.observacoes) {
          document.getElementById('detailsObservacoes').innerHTML = `<strong>Queixa:</strong> ${os.observacoes}`;
          document.getElementById('detailsObservacoes').classList.remove('hidden');
      }

      // Botão Excluir (Só Admin/Thiago)
      const isMaster = currentUser.role === 'Gestor' || currentUser.name === 'Thiago Ventura Valencio';
      const delBtn = document.getElementById('deleteOsBtn');
      if(isMaster) {
          delBtn.classList.remove('hidden');
          delBtn.onclick = () => {
              if(confirm('Tem certeza? Isso apaga tudo desta OS.')) {
                  db.ref(`serviceOrders/${id}`).remove();
                  document.getElementById('detailsModal').classList.add('hidden');
              }
          };
      } else {
          delBtn.classList.add('hidden');
      }

      // Impressão da Ficha
      document.getElementById('exportOsBtn').onclick = () => {
          const printWindow = window.open('', '_blank');
          printWindow.document.write(`
            <html><head><title>Ficha ${os.placa}</title>
            <link href="https://cdn.tailwindcss.com" rel="stylesheet">
            </head><body class="p-8">
            <h1 class="text-2xl font-bold">Center Car Menechelli</h1>
            <h2 class="text-xl mt-4">Ordem de Serviço: ${os.placa}</h2>
            <p><strong>Veículo:</strong> ${os.modelo}</p>
            <p><strong>Cliente:</strong> ${os.cliente}</p>
            <p><strong>Reclamação:</strong> ${os.observacoes}</p>
            <hr class="my-4">
            <h3 class="font-bold">Histórico</h3>
            ${os.logs ? Object.values(os.logs).map(l => `<p class="text-sm border-b py-1"><strong>${l.user}:</strong> ${l.description} ${l.parts ? `(Peças: ${l.parts})` : ''}</p>`).join('') : '<p>Sem histórico</p>'}
            <script>setTimeout(() => window.print(), 500);</script>
            </body></html>
          `);
          printWindow.document.close();
      };

      renderTimeline(os);
      renderGallery(os);
      document.getElementById('detailsModal').classList.remove('hidden');
      document.getElementById('detailsModal').classList.add('flex');
  };

  const renderTimeline = (os) => {
      const container = document.getElementById('timelineContainer');
      if (!os.logs) { container.innerHTML = '<p class="text-gray-400 text-center">Sem histórico</p>'; return; }
      
      // Ordena logs por data (mais novo primeiro)
      const logs = Object.entries(os.logs).sort((a,b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
      
      const isMaster = currentUser.role === 'Gestor' || currentUser.name === 'Thiago Ventura Valencio';

      container.innerHTML = logs.map(([key, log]) => `
          <div class="border-l-2 border-gray-200 pl-4 pb-4 relative">
              <div class="w-3 h-3 bg-blue-500 rounded-full absolute -left-[7px] top-0"></div>
              <div class="flex justify-between">
                  <span class="font-bold text-xs text-blue-900">${log.user}</span>
                  <span class="text-[10px] text-gray-400">${new Date(log.timestamp).toLocaleString()}</span>
              </div>
              <p class="text-sm text-gray-700">${log.description}</p>
              ${log.parts ? `<p class="text-xs text-gray-500 bg-gray-50 p-1 mt-1 rounded">🔧 ${log.parts}</p>` : ''}
              
              ${isMaster ? `<button onclick="deleteLog('${os.id}', '${key}')" class="text-red-400 text-[10px] hover:underline mt-1">Apagar Registro</button>` : ''}
          </div>
      `).join('');
  };
  
  // Função Global para apagar log
  window.deleteLog = (osId, logKey) => {
      if(confirm('Apagar este registro do histórico?')) db.ref(`serviceOrders/${osId}/logs/${logKey}`).remove();
  };

  const renderGallery = (os) => {
      const grid = document.getElementById('thumbnail-grid');
      if(!os.media) { grid.innerHTML = '<p class="col-span-full text-center text-gray-400">Sem fotos</p>'; return; }
      
      const isMaster = currentUser.role === 'Gestor' || currentUser.name === 'Thiago Ventura Valencio';
      
      grid.innerHTML = Object.entries(os.media).map(([key, m]) => `
          <div class="relative group aspect-square bg-gray-100 rounded overflow-hidden">
              <img src="${m.url}" class="w-full h-full object-cover cursor-pointer" onclick="window.open('${m.url}')">
              ${isMaster ? `<button onclick="deleteMedia('${os.id}', '${key}')" class="absolute top-0 right-0 bg-red-600 text-white w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">&times;</button>` : ''}
          </div>
      `).join('');
  };
  
  window.deleteMedia = (osId, key) => {
      if(confirm('Apagar esta foto?')) db.ref(`serviceOrders/${osId}/media/${key}`).remove();
  };

  // 7. GESTÃO DE USUÁRIOS (ADMIN)
  const renderAdminUserList = () => {
      const list = document.getElementById('usersList');
      if(!list) return;
      list.innerHTML = allUsers.map(u => `
          <div class="flex justify-between items-center bg-gray-50 p-2 rounded border">
              <div><span class="font-bold">${u.name}</span> <span class="text-xs text-gray-500">(${u.role})</span></div>
              ${u.name !== 'Thiago Ventura Valencio' ? `<button onclick="removeUser('${u.id}')" class="text-red-500"><i class='bx bxs-trash'></i></button>` : ''}
          </div>
      `).join('');
  };
  
  window.removeUser = (id) => db.ref(`users/${id}`).remove();

  // 8. LOGS E UPLOADS
  document.getElementById('logForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true; btn.innerText = "Salvando...";
      const osId = document.getElementById('logOsId').value;
      
      try {
          if(filesToUpload.length > 0) {
              const uploads = filesToUpload.map(f => uploadFileToCloudinary(f));
              const res = await Promise.all(uploads);
              res.forEach(r => db.ref(`serviceOrders/${osId}/media`).push({ url: r.url, timestamp: new Date().toISOString() }));
          }
          
          db.ref(`serviceOrders/${osId}/logs`).push({
              user: currentUser.name,
              timestamp: new Date().toISOString(),
              description: document.getElementById('logDescricao').value,
              parts: document.getElementById('logPecas').value,
              value: document.getElementById('logValor').value
          });
          
          e.target.reset(); filesToUpload = []; showNotification('Atualizado!');
      } catch(err) { alert(err.message); }
      btn.disabled = false; btn.innerHTML = "<i class='bx bx-send'></i> Registrar";
  };

  // Helpers de Mídia e Modais
  const mediaInput = document.getElementById('media-input');
  mediaInput.onchange = (e) => { if(e.target.files.length) { filesToUpload = Array.from(e.target.files); document.getElementById('fileName').innerText = `${filesToUpload.length} arquivos`; } };
  document.getElementById('openCameraBtn').onclick = () => mediaInput.click();
  document.getElementById('openGalleryBtn').onclick = () => mediaInput.click();
  
  document.getElementById('adminBtn').onclick = () => { document.getElementById('adminModal').classList.remove('hidden'); document.getElementById('adminModal').classList.add('flex'); };
  
  // Tabs Admin
  document.querySelectorAll('.admin-tab').forEach(t => t.onclick = () => {
      document.querySelectorAll('.admin-tab').forEach(x => x.classList.remove('active', 'border-blue-600', 'text-blue-600'));
      t.classList.add('active', 'border-blue-600', 'text-blue-600');
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById(t.dataset.target).classList.remove('hidden');
  });

  // Salvar Novo Usuário
  document.getElementById('addUserForm').onsubmit = (e) => {
      e.preventDefault();
      db.ref('users').push({
          name: document.getElementById('newUserName').value,
          role: document.getElementById('newUserRole').value,
          password: document.getElementById('newUserPass').value
      });
      e.target.reset(); showNotification('Usuário Criado!');
  };

  // Salvar Cloudinary
  document.getElementById('cloudinaryForm').onsubmit = (e) => {
      e.preventDefault();
      db.ref('cloudinaryConfigs').push({
          cloudName: document.getElementById('cloudNameInput').value,
          uploadPreset: document.getElementById('uploadPresetInput').value,
          updatedBy: currentUser.name
      });
      showNotification('Configuração Salva!');
  };

  // Salvar Nova OS
  document.getElementById('addOSBtn').onclick = () => {
      document.getElementById('osForm').reset();
      const sel = document.getElementById('osResponsavel');
      sel.innerHTML = '<option value="">Selecione...</option>' + allUsers.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
      document.getElementById('osModal').classList.remove('hidden'); document.getElementById('osModal').classList.add('flex');
  };
  
  document.getElementById('osForm').onsubmit = (e) => {
      e.preventDefault();
      db.ref('serviceOrders').push({
          placa: document.getElementById('osPlaca').value.toUpperCase(),
          modelo: document.getElementById('osModelo').value,
          cliente: document.getElementById('osCliente').value,
          telefone: document.getElementById('osTelefone').value,
          km: document.getElementById('osKm').value,
          responsible: document.getElementById('osResponsavel').value,
          observacoes: document.getElementById('osObservacoes').value,
          priority: document.querySelector('input[name="osPrioridade"]:checked').value,
          status: 'Aguardando-Mecanico',
          createdAt: new Date().toISOString()
      });
      document.getElementById('osModal').classList.add('hidden');
  };

  // Relatórios
  document.getElementById('reportsBtn').onclick = () => { document.getElementById('reportsModal').classList.remove('hidden'); document.getElementById('reportsModal').classList.add('flex'); };
  
  document.getElementById('reportsForm').onsubmit = (e) => {
      e.preventDefault();
      const start = new Date(document.getElementById('startDate').value);
      const end = new Date(document.getElementById('endDate').value);
      const list = Object.values(allServiceOrders).filter(o => {
          const d = new Date(o.createdAt);
          return d >= start && d <= end && o.status === 'Entregue';
      });
      
      const container = document.getElementById('reportsResultContainer');
      if(list.length === 0) { container.innerHTML = '<p class="p-4 text-center">Nenhum veículo entregue no período.</p>'; return; }
      
      container.innerHTML = list.map(o => `<div class="p-2 border-b flex justify-between"><span>${o.placa} - ${o.modelo}</span> <span>${new Date(o.createdAt).toLocaleDateString()}</span></div>`).join('');
      
      const pdfBtn = document.getElementById('exportReportBtn');
      pdfBtn.classList.remove('hidden');
      pdfBtn.onclick = () => {
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          doc.text("Relatório de Entregas - Center Car Menechelli", 10, 10);
          let y = 20;
          list.forEach(o => { doc.text(`${o.placa} - ${o.modelo} (${o.cliente})`, 10, y); y += 10; });
          doc.save("relatorio.pdf");
      };
  };

  // Painel Alertas
  const updateAlerts = () => {
      const panel = document.getElementById('attention-panel');
      const alerts = Object.values(allServiceOrders).filter(o => o.status === 'Aguardando-Mecanico' || o.status === 'Servico-Autorizado');
      if(alerts.length > 0) document.getElementById('alert-led').classList.remove('hidden');
      else document.getElementById('alert-led').classList.add('hidden');
      
      panel.innerHTML = alerts.map(o => `
          <div class="bg-gray-800 text-white p-2 rounded text-xs border border-red-500 cursor-pointer" onclick="openDetails('${o.id}')">
              <strong>${o.status.replace(/-/g,' ')}:</strong> ${o.placa}
          </div>
      `).join('');
  };
  
  document.getElementById('toggle-panel-btn').onclick = () => {
      const p = document.getElementById('attention-panel-container');
      p.style.maxHeight = p.style.maxHeight === '300px' ? '0' : '300px';
  };

  document.querySelectorAll('.btn-close-modal').forEach(b => b.onclick = (e) => e.target.closest('.modal').classList.add('hidden'));
});
