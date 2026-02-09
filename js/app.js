/* ==================================================================
   DASHBOARD CENTER CAR MENECHELLI - SETUP INICIAL
   ================================================================== */

// 1. COLE AQUI AS CHAVES DO NOVO PROJETO FIREBASE (Center-Car-Menechelli)
const firebaseConfig = {
  apiKey: "AIzaSyDFbvRiLpUcXFJgVSwNobXi0fX_IceBK5k",
  authDomain: "centercarmenechelli-47e05.firebaseapp.com",
  databaseURL: "https://centercarmenechelli-47e05-default-rtdb.firebaseio.com",
  projectId: "centercarmenechelli-47e05",
  storageBucket: "centercarmenechelli-47e05.firebasestorage.app",
  messagingSenderId: "697435506647",
  appId: "1:697435506647:web:dce5cbf910f4960f732d92"
};

/* ==================================================================
   CONFIGURAÇÃO DE USUÁRIOS (Menechelli)
================================================================== */
const USERS = [
  // GESTORES
  { name: 'Admin Menechelli', role: 'Gestor', password: 'admin' }, 
  { name: 'Gerente Oficina', role: 'Gestor', password: '1234' },
  
  // ATENDENTES
  { name: 'Recepção 01', role: 'Atendente', password: '1234' },
  
  // MECÂNICOS
  { name: 'Mecânico 01', role: 'Mecânico', password: '1234' },
  { name: 'Mecânico 02', role: 'Mecânico', password: '1234' },
  { name: 'Eletricista', role: 'Mecânico', password: '1234' }
];

// Usuários com permissão "Super Admin" (podem deletar mídia e acessar config)
const USERS_CAN_DELETE_MEDIA = ['Admin Menechelli', 'Gerente Oficina'];

/* ==================================================================
   LÓGICA DO SISTEMA (CLOUDINARY + REALTIME DATABASE)
================================================================== */

let activeCloudinaryConfig = null;
let allCloudinaryConfigs = {};

function showNotification(message, type = 'success') {
  const existing = document.getElementById('notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.id = 'notification';
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => { if(document.body.contains(notification)) notification.remove(); }, 500);
  }, 4000);
}

const uploadFileToCloudinary = async (file) => {
  if (!activeCloudinaryConfig) {
    throw new Error('Configuração de mídia não encontrada. Acesse o Admin (Engrenagem) para configurar.');
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

document.addEventListener('DOMContentLoaded', () => {
  try {
      if (firebaseConfig.apiKey === "COLE_SUA_API_KEY_AQUI") {
          console.error("⚠️ ATENÇÃO: Você precisa colar as chaves do Firebase no início do arquivo app.js");
          alert("Configuração Pendente: Edite o arquivo app.js e adicione as chaves do Firebase do novo cliente.");
          return;
      }
      firebase.initializeApp(firebaseConfig);
  } catch (e) {
      console.error("Erro ao iniciar Firebase:", e);
  }

  // ATENÇÃO: Usamos apenas database(), sem storage().
  const db = firebase.database();
  
  let currentUser = null;
  let allServiceOrders = {};
  let lightboxMedia = [];
  let currentLightboxIndex = 0;
  let filesToUpload = [];
  let appStartTime = Date.now();

  const STATUS_LIST = [ 'Aguardando-Mecanico', 'Em-Analise', 'Orcamento-Enviado', 'Aguardando-Aprovacao', 'Servico-Autorizado', 'Em-Execucao', 'Finalizado-Aguardando-Retirada', 'Entregue' ];
  const ATTENTION_STATUSES = { 
      'Aguardando-Mecanico': { label: 'AGUARDANDO MECÂNICO', color: 'yellow', blinkClass: 'blinking-aguardando' }, 
      'Servico-Autorizado': { label: 'SERVIÇO AUTORIZADO', color: 'green', blinkClass: 'blinking-autorizado' } 
  };
  const LED_TRIGGER_STATUSES = ['Aguardando-Mecanico', 'Servico-Autorizado'];

  // Seletores
  const userScreen = document.getElementById('userScreen');
  const app = document.getElementById('app');
  const loginForm = document.getElementById('loginForm');
  const userSelect = document.getElementById('userSelect');
  const passwordInput = document.getElementById('passwordInput');
  const loginError = document.getElementById('loginError');
  const kanbanBoard = document.getElementById('kanbanBoard');
  const addOSBtn = document.getElementById('addOSBtn');
  const logoutButton = document.getElementById('logoutButton');
  const osModal = document.getElementById('osModal');
  const osForm = document.getElementById('osForm');
  const detailsModal = document.getElementById('detailsModal');
  const logForm = document.getElementById('logForm');
  const kmUpdateForm = document.getElementById('kmUpdateForm');
  const attentionPanel = document.getElementById('attention-panel');
  const attentionPanelContainer = document.getElementById('attention-panel-container');
  const togglePanelBtn = document.getElementById('toggle-panel-btn');
  const lightbox = document.getElementById('lightbox');
  const mediaInput = document.getElementById('media-input');
  const openCameraBtn = document.getElementById('openCameraBtn');
  const openGalleryBtn = document.getElementById('openGalleryBtn');
  const alertLed = document.getElementById('alert-led');
  const postLogActions = document.getElementById('post-log-actions');
  const deleteOsBtn = document.getElementById('deleteOsBtn');
  const confirmDeleteModal = document.getElementById('confirmDeleteModal');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const adminBtn = document.getElementById('adminBtn');
  const adminModal = document.getElementById('adminModal');
  const cloudinaryForm = document.getElementById('cloudinaryForm');
  const reportsBtn = document.getElementById('reportsBtn');
  const reportsModal = document.getElementById('reportsModal');
  const reportsForm = document.getElementById('reportsForm');
  const reportsResultContainer = document.getElementById('reportsResultContainer');
  const exportReportBtn = document.getElementById('exportReportBtn');
  const globalSearchInput = document.getElementById('globalSearchInput');
  const globalSearchResults = document.getElementById('globalSearchResults');

  const formatStatus = (status) => status.replace(/-/g, ' ');

  // --- AUTENTICAÇÃO ---
  const logoutUser = () => {
    localStorage.removeItem('centerCarSession');
    location.reload();
  };

  const scheduleDailyLogout = () => {
    const now = new Date();
    const logoutTime = new Date();
    logoutTime.setHours(19, 0, 0, 0);
    if (now > logoutTime) logoutTime.setDate(logoutTime.getDate() + 1);
    
    setTimeout(() => {
      if (localStorage.getItem('centerCarSession')) {
        showNotification('Sessão encerrada por horário.', 'success');
        setTimeout(logoutUser, 2000);
      }
    }, logoutTime.getTime() - now.getTime());
  };

  const loginUser = (user) => {
    const sessionData = { user: user, loginTime: new Date().toISOString() };
    localStorage.setItem('centerCarSession', JSON.stringify(sessionData));
    currentUser = user;
    
    document.getElementById('currentUserName').textContent = user.name;
    userScreen.classList.add('hidden');
    app.classList.remove('hidden');
    
    initializeKanban();
    listenToServiceOrders();
    listenToNotifications(); // Notificações internas
    listenToCloudinaryConfigs();
    scheduleDailyLogout();

    if (user.role === 'Gestor') {
      adminBtn.classList.remove('hidden');
      reportsBtn.classList.remove('hidden');
    }
  };

  const initializeLoginScreen = () => {
    userSelect.innerHTML = '<option value="">Selecione...</option>';
    USERS.forEach(user => {
        const opt = document.createElement('option');
        opt.value = user.name;
        opt.textContent = `${user.name} (${user.role})`;
        userSelect.appendChild(opt);
    });

    const storedSession = localStorage.getItem('centerCarSession');
    if (storedSession) {
        const sessionData = JSON.parse(storedSession);
        const loginTime = new Date(sessionData.loginTime);
        const cutoff = new Date();
        cutoff.setHours(19, 0, 0, 0);
        if (new Date() < cutoff) cutoff.setDate(cutoff.getDate() - 1);
        
        if (loginTime < cutoff) {
            logoutUser();
        } else {
            loginUser(sessionData.user);
        }
    } else {
        userScreen.classList.remove('hidden');
    }
  };

  // --- KANBAN ---
  const initializeKanban = () => {
    const collapsedState = JSON.parse(localStorage.getItem('collapsedColumnsMenechelli')) || {};
    kanbanBoard.innerHTML = STATUS_LIST.map(status => {
      const isCollapsed = collapsedState[status];
      const searchInputHTML = status === 'Entregue' 
        ? `<div class="my-2"><input type="search" data-status="${status}" placeholder="Filtrar..." class="w-full p-2 text-xs border rounded search-input-entregue"></div>` 
        : '';
      const ledHTML = isCollapsed ? '<div class="column-led"></div>' : '';
      
      return `
        <div class="status-column">
            <div class="p-3 flex justify-between items-center cursor-pointer toggle-column-btn bg-gray-200 rounded-t-lg" data-status="${status}">
                <div class="flex items-center gap-2">
                    <h3 class="font-bold text-gray-700 text-sm uppercase">${formatStatus(status)}</h3>
                    ${ledHTML}
                </div>
                <i class='bx bxs-chevron-down transition-transform ${isCollapsed ? 'rotate-180' : ''}'></i>
            </div>
            ${searchInputHTML}
            <div class="vehicle-list space-y-2 ${isCollapsed ? 'collapsed' : ''}" data-status="${status}"></div>
        </div>`;
    }).join('');
    updateAttentionPanel();
  };

  const createCardHTML = (os) => {
    const idx = STATUS_LIST.indexOf(os.status);
    const prev = idx > 0 ? STATUS_LIST[idx - 1] : null;
    const next = idx < STATUS_LIST.length - 1 ? STATUS_LIST[idx + 1] : null;
    
    const prevBtn = prev ? `<button data-os-id="${os.id}" data-new-status="${prev}" class="btn-move p-1 hover:bg-gray-100 rounded-full"><i class='bx bx-chevron-left text-xl'></i></button>` : `<div class="w-7"></div>`;
    const nextBtn = next ? `<button data-os-id="${os.id}" data-new-status="${next}" class="btn-move p-1 hover:bg-gray-100 rounded-full"><i class='bx bx-chevron-right text-xl'></i></button>` : `<div class="w-7"></div>`;
    
    const priorityHtml = os.priority ? `<div class="priority-indicator priority-${os.priority}"></div>` : '';
    
    return `
    <div id="${os.id}" class="vehicle-card status-${os.status}" data-os-id="${os.id}">
        ${priorityHtml}
        <div class="flex justify-between items-start">
            <div class="card-clickable flex-grow pr-4">
                <p class="font-black text-lg text-gray-800">${os.placa}</p>
                <p class="text-xs font-semibold text-blue-700 uppercase">${os.modelo}</p>
                <p class="text-xs text-gray-500 mt-1 truncate">${os.cliente}</p>
            </div>
            <div class="flex flex-col gap-1 items-end">
                ${nextBtn}
                ${prevBtn}
            </div>
        </div>
        ${os.km ? `<div class="mt-2 text-xs bg-gray-100 px-2 py-1 rounded inline-block text-gray-600">KM: ${os.km}</div>` : ''}
    </div>`;
  };

  // --- LISTENERS FIREBASE ---
  const listenToServiceOrders = () => {
    const osRef = db.ref('serviceOrders');
    
    const handleUpdate = (snapshot) => {
        const os = { ...snapshot.val(), id: snapshot.key };
        allServiceOrders[os.id] = os;
        
        const oldCard = document.getElementById(os.id);
        if (oldCard) oldCard.remove();

        const list = kanbanBoard.querySelector(`.vehicle-list[data-status="${os.status}"]`);
        if (list) {
            list.insertAdjacentHTML('afterbegin', createCardHTML(os));
        }
        
        if (!detailsModal.classList.contains('hidden') && document.getElementById('logOsId').value === os.id) {
            renderTimeline(os);
            renderMediaGallery(os);
        }
        updateAttentionPanel();
    };

    osRef.on('child_added', handleUpdate);
    osRef.on('child_changed', handleUpdate);
    osRef.on('child_removed', snapshot => {
        const id = snapshot.key;
        delete allServiceOrders[id];
        const card = document.getElementById(id);
        if(card) card.remove();
        updateAttentionPanel();
    });
  };

  const updateAttentionPanel = () => {
      let triggering = false;
      attentionPanel.innerHTML = Object.entries(ATTENTION_STATUSES).map(([status, config]) => {
          const vehicles = Object.values(allServiceOrders).filter(os => os.status === status);
          if (vehicles.length > 0) triggering = true;
          
          const listHtml = vehicles.length > 0 
            ? vehicles.map(os => `<p class="cursor-pointer hover:underline" onclick="openDetails('${os.id}')">${os.placa} - ${os.modelo}</p>`).join('')
            : '<span class="text-gray-500 italic">Vazio</span>';
            
          return `
          <div class="attention-box bg-gray-800 rounded p-2 border border-gray-600 ${vehicles.length > 0 ? config.blinkClass : ''}">
             <h4 class="text-${config.color}-400 font-bold text-xs text-center mb-1">${config.label}</h4>
             <div class="text-white text-xs text-center max-h-20 overflow-y-auto">${listHtml}</div>
          </div>`;
      }).join('');
      
      alertLed.style.display = triggering ? 'block' : 'none';
  };

  // --- NOTIFICAÇÕES EM TEMPO REAL (NOVO) ---
  function sendTeamNotification(message) {
      if (!currentUser) return;
      db.ref('notifications').push({
          message: message,
          user: currentUser.name,
          timestamp: firebase.database.ServerValue.TIMESTAMP
      });
  }

  function listenToNotifications() {
      // Ouve apenas notificações novas (após o início da sessão)
      db.ref('notifications').orderByChild('timestamp').startAt(appStartTime).on('child_added', snapshot => {
          const n = snapshot.val();
          if (n && n.user !== currentUser.name) {
              showNotification(`${n.message}`, 'success');
          }
      });
  }

  window.openDetails = (osId) => {
      const os = allServiceOrders[osId];
      if (!os) return;
      
      document.getElementById('logOsId').value = osId;
      document.getElementById('detailsHeader').innerHTML = `
        <div>
            <h1 class="text-3xl font-black text-gray-800">${os.placa}</h1>
            <p class="text-lg text-blue-700 font-bold">${os.modelo}</p>
            <p class="text-gray-500">${os.cliente} | Tel: ${os.telefone || '--'}</p>
        </div>
        <div class="text-right">
            <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">${formatStatus(os.status)}</span>
            <p class="text-2xl font-bold text-gray-700 mt-2">${os.km ? os.km + ' KM' : ''}</p>
        </div>
      `;
      
      const obsDiv = document.getElementById('detailsObservacoes');
      if (os.observacoes) {
          obsDiv.innerHTML = `<p class="text-red-600 font-semibold text-sm">RECLAMAÇÃO:</p><p class="text-gray-700">${os.observacoes}</p>`;
          obsDiv.classList.remove('hidden');
      } else {
          obsDiv.classList.add('hidden');
      }
      
      if (currentUser.role === 'Gestor' || currentUser.role === 'Atendente') {
          deleteOsBtn.classList.remove('hidden');
      } else {
          deleteOsBtn.classList.add('hidden');
      }

      renderTimeline(os);
      renderMediaGallery(os);
      detailsModal.classList.remove('hidden');
      detailsModal.classList.add('flex');
  };

  const renderTimeline = (os) => {
      const container = document.getElementById('timelineContainer');
      const logs = os.logs ? Object.values(os.logs).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)) : [];
      
      if (logs.length === 0) {
          container.innerHTML = '<p class="text-gray-400 text-center italic text-sm">Nenhum registro.</p>';
          return;
      }
      
      container.innerHTML = logs.map(log => {
          const date = new Date(log.timestamp).toLocaleString('pt-BR');
          let typeClass = log.type === 'status' ? 'border-l-4 border-yellow-400 pl-2' : '';
          
          return `
          <div class="relative pb-4 border-b border-gray-100 last:border-0 ${typeClass}">
              <div class="flex justify-between items-start">
                  <span class="font-bold text-xs text-blue-900">${log.user}</span>
                  <span class="text-[10px] text-gray-400">${date}</span>
              </div>
              <p class="text-sm text-gray-700 mt-1">${log.description}</p>
              ${log.parts ? `<p class="text-xs text-gray-500 mt-1">🔧 Peças: ${log.parts}</p>` : ''}
              ${log.value ? `<p class="text-xs text-green-600 font-bold">R$ ${log.value}</p>` : ''}
          </div>`;
      }).join('');
  };

  const renderMediaGallery = (os) => {
      const grid = document.getElementById('thumbnail-grid');
      const media = os.media ? Object.values(os.media) : [];
      
      if (media.length === 0) {
          grid.innerHTML = '<p class="col-span-4 text-center text-xs text-gray-400 py-2">Sem fotos</p>';
          return;
      }
      
      lightboxMedia = media;
      
      grid.innerHTML = media.map((item, idx) => {
          let content = '';
          if (item.type && item.type.startsWith('video')) {
              content = '<div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20"><i class="bx bx-play-circle text-white text-2xl"></i></div>';
          }
          const src = item.type && item.type.startsWith('image') ? item.url : 'images/file-placeholder.png';
          
          const delBtn = (USERS_CAN_DELETE_MEDIA.includes(currentUser.name)) 
            ? `<button onclick="deleteMedia('${os.id}', '${Object.keys(os.media)[idx]}')" class="absolute top-0 right-0 bg-red-600 text-white w-5 h-5 flex items-center justify-center rounded-bl text-xs">&times;</button>`
            : '';

          return `
          <div class="relative aspect-square bg-gray-200 rounded overflow-hidden cursor-pointer group" onclick="openLightbox(${idx})">
              <img src="${src}" class="w-full h-full object-cover">
              ${content}
              ${delBtn}
          </div>`;
      }).join('');
  };

  // --- AÇÕES DO SISTEMA ---
  
  loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = userSelect.value;
      const pass = passwordInput.value;
      const user = USERS.find(u => u.name === name);
      
      if (user && user.password === pass) {
          loginUser(user);
      } else {
          loginError.textContent = "Senha incorreta.";
      }
  });
  
  logoutButton.addEventListener('click', logoutUser);

  addOSBtn.addEventListener('click', () => {
      osForm.reset();
      document.getElementById('osId').value = '';
      const respSelect = document.getElementById('osResponsavel');
      respSelect.innerHTML = '<option value="">Selecione...</option>' + USERS.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
      osModal.classList.remove('hidden');
      osModal.classList.add('flex');
  });

  osForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const priority = document.querySelector('input[name="osPrioridade"]:checked').value;
      const data = {
          placa: document.getElementById('osPlaca').value.toUpperCase(),
          modelo: document.getElementById('osModelo').value,
          cliente: document.getElementById('osCliente').value,
          telefone: document.getElementById('osTelefone').value,
          km: document.getElementById('osKm').value,
          responsible: document.getElementById('osResponsavel').value,
          observacoes: document.getElementById('osObservacoes').value,
          priority: priority,
          status: 'Aguardando-Mecanico',
          createdAt: new Date().toISOString(),
          lastUpdate: new Date().toISOString()
      };
      
      const newRef = db.ref('serviceOrders').push(data);
      // Log de criação
      db.ref(`serviceOrders/${newRef.key}/logs`).push({
          timestamp: new Date().toISOString(),
          user: currentUser.name,
          description: "O.S. Criada",
          type: 'status'
      });
      sendTeamNotification(`Nova O.S. ${data.placa} criada por ${currentUser.name}`);
      
      osModal.classList.add('hidden');
      osModal.classList.remove('flex');
      showNotification('Nova O.S. criada!', 'success');
  });

  logForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = logForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.innerHTML = 'Salvando...';
      
      const osId = document.getElementById('logOsId').value;
      const desc = document.getElementById('logDescricao').value;
      
      let mediaItems = [];
      if (filesToUpload.length > 0) {
          try {
              const uploads = filesToUpload.map(f => uploadFileToCloudinary(f));
              const results = await Promise.all(uploads);
              mediaItems = results.map((res, i) => ({
                  url: res.url,
                  type: filesToUpload[i].type,
                  uploadedBy: currentUser.name,
                  timestamp: new Date().toISOString()
              }));
          } catch(err) {
              alert("Erro no upload: " + err.message);
              btn.disabled = false; return;
          }
      }

      const logEntry = {
          timestamp: new Date().toISOString(),
          user: currentUser.name,
          description: desc,
          type: 'log',
          parts: document.getElementById('logPecas').value,
          value: document.getElementById('logValor').value
      };
      
      await db.ref(`serviceOrders/${osId}/logs`).push(logEntry);
      
      if (mediaItems.length > 0) {
          mediaItems.forEach(async (m) => {
              await db.ref(`serviceOrders/${osId}/media`).push(m);
          });
      }
      
      sendTeamNotification(`Atualização em ${allServiceOrders[osId].placa}`);
      
      logForm.reset();
      filesToUpload = [];
      document.getElementById('fileName').textContent = '';
      btn.disabled = false;
      btn.innerHTML = `<i class='bx bx-send'></i> Registrar`;
      
      document.getElementById('post-log-actions').classList.remove('hidden');
  });
  
  mediaInput.addEventListener('change', (e) => {
      if(e.target.files.length > 0) filesToUpload = Array.from(e.target.files);
      document.getElementById('fileName').textContent = filesToUpload.length > 0 ? `${filesToUpload.length} arquivo(s)` : '';
  });
  
  document.getElementById('openCameraBtn').onclick = () => {
      mediaInput.setAttribute('capture', 'environment');
      mediaInput.click();
  };
  document.getElementById('openGalleryBtn').onclick = () => {
      mediaInput.removeAttribute('capture');
      mediaInput.click();
  };
  
  const moveStatus = async (direction) => {
      const osId = document.getElementById('logOsId').value;
      const os = allServiceOrders[osId];
      const idx = STATUS_LIST.indexOf(os.status);
      let newStatus = null;
      
      if (direction === 'next' && idx < STATUS_LIST.length - 1) newStatus = STATUS_LIST[idx + 1];
      if (direction === 'prev' && idx > 0) newStatus = STATUS_LIST[idx - 1];
      
      if (newStatus) {
          await db.ref(`serviceOrders/${osId}`).update({ status: newStatus, lastUpdate: new Date().toISOString() });
          
          await db.ref(`serviceOrders/${osId}/logs`).push({
              timestamp: new Date().toISOString(),
              user: currentUser.name,
              description: `Status alterado para: ${formatStatus(newStatus)}`,
              type: 'status'
          });
          detailsModal.classList.add('hidden');
          detailsModal.classList.remove('flex');
          showNotification('Status atualizado!');
      }
      document.getElementById('post-log-actions').classList.add('hidden');
  };
  
  document.getElementById('btn-move-next').onclick = () => moveStatus('next');
  document.getElementById('btn-move-prev').onclick = () => moveStatus('prev');
  document.getElementById('btn-stay').onclick = () => document.getElementById('post-log-actions').classList.add('hidden');

  kanbanBoard.addEventListener('click', (e) => {
      const card = e.target.closest('.vehicle-card');
      const btnMove = e.target.closest('.btn-move');
      const toggleBtn = e.target.closest('.toggle-column-btn');
      
      if (btnMove) {
          e.stopPropagation();
          const { osId, newStatus } = btnMove.dataset;
          db.ref(`serviceOrders/${osId}`).update({ status: newStatus });
      } else if (card) {
          openDetails(card.dataset.osId);
      } else if (toggleBtn) {
          const status = toggleBtn.dataset.status;
          const list = kanbanBoard.querySelector(`.vehicle-list[data-status="${status}"]`);
          list.classList.toggle('collapsed');
          toggleBtn.querySelector('i').classList.toggle('rotate-180');
          
          const state = JSON.parse(localStorage.getItem('collapsedColumnsMenechelli')) || {};
          state[status] = list.classList.contains('collapsed');
          localStorage.setItem('collapsedColumnsMenechelli', JSON.stringify(state));
          initializeKanban();
      }
  });

  const listenToCloudinaryConfigs = () => {
    db.ref('cloudinaryConfigs').limitToLast(1).on('value', snapshot => {
      const val = snapshot.val();
      if (val) {
        const key = Object.keys(val)[0];
        activeCloudinaryConfig = { ...val[key], key };
      }
    });
  };
  
  adminBtn.onclick = () => {
      adminModal.classList.remove('hidden');
      adminModal.classList.add('flex');
  };
  
  cloudinaryForm.onsubmit = (e) => {
      e.preventDefault();
      const data = {
          cloudName: document.getElementById('cloudNameInput').value,
          uploadPreset: document.getElementById('uploadPresetInput').value,
          updatedBy: currentUser.name,
          timestamp: firebase.database.ServerValue.TIMESTAMP
      };
      db.ref('cloudinaryConfigs').push(data);
      adminModal.classList.add('hidden');
      adminModal.classList.remove('flex');
      showNotification('Configuração de Mídia Salva!');
  };

  initializeLoginScreen();

  document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.onclick = (e) => {
          e.target.closest('.modal').classList.add('hidden');
          e.target.closest('.modal').classList.remove('flex');
      };
  });
});
