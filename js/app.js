/* ==================================================================
   DASHBOARD CENTER CAR MENECHELLI - SISTEMA DE GESTÃO V2.1
   Desenvolvido por: thIAguinho Soluções
   ================================================================== */

// CONFIGURAÇÃO FIREBASE (Center Car Menechelli - CHAVES REAIS EXTRAÍDAS DO ZIP)
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
let appStartTime = Date.now();

// --- SISTEMA DE NOTIFICAÇÕES (TOAST) ---
function showNotification(message, type = 'success') {
  const existing = document.getElementById('notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.id = 'notification';
  notification.className = `fixed top-5 right-5 z-[200] px-4 py-3 rounded-lg shadow-lg text-white font-medium transform transition-all duration-300 translate-x-full ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`;
  notification.innerHTML = `<div class="flex items-center gap-2"><i class='bx ${type === 'success' ? 'bx-check-circle' : 'bx-error-circle'} text-xl'></i> ${message}</div>`;
  
  document.body.appendChild(notification);
  requestAnimationFrame(() => notification.classList.remove('translate-x-full'));
  setTimeout(() => {
    notification.classList.add('translate-x-full');
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// --- INTEGRAÇÃO CLOUDINARY (Upload) ---
const uploadFileToCloudinary = async (file) => {
  if (!activeCloudinaryConfig) {
    throw new Error('Mídia não configurada. Vá em Configurações (Engrenagem) > Mídia.');
  }

  const { cloudName, uploadPreset } = activeCloudinaryConfig;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error.message || 'Falha no upload.');
    }

    const data = await response.json();
    return { url: data.secure_url, configKey: activeCloudinaryConfig.key };
  } catch (error) {
    console.error("Erro Cloudinary:", error);
    throw error;
  }
};

// --- INICIALIZAÇÃO DO APP ---
document.addEventListener('DOMContentLoaded', () => {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  const STATUS_LIST = [ 'Aguardando-Mecanico', 'Em-Analise', 'Orcamento-Enviado', 'Aguardando-Aprovacao', 'Servico-Autorizado', 'Em-Execucao', 'Finalizado-Aguardando-Retirada', 'Entregue' ];
  const ATTENTION_STATUSES = { 
      'Aguardando-Mecanico': { label: 'AGUARDANDO MECÂNICO', colorClass: 'text-yellow-400', borderClass: 'border-yellow-500', blink: true }, 
      'Servico-Autorizado': { label: 'SERVIÇO AUTORIZADO', colorClass: 'text-green-400', borderClass: 'border-green-500', blink: true } 
  };

  // --- GERENCIAMENTO DE USUÁRIOS (FIREBASE) ---
  const usersRef = db.ref('users');
  usersRef.on('value', snapshot => {
      const data = snapshot.val();
      const userSelect = document.getElementById('userSelect');
      userSelect.innerHTML = '<option value="">Selecione seu usuário...</option>';
      allUsers = [];

      if (!data) {
          // Cria usuário padrão Mestre se não existir nenhum
          const defaultAdmin = { name: 'Thiago Ventura Valencio', role: 'Gestor', password: '1940' }; // Senha original do ZIP
          usersRef.push(defaultAdmin);
          return;
      }

      Object.entries(data).forEach(([key, user]) => {
          user.id = key; 
          allUsers.push(user);
          const opt = document.createElement('option');
          opt.value = user.id; 
          opt.textContent = `${user.name}`;
          userSelect.appendChild(opt);
      });
      
      renderAdminUsersList();
  });

  const renderAdminUsersList = () => {
      const list = document.getElementById('usersList');
      if(!list) return;
      list.innerHTML = allUsers.map(u => `
        <div class="flex justify-between items-center bg-white p-2 border rounded shadow-sm">
            <div>
                <p class="font-bold text-sm">${u.name}</p>
                <p class="text-xs text-gray-500">${u.role} | Senha: ${u.password}</p>
            </div>
            ${u.name !== 'Thiago Ventura Valencio' ? `<button onclick="removeUser('${u.id}')" class="text-red-500 hover:bg-red-50 p-1 rounded"><i class='bx bxs-trash'></i></button>` : ''}
        </div>
      `).join('');
  };

  window.removeUser = (id) => {
      if(confirm('Remover este usuário?')) {
          db.ref(`users/${id}`).remove();
      }
  };

  document.getElementById('addUserForm').onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('newUserName').value;
      const role = document.getElementById('newUserRole').value;
      const pass = document.getElementById('newUserPass').value;
      
      if(name && pass) {
          db.ref('users').push({ name, role, password: pass });
          e.target.reset();
          showNotification('Usuário adicionado!');
      }
  };

  // --- LOGIN ---
  document.getElementById('loginForm').onsubmit = (e) => {
      e.preventDefault();
      const userId = document.getElementById('userSelect').value;
      const pass = document.getElementById('passwordInput').value;
      
      const user = allUsers.find(u => u.id === userId);
      
      if (user && user.password === pass) {
          loginUser(user);
      } else {
          document.getElementById('loginError').textContent = "Senha incorreta.";
      }
  };

  const loginUser = (user) => {
    localStorage.setItem('centerCarSession', JSON.stringify({ user, loginTime: new Date().toISOString() }));
    currentUser = user;
    
    document.getElementById('currentUserName').textContent = user.name;
    document.getElementById('userScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('app').classList.add('flex');
    
    initializeKanban();
    listenToServiceOrders();
    listenToNotifications();
    listenToCloudinaryConfigs();
    
    // PERMISSÕES ESPECIAIS (THIAGO = MASTER)
    if (user.role === 'Gestor' || user.name === 'Thiago Ventura Valencio') {
      document.getElementById('adminBtn').classList.remove('hidden');
      document.getElementById('reportsBtn').classList.remove('hidden');
    } else {
      document.getElementById('adminBtn').classList.add('hidden');
      document.getElementById('reportsBtn').classList.add('hidden');
    }
  };

  // --- KANBAN BOARD (LAYOUT CORRIGIDO - Flex + Width Fixo) ---
  const initializeKanban = () => {
    const board = document.getElementById('kanbanBoard');
    const collapsedState = JSON.parse(localStorage.getItem('collapsedColumnsMenechelli')) || {};
    
    board.innerHTML = STATUS_LIST.map(status => {
      const isCollapsed = collapsedState[status];
      const formatStatus = status.replace(/-/g, ' ');
      
      return `
        <div class="flex-shrink-0 w-[85vw] sm:w-[320px] flex flex-col h-full bg-gray-200 rounded-xl shadow-inner border border-gray-300 snap-center transition-all duration-300">
            <div class="p-3 bg-gray-300 rounded-t-xl flex justify-between items-center cursor-pointer select-none toggle-column-header hover:bg-gray-400 transition-colors" data-status="${status}">
                <div class="flex items-center gap-2 overflow-hidden">
                    <div class="w-3 h-3 flex-shrink-0 rounded-full ${getStatusColor(status)}"></div>
                    <h3 class="font-bold text-gray-700 text-xs sm:text-sm uppercase tracking-wide truncate">${formatStatus}</h3>
                    <span class="bg-white text-xs font-bold px-2 py-0.5 rounded-full text-gray-600 shadow-sm flex-shrink-0" id="count-${status}">0</span>
                </div>
                <i class='bx bxs-chevron-down transition-transform ${isCollapsed ? 'rotate-180' : ''}'></i>
            </div>
            
            ${status === 'Entregue' ? '<div class="px-2 pt-2"><input type="text" class="w-full p-2 text-xs rounded border border-gray-300 search-delivered focus:ring-2 focus:ring-blue-400 outline-none" placeholder="Filtrar..."></div>' : ''}

            <div class="flex-grow p-2 overflow-y-auto custom-scrollbar space-y-3 transition-all duration-300 vehicle-list ${isCollapsed ? 'hidden' : ''}" id="col-${status}" data-status="${status}">
                <!-- Cards Inseridos Aqui -->
            </div>
        </div>`;
    }).join('');
    
    // Toggle Colunas
    document.querySelectorAll('.toggle-column-header').forEach(header => {
        header.addEventListener('click', () => {
            const status = header.dataset.status;
            const list = document.getElementById(`col-${status}`);
            const icon = header.querySelector('i');
            list.classList.toggle('hidden');
            icon.classList.toggle('rotate-180');
            const state = JSON.parse(localStorage.getItem('collapsedColumnsMenechelli')) || {};
            state[status] = list.classList.contains('hidden');
            localStorage.setItem('collapsedColumnsMenechelli', JSON.stringify(state));
        });
    });
  };

  const getStatusColor = (status) => {
      const colors = { 'Aguardando-Mecanico': 'bg-yellow-500', 'Servico-Autorizado': 'bg-green-500', 'Em-Execucao': 'bg-red-600', 'Entregue': 'bg-gray-500' };
      return colors[status] || 'bg-blue-500';
  };

  // --- RENDERIZAÇÃO DE DADOS ---
  const listenToServiceOrders = () => {
    db.ref('serviceOrders').on('value', snapshot => {
        allServiceOrders = {}; 
        const data = snapshot.val();
        
        STATUS_LIST.forEach(s => {
            const col = document.getElementById(`col-${s}`);
            if(col) col.innerHTML = '';
            document.getElementById(`count-${s}`).textContent = '0';
        });

        if (data) {
            Object.entries(data).forEach(([id, os]) => {
                os.id = id;
                allServiceOrders[id] = os;
                const col = document.getElementById(`col-${os.status}`);
                if (col) {
                    col.insertAdjacentHTML('afterbegin', createCardElement(os));
                }
            });
            STATUS_LIST.forEach(s => {
                const count = document.getElementById(`col-${s}`).children.length;
                document.getElementById(`count-${s}`).textContent = count;
            });
        }
        updateAttentionPanel();
    });
  };

  const createCardElement = (os) => {
      const priorityColors = { 'vermelho': 'bg-red-500', 'amarelo': 'bg-yellow-500', 'verde': 'hidden' };
      return `
      <div class="bg-white p-4 rounded-lg shadow-sm border-l-4 ${getBorderColor(os.status)} cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all relative group card-item" onclick="openDetails('${os.id}')">
          <div class="absolute top-3 right-3 w-3 h-3 rounded-full ${priorityColors[os.priority] || 'hidden'} shadow-sm animate-pulse" title="Prioridade"></div>
          <div class="flex justify-between items-start mb-2 pr-4">
              <span class="font-black text-gray-800 text-lg tracking-tight leading-none">${os.placa}</span>
          </div>
          <div class="text-xs font-bold text-blue-800 uppercase mb-1.5 truncate tracking-wide">${os.modelo}</div>
          <div class="text-xs text-gray-500 truncate flex items-center gap-1"><i class='bx bxs-user text-gray-400'></i> ${os.cliente}</div>
          ${os.km ? `<div class="mt-3 inline-block bg-gray-100 px-2 py-1 rounded text-[10px] font-mono text-gray-600 border border-gray-200">KM: ${os.km}</div>` : ''}
          
          <div class="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity md:flex hidden">
               <button class="bg-gray-100 hover:bg-gray-200 p-1.5 rounded-md text-gray-600 shadow-sm" onclick="event.stopPropagation(); quickMove('${os.id}', 'prev')" title="Voltar"><i class='bx bx-chevron-left'></i></button>
               <button class="bg-gray-100 hover:bg-gray-200 p-1.5 rounded-md text-gray-600 shadow-sm" onclick="event.stopPropagation(); quickMove('${os.id}', 'next')" title="Avançar"><i class='bx bx-chevron-right'></i></button>
          </div>
      </div>`;
  };

  const getBorderColor = (status) => {
      const borders = { 'Aguardando-Mecanico': 'border-yellow-500', 'Servico-Autorizado': 'border-green-500', 'Em-Execucao': 'border-red-600', 'Entregue': 'border-gray-500' };
      return borders[status] || 'border-blue-400';
  };

  const updateAttentionPanel = () => {
      const panel = document.getElementById('attention-panel');
      const led = document.getElementById('alert-led');
      let hasAlerts = false;
      
      panel.innerHTML = Object.entries(ATTENTION_STATUSES).map(([status, config]) => {
          const vehicles = Object.values(allServiceOrders).filter(os => os.status === status);
          if (vehicles.length > 0) hasAlerts = true;
          
          const list = vehicles.length > 0 
              ? vehicles.map(os => `<div class="cursor-pointer hover:bg-white/10 p-1.5 rounded flex justify-between items-center transition-colors border-b border-gray-700 last:border-0" onclick="openDetails('${os.id}')"><span class="font-mono">${os.placa}</span> <span class="text-gray-400 text-[10px] uppercase">${os.modelo}</span></div>`).join('')
              : '<div class="text-gray-500 text-center italic text-xs py-2">Nenhum veículo</div>';

          return `
          <div class="bg-gray-800 rounded-lg p-3 border ${config.borderClass} ${vehicles.length > 0 && config.blink ? 'animate-pulse-border' : ''}">
              <h4 class="${config.colorClass} font-black text-xs text-center mb-2 uppercase tracking-widest border-b border-gray-700 pb-2">${config.label}</h4>
              <div class="text-white text-xs max-h-32 overflow-y-auto space-y-1 custom-scrollbar">${list}</div>
          </div>`;
      }).join('');
      
      if(led) led.style.display = hasAlerts ? 'block' : 'none';
  };

  // --- ACTIONS ---
  window.quickMove = (id, direction) => {
      const os = allServiceOrders[id];
      const idx = STATUS_LIST.indexOf(os.status);
      let newStatus = null;
      if (direction === 'next' && idx < STATUS_LIST.length - 1) newStatus = STATUS_LIST[idx + 1];
      if (direction === 'prev' && idx > 0) newStatus = STATUS_LIST[idx - 1];
      if (newStatus) db.ref(`serviceOrders/${id}`).update({ status: newStatus });
  };

  window.openDetails = (id) => {
      const os = allServiceOrders[id];
      if (!os) return;
      document.getElementById('logOsId').value = id;
      
      document.getElementById('detailsHeader').innerHTML = `
        <div class="flex-1">
            <div class="flex items-center gap-3 mb-1">
                <span class="bg-blue-900 text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">OS #${id.slice(-4)}</span>
                <span class="text-xs font-medium text-gray-500"><i class='bx bx-time'></i> ${new Date(os.createdAt).toLocaleDateString()}</span>
            </div>
            <h1 class="text-3xl font-black text-gray-900 tracking-tight">${os.placa}</h1>
            <p class="text-lg text-blue-700 font-bold uppercase">${os.modelo}</p>
            <p class="text-sm text-gray-600 mt-1 flex items-center gap-1"><i class='bx bxs-user'></i> ${os.cliente}</p>
        </div>
        <div class="text-right flex flex-col items-end gap-2">
            <div class="bg-gray-100 px-3 py-1 rounded-lg border border-gray-200">
                <p class="text-xs text-gray-500 uppercase font-bold">Quilometragem</p>
                <p class="text-xl font-mono font-bold text-gray-800">${os.km || 0} KM</p>
            </div>
            <p class="text-xs text-gray-400">Técnico: <strong class="text-gray-600">${os.responsible}</strong></p>
        </div>
      `;
      
      const obsDiv = document.getElementById('detailsObservacoes');
      if (os.observacoes) {
          obsDiv.innerHTML = `<div class="bg-red-50 border-l-4 border-red-400 p-3 rounded-r text-gray-700"><strong class="block text-red-700 text-xs uppercase mb-1">Queixa Principal:</strong>${os.observacoes}</div>`;
          obsDiv.classList.remove('hidden');
      } else {
          obsDiv.classList.add('hidden');
      }
      
      // Controle do Botão Excluir (Só Gestor/Desenvolvedor/Thiago)
      const delBtn = document.getElementById('deleteOsBtn');
      if (currentUser.role === 'Gestor' || currentUser.name === 'Thiago Ventura Valencio') {
          delBtn.classList.remove('hidden');
      } else {
          delBtn.classList.add('hidden');
      }

      renderTimeline(os);
      renderMediaGallery(os);
      document.getElementById('detailsModal').classList.remove('hidden');
      document.getElementById('detailsModal').classList.add('flex');
  };

  const renderTimeline = (os) => {
      const container = document.getElementById('timelineContainer');
      const logs = os.logs ? Object.values(os.logs).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)) : [];
      
      if (logs.length === 0) {
          container.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm italic bg-gray-50 rounded-lg border border-dashed border-gray-300">Nenhum histórico registrado</div>';
          return;
      }
      
      container.innerHTML = logs.map(log => {
          const date = new Date(log.timestamp);
          const isStatus = log.type === 'status';
          return `
          <div class="relative pl-6 pb-6 border-l-2 border-gray-200 last:pb-0 last:border-0">
              <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full ${isStatus ? 'bg-yellow-400 ring-4 ring-white' : 'bg-blue-500 ring-4 ring-white'}"></div>
              <div class="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:bg-white hover:shadow-sm transition-all">
                  <div class="flex justify-between items-start mb-1">
                      <span class="font-bold text-xs text-gray-700 uppercase tracking-wide">${log.user}</span>
                      <span class="text-[10px] text-gray-400">${date.toLocaleDateString()} ${date.toLocaleTimeString().slice(0,5)}</span>
                  </div>
                  <p class="text-sm text-gray-800 ${isStatus ? 'font-bold text-yellow-700' : ''}">${log.description}</p>
                  ${log.parts ? `<div class="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600 flex gap-2"><i class='bx bxs-wrench'></i> <span>${log.parts}</span></div>` : ''}
                  ${log.value ? `<div class="mt-1 text-xs font-bold text-green-600 flex gap-2"><i class='bx bxs-dollar-circle'></i> <span>R$ ${log.value}</span></div>` : ''}
              </div>
          </div>`;
      }).join('');
  };

  const renderMediaGallery = (os) => {
      const grid = document.getElementById('thumbnail-grid');
      const media = os.media ? Object.values(os.media) : [];
      lightboxMedia = media;
      
      if (media.length === 0) {
          grid.innerHTML = '<div class="col-span-full text-center py-6 text-gray-400 text-xs bg-gray-50 rounded-lg border border-dashed border-gray-300">Sem fotos ou vídeos</div>';
          return;
      }
      
      grid.innerHTML = media.map((item, idx) => {
          const isVideo = item.type && item.type.startsWith('video');
          const isPdf = item.type && item.type.includes('pdf');
          let thumb = item.url;
          let icon = '';
          
          if(isVideo) {
              thumb = ''; 
              icon = '<i class="bx bx-play-circle text-4xl text-white opacity-80"></i>';
          } else if(isPdf) {
              thumb = '';
              icon = '<i class="bx bxs-file-pdf text-4xl text-red-500"></i>';
          }

          // Botão Delete (Gestor/Desenvolvedor/Thiago)
          const canDelete = currentUser && (currentUser.role === 'Gestor' || currentUser.name === 'Thiago Ventura Valencio');

          return `
          <div class="relative aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer group shadow-sm hover:shadow-md transition-all border border-gray-200" onclick="openLightbox(${idx})">
              ${thumb ? `<img src="${thumb}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">` : `<div class="w-full h-full flex items-center justify-center bg-gray-100">${icon}</div>`}
              ${isVideo && thumb ? `<div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">${icon}</div>` : ''}
              
              ${canDelete ? 
                `<button class="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 z-10" onclick="event.stopPropagation(); deleteMedia('${os.id}', '${Object.keys(os.media)[idx]}')">&times;</button>` : ''}
          </div>`;
      }).join('');
  };

  // --- ADMIN E CLOUDINARY ---
  const listenToCloudinaryConfigs = () => {
    db.ref('cloudinaryConfigs').limitToLast(1).on('value', snapshot => {
      const val = snapshot.val();
      if (val) {
        const key = Object.keys(val)[0];
        activeCloudinaryConfig = { ...val[key], key };
      }
    });
  };

  document.getElementById('adminBtn').onclick = () => {
      document.getElementById('adminModal').classList.remove('hidden');
      document.getElementById('adminModal').classList.add('flex');
  };

  // Abas do Modal Admin
  document.querySelectorAll('.admin-tab').forEach(btn => {
      btn.onclick = () => {
          document.querySelectorAll('.admin-tab').forEach(b => b.classList.replace('border-blue-600', 'border-transparent'));
          document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('text-blue-600', 'font-bold'));
          
          btn.classList.add('text-blue-600', 'font-bold', 'border-blue-600');
          btn.classList.remove('border-transparent');
          
          document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.add('hidden'));
          document.getElementById(btn.dataset.target).classList.remove('hidden');
      };
  });

  document.getElementById('cloudinaryForm').onsubmit = (e) => {
      e.preventDefault();
      db.ref('cloudinaryConfigs').push({
          cloudName: document.getElementById('cloudNameInput').value.trim(),
          uploadPreset: document.getElementById('uploadPresetInput').value.trim(),
          updatedBy: currentUser.name,
          timestamp: firebase.database.ServerValue.TIMESTAMP
      });
      document.getElementById('adminModal').classList.add('hidden');
      showNotification('Configuração salva!');
  };

  // --- DELETES E MODAIS ---
  document.getElementById('deleteOsBtn').onclick = () => {
      const osId = document.getElementById('logOsId').value;
      if(confirm('Tem certeza absoluta que deseja excluir esta OS?')) {
          db.ref(`serviceOrders/${osId}`).remove();
          document.getElementById('detailsModal').classList.add('hidden');
          document.getElementById('detailsModal').classList.remove('flex');
          showNotification('Ordem de Serviço Excluída');
      }
  };

  window.deleteMedia = (osId, mediaKey) => {
      if(confirm('Apagar esta mídia?')) {
          db.ref(`serviceOrders/${osId}/media/${mediaKey}`).remove();
      }
  };

  document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.onclick = (e) => {
          e.target.closest('.modal').classList.add('hidden');
          e.target.closest('.modal').classList.remove('flex');
      };
  });

  // Funções de Upload, Nova OS e Log (Logica padrao mantida mas otimizada para erros)
  document.getElementById('logForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.innerHTML = 'Salvando...';
      const osId = document.getElementById('logOsId').value;
      
      try {
          if (filesToUpload.length > 0) {
              const promises = filesToUpload.map(f => uploadFileToCloudinary(f));
              const results = await Promise.all(promises);
              results.forEach(res => {
                  db.ref(`serviceOrders/${osId}/media`).push({ 
                      url: res.url, type: 'image/jpeg', timestamp: new Date().toISOString() 
                  });
              });
          }
          
          await db.ref(`serviceOrders/${osId}/logs`).push({
              timestamp: new Date().toISOString(),
              user: currentUser.name,
              description: document.getElementById('logDescricao').value,
              type: 'log',
              parts: document.getElementById('logPecas').value,
              value: document.getElementById('logValor').value
          });
          
          showNotification('Atualizado!');
          e.target.reset();
          filesToUpload = [];
      } catch (err) {
          showNotification('Erro: ' + err.message, 'error');
      } finally {
          btn.disabled = false;
          btn.innerHTML = 'Salvar Registro';
      }
  };

  // Inputs
  const mediaInput = document.getElementById('media-input');
  mediaInput.onchange = (e) => {
      if(e.target.files.length > 0) {
          filesToUpload = Array.from(e.target.files);
          document.getElementById('fileName').textContent = `${filesToUpload.length} arquivos selecionados`;
      }
  };
  document.getElementById('openGalleryBtn').onclick = () => mediaInput.click();
  document.getElementById('addOSBtn').onclick = () => {
      document.getElementById('osForm').reset();
      const select = document.getElementById('osResponsavel');
      select.innerHTML = '<option value="">Selecione...</option>' + allUsers.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
      document.getElementById('osModal').classList.remove('hidden');
      document.getElementById('osModal').classList.add('flex');
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
      showNotification('OS Criada!');
  };

  // Toggle Panel
  const togglePanelBtn = document.getElementById('toggle-panel-btn');
  const attentionContainer = document.getElementById('attention-panel-container');
  if(togglePanelBtn) {
      togglePanelBtn.addEventListener('click', () => {
          if (!attentionContainer.style.maxHeight || attentionContainer.style.maxHeight === '0px') {
              attentionContainer.style.maxHeight = '300px';
          } else {
              attentionContainer.style.maxHeight = '0px';
          }
      });
  }
});
