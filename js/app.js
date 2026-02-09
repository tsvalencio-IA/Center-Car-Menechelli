/* ==================================================================
   DASHBOARD CENTER CAR MENECHELLI - SISTEMA DE GESTÃO V2
   Desenvolvido por: thIAguinho Soluções
   ================================================================== */

// CONFIGURAÇÃO FIREBASE (Center-Car-Menechelli)
const firebaseConfig = {
  apiKey: "AIzaSyDFbvRiLpUcXFJgVSwNobXi0fX_IceBK5k",
  authDomain: "centercarmenechelli-47e05.firebaseapp.com",
  databaseURL: "https://centercarmenechelli-47e05-default-rtdb.firebaseio.com",
  projectId: "centercarmenechelli-47e05",
  storageBucket: "centercarmenechelli-47e05.firebasestorage.app",
  messagingSenderId: "697435506647",
  appId: "1:697435506647:web:dce5cbf910f4960f732d92"
};

// CONFIGURAÇÃO DE USUÁRIOS
const USERS = [
  // --- ACESSO MESTRE (VOCÊ) ---
  { name: 'Thiago Ventura Valencio', role: 'Desenvolvedor', password: '1940' }, // Defina sua senha aqui

  // --- GESTORES DO CLIENTE ---
  { name: 'Anderson Menechelli', role: 'Gestor', password: 'admin' }, 
  { name: 'Gerente Oficina', role: 'Gestor', password: '1234' },
  
  // --- EQUIPE ---
  { name: 'Marcelo Alef Garbina', role: 'Atendente', password: 'marcelo' },
  { name: 'Mecânico 01', role: 'Mecânico', password: '1234' },
  { name: 'Mecânico 02', role: 'Mecânico', password: '1234' },
  { name: 'Eletricista', role: 'Mecânico', password: '1234' }
];

// Usuários com permissão "Super Admin" (podem deletar mídia e acessar config)
const USERS_CAN_DELETE_MEDIA = ['Admin Menechelli', 'Thiago Ventura Valencio'];

// --- VARIÁVEIS GLOBAIS ---
let activeCloudinaryConfig = null;
let currentUser = null;
let allServiceOrders = {};
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
  
  // Animação de entrada
  requestAnimationFrame(() => {
      notification.classList.remove('translate-x-full');
  });
  
  // Remoção automática
  setTimeout(() => {
    notification.classList.add('translate-x-full');
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// --- INTEGRAÇÃO CLOUDINARY (Upload) ---
const uploadFileToCloudinary = async (file) => {
  if (!activeCloudinaryConfig) {
    throw new Error('Mídia não configurada. Contate o Admin.');
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
  // Inicialização Segura do Firebase
  try {
      if (firebaseConfig.apiKey.includes("COLE_SUA_API_KEY")) {
          console.error("⚠️ Configuração Pendente: Adicione as chaves no app.js");
          alert("Sistema aguardando configuração das chaves de acesso.");
          return;
      }
      firebase.initializeApp(firebaseConfig);
  } catch (e) {
      console.error("Erro Firebase:", e);
  }

  const db = firebase.database();

  const STATUS_LIST = [ 'Aguardando-Mecanico', 'Em-Analise', 'Orcamento-Enviado', 'Aguardando-Aprovacao', 'Servico-Autorizado', 'Em-Execucao', 'Finalizado-Aguardando-Retirada', 'Entregue' ];
  
  // Definição de Cores e Alertas
  const ATTENTION_STATUSES = { 
      'Aguardando-Mecanico': { label: 'AGUARDANDO MECÂNICO', colorClass: 'text-yellow-400', borderClass: 'border-yellow-500', blink: true }, 
      'Servico-Autorizado': { label: 'SERVIÇO AUTORIZADO', colorClass: 'text-green-400', borderClass: 'border-green-500', blink: true } 
  };

  // --- CONTROLE DE SESSÃO ---
  const logoutUser = () => {
    localStorage.removeItem('centerCarSession');
    location.reload();
  };

  const scheduleDailyLogout = () => {
    const now = new Date();
    const logoutTime = new Date();
    logoutTime.setHours(19, 0, 0, 0); // 19:00
    if (now > logoutTime) logoutTime.setDate(logoutTime.getDate() + 1);
    
    setTimeout(() => {
      if (localStorage.getItem('centerCarSession')) {
        showNotification('Sessão expirada. Faça login novamente.', 'error');
        setTimeout(logoutUser, 2000);
      }
    }, logoutTime.getTime() - now.getTime());
  };

  const loginUser = (user) => {
    const sessionData = { user: user, loginTime: new Date().toISOString() };
    localStorage.setItem('centerCarSession', JSON.stringify(sessionData));
    currentUser = user;
    
    document.getElementById('currentUserName').textContent = user.name;
    document.getElementById('userScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('app').classList.add('flex'); // Garante layout flex
    
    // Inicia Módulos
    initializeKanban();
    listenToServiceOrders();
    listenToNotifications();
    listenToCloudinaryConfigs();
    scheduleDailyLogout();

    // Permissões de Admin
    if (user.role === 'Gestor' || user.role === 'Desenvolvedor') {
      document.getElementById('adminBtn').classList.remove('hidden');
      document.getElementById('reportsBtn').classList.remove('hidden');
    }
  };

  // --- TOGGLE DO PAINEL DE ALERTAS (CORRIGIDO) ---
  const togglePanelBtn = document.getElementById('toggle-panel-btn');
  const attentionContainer = document.getElementById('attention-panel-container');
  const toggleIcon = document.getElementById('toggle-icon');

  if(togglePanelBtn) {
      togglePanelBtn.addEventListener('click', () => {
          // Verifica se está fechado (max-height é 0)
          if (attentionContainer.style.maxHeight === '0px' || !attentionContainer.style.maxHeight) {
              // Abre
              attentionContainer.style.maxHeight = '300px'; // Altura suficiente
              toggleIcon.classList.add('rotate-180');
          } else {
              // Fecha
              attentionContainer.style.maxHeight = '0px';
              toggleIcon.classList.remove('rotate-180');
          }
      });
  }

  // --- KANBAN BOARD ---
  const initializeKanban = () => {
    const board = document.getElementById('kanbanBoard');
    const collapsedState = JSON.parse(localStorage.getItem('collapsedColumnsMenechelli')) || {};
    
    board.innerHTML = STATUS_LIST.map(status => {
      const isCollapsed = collapsedState[status];
      const formatStatus = status.replace(/-/g, ' ');
      
      return `
        <div class="flex-shrink-0 w-80 flex flex-col h-full bg-gray-200 rounded-xl shadow-inner border border-gray-300">
            <div class="p-3 bg-gray-300 rounded-t-xl flex justify-between items-center cursor-pointer select-none toggle-column-header" data-status="${status}">
                <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full ${getStatusColor(status)}"></div>
                    <h3 class="font-bold text-gray-700 text-sm uppercase">${formatStatus}</h3>
                    <span class="bg-white text-xs font-bold px-2 rounded-full text-gray-600 count-badge" id="count-${status}">0</span>
                </div>
                <i class='bx bxs-chevron-down transition-transform ${isCollapsed ? 'rotate-180' : ''}'></i>
            </div>
            
            ${status === 'Entregue' ? '<div class="px-2 pt-2"><input type="text" class="w-full p-2 text-xs rounded border border-gray-300 search-delivered" placeholder="Filtrar Entregues..."></div>' : ''}

            <div class="flex-grow p-2 overflow-y-auto custom-scrollbar space-y-3 transition-all duration-300 vehicle-list ${isCollapsed ? 'hidden' : ''}" id="col-${status}" data-status="${status}">
                <!-- Cards Inseridos Aqui -->
            </div>
        </div>`;
    }).join('');
    
    // Adiciona Listeners de Colapso
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
      const colors = {
          'Aguardando-Mecanico': 'bg-yellow-500',
          'Em-Analise': 'bg-blue-500',
          'Orcamento-Enviado': 'bg-cyan-500',
          'Aguardando-Aprovacao': 'bg-purple-500',
          'Servico-Autorizado': 'bg-green-500',
          'Em-Execucao': 'bg-indigo-600',
          'Finalizado-Aguardando-Retirada': 'bg-orange-500',
          'Entregue': 'bg-gray-500'
      };
      return colors[status] || 'bg-gray-400';
  };

  // --- RENDERIZAÇÃO DE DADOS (FIREBASE) ---
  const listenToServiceOrders = () => {
    db.ref('serviceOrders').on('value', snapshot => {
        allServiceOrders = {}; // Limpa cache local
        const data = snapshot.val();
        
        // Limpa todas as colunas
        STATUS_LIST.forEach(status => {
            const col = document.getElementById(`col-${status}`);
            if(col) col.innerHTML = '';
            document.getElementById(`count-${status}`).textContent = '0';
        });

        if (data) {
            Object.entries(data).forEach(([id, os]) => {
                os.id = id;
                allServiceOrders[id] = os;
                
                const col = document.getElementById(`col-${os.status}`);
                if (col) {
                    const card = createCardElement(os);
                    // Insere no topo (mais recente)
                    col.insertAdjacentHTML('afterbegin', card);
                }
            });
            
            // Atualiza contadores
            STATUS_LIST.forEach(status => {
                const count = document.getElementById(`col-${status}`).children.length;
                document.getElementById(`count-${status}`).textContent = count;
            });
        }
        
        updateAttentionPanel();
        
        // Se modal aberto, atualiza dados em tempo real
        const openId = document.getElementById('logOsId').value;
        if(openId && allServiceOrders[openId]) {
            renderTimeline(allServiceOrders[openId]);
            renderMediaGallery(allServiceOrders[openId]);
        }
    });
  };

  const createCardElement = (os) => {
      // Lógica de prioridade
      const priorityColors = { 'vermelho': 'bg-red-500', 'amarelo': 'bg-yellow-500', 'verde': 'hidden' };
      const priorityClass = priorityColors[os.priority] || 'hidden';
      
      return `
      <div class="bg-white p-3 rounded-lg shadow-sm border-l-4 ${getBorderColor(os.status)} cursor-pointer hover:shadow-md transition-shadow relative group card-item" onclick="openDetails('${os.id}')">
          <div class="absolute top-2 right-2 w-3 h-3 rounded-full ${priorityClass} shadow-sm" title="Prioridade"></div>
          
          <div class="flex justify-between items-start mb-1 pr-4">
              <span class="font-black text-gray-800 text-lg tracking-tight">${os.placa}</span>
          </div>
          <div class="text-xs font-bold text-blue-800 uppercase mb-1 truncate">${os.modelo}</div>
          <div class="text-xs text-gray-500 truncate"><i class='bx bxs-user'></i> ${os.cliente}</div>
          ${os.km ? `<div class="mt-2 inline-block bg-gray-100 px-2 py-0.5 rounded text-[10px] font-mono text-gray-600">KM: ${os.km}</div>` : ''}
          
          <!-- Botões de Movimentação Rápida (Hover) -->
          <div class="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <button class="bg-gray-100 hover:bg-gray-200 p-1 rounded text-gray-600" onclick="event.stopPropagation(); quickMove('${os.id}', 'prev')"><i class='bx bx-chevron-left'></i></button>
               <button class="bg-gray-100 hover:bg-gray-200 p-1 rounded text-gray-600" onclick="event.stopPropagation(); quickMove('${os.id}', 'next')"><i class='bx bx-chevron-right'></i></button>
          </div>
      </div>`;
  };

  const getBorderColor = (status) => {
      const borders = {
          'Aguardando-Mecanico': 'border-yellow-500',
          'Em-Analise': 'border-blue-500',
          'Orcamento-Enviado': 'border-cyan-500',
          'Aguardando-Aprovacao': 'border-purple-500',
          'Servico-Autorizado': 'border-green-500',
          'Em-Execucao': 'border-indigo-600',
          'Finalizado-Aguardando-Retirada': 'border-orange-500',
          'Entregue': 'border-gray-500'
      };
      return borders[status] || 'border-gray-300';
  };

  // --- PAINEL DE ALERTAS ---
  const updateAttentionPanel = () => {
      const panel = document.getElementById('attention-panel');
      const led = document.getElementById('alert-led');
      let hasAlerts = false;
      
      panel.innerHTML = Object.entries(ATTENTION_STATUSES).map(([status, config]) => {
          const vehicles = Object.values(allServiceOrders).filter(os => os.status === status);
          if (vehicles.length > 0) hasAlerts = true;
          
          const list = vehicles.length > 0 
              ? vehicles.map(os => `<div class="cursor-pointer hover:bg-white/10 p-1 rounded flex justify-between items-center" onclick="openDetails('${os.id}')"><span>${os.placa}</span> <span class="text-gray-400 text-[10px]">${os.modelo}</span></div>`).join('')
              : '<div class="text-gray-500 text-center italic text-xs py-1">Nenhum veículo</div>';

          return `
          <div class="bg-gray-800 rounded-lg p-3 border ${config.borderClass} ${vehicles.length > 0 && config.blink ? 'animate-pulse-border' : ''}">
              <h4 class="${config.colorClass} font-black text-xs text-center mb-2 uppercase tracking-widest border-b border-gray-700 pb-1">${config.label}</h4>
              <div class="text-white text-xs max-h-32 overflow-y-auto space-y-1 custom-scrollbar">${list}</div>
          </div>`;
      }).join('');
      
      // Controla o LED vermelho no header
      if (hasAlerts) {
          led.classList.remove('hidden');
      } else {
          led.classList.add('hidden');
      }
  };

  // --- AÇÕES DO USUÁRIO ---
  window.quickMove = (id, direction) => {
      const os = allServiceOrders[id];
      const idx = STATUS_LIST.indexOf(os.status);
      let newStatus = null;
      
      if (direction === 'next' && idx < STATUS_LIST.length - 1) newStatus = STATUS_LIST[idx + 1];
      if (direction === 'prev' && idx > 0) newStatus = STATUS_LIST[idx - 1];
      
      if (newStatus) {
          db.ref(`serviceOrders/${id}`).update({ status: newStatus });
      }
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
      
      // Controle de Botões por Permissão
      const canDelete = USERS_CAN_DELETE_MEDIA.includes(currentUser.name);
      const delBtn = document.getElementById('deleteOsBtn');
      if (canDelete) delBtn.classList.remove('hidden'); else delBtn.classList.add('hidden');

      renderTimeline(os);
      renderMediaGallery(os);
      
      const modal = document.getElementById('detailsModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
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
              thumb = ''; // Cloudinary gera thumbs automáticos se mudar a URL, mas por hora deixamos preto
              icon = '<i class="bx bx-play-circle text-4xl text-white opacity-80"></i>';
          } else if(isPdf) {
              thumb = '';
              icon = '<i class="bx bxs-file-pdf text-4xl text-red-500"></i>';
          }

          return `
          <div class="relative aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer group shadow-sm hover:shadow-md transition-all border border-gray-200" onclick="openLightbox(${idx})">
              ${thumb ? `<img src="${thumb}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">` : `<div class="w-full h-full flex items-center justify-center bg-gray-100">${icon}</div>`}
              ${isVideo && thumb ? `<div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">${icon}</div>` : ''}
              
              <!-- Botão Delete (Só Admins) -->
              ${USERS_CAN_DELETE_MEDIA.includes(currentUser.name) ? 
                `<button class="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 z-10" onclick="event.stopPropagation(); deleteMedia('${os.id}', '${Object.keys(os.media)[idx]}')">&times;</button>` : ''}
          </div>`;
      }).join('');
  };

  // --- LIGHTBOX ---
  window.openLightbox = (index) => {
      currentLightboxIndex = index;
      const media = lightboxMedia[index];
      const container = document.getElementById('lightbox-content');
      const modal = document.getElementById('lightbox');
      
      let content = '';
      if (media.type.includes('video')) {
          content = `<video src="${media.url}" controls autoplay class="max-w-full max-h-[85vh] rounded shadow-2xl"></video>`;
      } else if (media.type.includes('pdf')) {
          window.open(media.url, '_blank');
          return;
      } else {
          content = `<img src="${media.url}" class="max-w-full max-h-[85vh] rounded shadow-2xl object-contain">`;
      }
      
      container.innerHTML = content;
      document.getElementById('lightbox-download').href = media.url;
      modal.classList.remove('hidden');
      modal.classList.add('flex');
  };
  
  document.getElementById('lightbox-close').onclick = () => document.getElementById('lightbox').classList.add('hidden');
  document.getElementById('lightbox-prev').onclick = () => {
      if(currentLightboxIndex > 0) openLightbox(currentLightboxIndex - 1);
  };
  document.getElementById('lightbox-next').onclick = () => {
      if(currentLightboxIndex < lightboxMedia.length - 1) openLightbox(currentLightboxIndex + 1);
  };

  // --- FORMS E AÇÕES ---
  
  // Nova OS
  document.getElementById('addOSBtn').onclick = () => {
      document.getElementById('osForm').reset();
      document.getElementById('osId').value = '';
      
      const select = document.getElementById('osResponsavel');
      select.innerHTML = '<option value="">Selecione...</option>' + USERS.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
      
      const modal = document.getElementById('osModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
  };

  document.getElementById('osForm').onsubmit = (e) => {
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
      // Log Inicial
      db.ref(`serviceOrders/${newRef.key}/logs`).push({
          timestamp: new Date().toISOString(),
          user: currentUser.name,
          description: "Veículo cadastrado na recepção",
          type: 'status'
      });
      
      document.getElementById('osModal').classList.add('hidden');
      showNotification('Nova O.S. criada com sucesso!', 'success');
  };

  // Log / Atualização
  document.getElementById('logForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Processando...`;
      
      const osId = document.getElementById('logOsId').value;
      const desc = document.getElementById('logDescricao').value;
      
      try {
          // Upload
          let mediaData = [];
          if (filesToUpload.length > 0) {
              btn.innerHTML = `<i class='bx bx-cloud-upload bx-spin'></i> Enviando Mídia...`;
              const promises = filesToUpload.map(f => uploadFileToCloudinary(f));
              const results = await Promise.all(promises);
              mediaData = results.map((res, i) => ({
                  url: res.url,
                  type: filesToUpload[i].type,
                  uploadedBy: currentUser.name,
                  timestamp: new Date().toISOString()
              }));
          }
          
          // Salva Log
          await db.ref(`serviceOrders/${osId}/logs`).push({
              timestamp: new Date().toISOString(),
              user: currentUser.name,
              description: desc,
              type: 'log',
              parts: document.getElementById('logPecas').value,
              value: document.getElementById('logValor').value
          });
          
          // Salva Media
          if (mediaData.length > 0) {
              mediaData.forEach(async (m) => {
                  await db.ref(`serviceOrders/${osId}/media`).push(m);
              });
          }
          
          showNotification('Atualização registrada!');
          e.target.reset();
          filesToUpload = [];
          document.getElementById('fileName').textContent = '';
          
          // Abre opções de mover
          document.getElementById('post-log-actions').classList.remove('hidden');
          
      } catch (err) {
          showNotification('Erro: ' + err.message, 'error');
      } finally {
          btn.disabled = false;
          btn.innerHTML = originalText;
      }
  };

  // Movimentação via Log
  document.getElementById('btn-move-next').onclick = () => moveStatusFromLog('next');
  document.getElementById('btn-move-prev').onclick = () => moveStatusFromLog('prev');
  document.getElementById('btn-stay').onclick = () => {
      document.getElementById('post-log-actions').classList.add('hidden');
  };

  const moveStatusFromLog = async (dir) => {
      const id = document.getElementById('logOsId').value;
      const os = allServiceOrders[id];
      const idx = STATUS_LIST.indexOf(os.status);
      let nextStatus = null;
      
      if(dir === 'next' && idx < STATUS_LIST.length - 1) nextStatus = STATUS_LIST[idx + 1];
      if(dir === 'prev' && idx > 0) nextStatus = STATUS_LIST[idx - 1];
      
      if(nextStatus) {
          await db.ref(`serviceOrders/${id}`).update({ status: nextStatus });
          await db.ref(`serviceOrders/${id}/logs`).push({
              timestamp: new Date().toISOString(),
              user: currentUser.name,
              description: `Fase alterada para: ${nextStatus.replace(/-/g, ' ')}`,
              type: 'status'
          });
          showNotification('Status atualizado!');
          document.getElementById('detailsModal').classList.add('hidden');
          document.getElementById('detailsModal').classList.remove('flex');
          document.getElementById('post-log-actions').classList.add('hidden');
      }
  };

  // Inputs de Arquivo
  const mediaInput = document.getElementById('media-input');
  mediaInput.onchange = (e) => {
      if(e.target.files.length > 0) {
          filesToUpload = Array.from(e.target.files);
          document.getElementById('fileName').textContent = `${filesToUpload.length} arquivos selecionados`;
      }
  };
  document.getElementById('openCameraBtn').onclick = () => {
      mediaInput.setAttribute('capture', 'environment');
      mediaInput.click();
  };
  document.getElementById('openGalleryBtn').onclick = () => {
      mediaInput.removeAttribute('capture');
      mediaInput.click();
  };

  // --- ADMIN E CLOUDINARY ---
  const listenToCloudinaryConfigs = () => {
    db.ref('cloudinaryConfigs').limitToLast(1).on('value', snapshot => {
      const val = snapshot.val();
      if (val) {
        const key = Object.keys(val)[0];
        activeCloudinaryConfig = { ...val[key], key };
      } else {
          // Se não tiver config, avisa admins
          if(currentUser && (currentUser.role === 'Gestor' || currentUser.role === 'Desenvolvedor')) {
              showNotification('ATENÇÃO: Configure a conta de mídia na engrenagem!', 'error');
          }
      }
    });
  };

  document.getElementById('adminBtn').onclick = () => {
      document.getElementById('adminModal').classList.remove('hidden');
      document.getElementById('adminModal').classList.add('flex');
  };

  document.getElementById('cloudinaryForm').onsubmit = (e) => {
      e.preventDefault();
      db.ref('cloudinaryConfigs').push({
          cloudName: document.getElementById('cloudNameInput').value.trim(),
          uploadPreset: document.getElementById('uploadPresetInput').value.trim(),
          updatedBy: currentUser.name,
          timestamp: firebase.database.ServerValue.TIMESTAMP
      });
      document.getElementById('adminModal').classList.add('hidden');
      showNotification('Configuração salva com sucesso!');
  };

  // Login Inicial
  const userSelect = document.getElementById('userSelect');
  userSelect.innerHTML = '<option value="">Selecione...</option>';
  USERS.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.name;
      opt.textContent = u.name;
      userSelect.appendChild(opt);
  });

  document.getElementById('loginForm').onsubmit = (e) => {
      e.preventDefault();
      const user = USERS.find(u => u.name === userSelect.value);
      const pass = document.getElementById('passwordInput').value;
      
      if(user && user.password === pass) {
          loginUser(user);
      } else {
          document.getElementById('loginError').textContent = "Senha incorreta.";
      }
  };

  // Checa Sessão Salva
  const saved = localStorage.getItem('centerCarSession');
  if(saved) {
      const data = JSON.parse(saved);
      // Valida timeout (logout automático diário)
      const loginDate = new Date(data.loginTime);
      const cutoff = new Date(); 
      cutoff.setHours(19,0,0,0);
      if(new Date() < cutoff) cutoff.setDate(cutoff.getDate()-1);
      
      if(loginDate > cutoff) {
          loginUser(data.user);
      } else {
          document.getElementById('userScreen').classList.remove('hidden');
      }
  } else {
      document.getElementById('userScreen').classList.remove('hidden');
  }

  // Fechar Modais
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.onclick = (e) => {
          e.target.closest('.modal').classList.add('hidden');
          e.target.closest('.modal').classList.remove('flex');
      };
  });
  
  // Função Global de Deletar Media
  window.deleteMedia = (osId, mediaKey) => {
      if(confirm('Tem certeza que deseja apagar esta mídia?')) {
          db.ref(`serviceOrders/${osId}/media/${mediaKey}`).remove();
          showNotification('Mídia apagada.');
      }
  };
});
