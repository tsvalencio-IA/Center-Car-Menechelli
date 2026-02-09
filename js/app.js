/* ==================================================================
   DASHBOARD CENTER CAR MENECHELLI - V3.5 (PREMIUM GRID)
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

let activeCloudinaryConfig = null;
let currentUser = null;
let allServiceOrders = {};
let lightboxMedia = [];
let currentLightboxIndex = 0;
let filesToUpload = [];

// STATUS EXATOS DO SISTEMA
const STATUS_LIST = [ 
    'Aguardando-Mecanico', 'Em-Analise', 'Orcamento-Enviado', 
    'Aguardando-Aprovacao', 'Servico-Autorizado', 'Em-Execucao', 
    'Finalizado-Aguardando-Retirada', 'Entregue' 
];

// --- SISTEMA DE NOTIFICAÇÕES (Toast) ---
function showNotification(message, type = 'success') {
  const div = document.createElement('div');
  div.className = `notification ${type}`;
  div.innerHTML = `<i class='bx ${type === 'success' ? 'bx-check-circle' : 'bx-error-circle'} text-xl'></i> <span class="font-bold text-sm">${message}</span>`;
  document.body.appendChild(div);
  
  // Animação entrada
  requestAnimationFrame(() => div.classList.add('show'));
  
  // Remoção automática
  setTimeout(() => {
      div.classList.remove('show');
      setTimeout(() => div.remove(), 300);
  }, 4000);
}

// --- UPLOAD CLOUDINARY ---
const uploadFileToCloudinary = async (file) => {
  if (!activeCloudinaryConfig) throw new Error('Mídia não configurada no Admin.');
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', activeCloudinaryConfig.uploadPreset);
  
  const res = await fetch(`https://api.cloudinary.com/v1_1/${activeCloudinaryConfig.cloudName}/auto/upload`, {
      method: 'POST', body: formData
  });
  
  if (!res.ok) throw new Error('Erro ao enviar imagem.');
  const data = await res.json();
  return { url: data.secure_url, type: data.resource_type };
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  // 1. CARREGAR USUÁRIOS
  db.ref('users').on('value', snap => {
      const data = snap.val();
      const select = document.getElementById('userSelect');
      select.innerHTML = '<option value="">Selecione...</option>';
      const allUsers = [];

      if (data) {
          Object.entries(data).forEach(([key, user]) => {
              user.id = key;
              allUsers.push(user);
              const opt = document.createElement('option');
              opt.value = JSON.stringify({id: key, name: user.name, role: user.role, password: user.password});
              opt.textContent = user.name;
              select.appendChild(opt);
          });
      }
  });

  // 2. CARREGAR CONFIG DE MÍDIA
  db.ref('cloudinaryConfigs').limitToLast(1).on('value', snap => {
      const val = snap.val();
      if(val) activeCloudinaryConfig = Object.values(val)[0];
  });

  // 3. LOGIN
  document.getElementById('loginForm').onsubmit = (e) => {
      e.preventDefault();
      const selectVal = document.getElementById('userSelect').value;
      const pass = document.getElementById('passwordInput').value;
      
      if(!selectVal) return;
      const user = JSON.parse(selectVal);

      if (user.password === pass) {
          currentUser = user;
          document.getElementById('userScreen').classList.add('hidden');
          document.getElementById('app').classList.remove('hidden');
          document.getElementById('app').classList.add('flex');
          document.getElementById('currentUserName').textContent = user.name.split(' ')[0];
          
          if(user.role === 'Gestor' || user.name.includes('Thiago')) {
              document.getElementById('adminBtn').classList.remove('hidden');
              document.getElementById('reportsBtn').classList.remove('hidden');
              document.getElementById('adminZone').classList.remove('hidden');
          }
          
          initKanban();
          listenOS();
      } else {
          document.getElementById('loginError').textContent = "SENHA INCORRETA";
      }
  };

  // 4. KANBAN (GRID SYSTEM)
  const initKanban = () => {
      const board = document.getElementById('kanbanBoard');
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

  // 5. ESCUTAR OS (REALTIME)
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
              const el = document.getElementById(`count-${s}`);
              if(el) el.innerText = document.getElementById(`col-${s}`).children.length;
          });
          
          updateAlerts();
          
          // Atualiza modal se aberto
          const openLogId = document.getElementById('logOsId').value;
          if(openLogId && allServiceOrders[openLogId] && !document.getElementById('detailsModal').classList.contains('hidden')) {
              renderTimeline(allServiceOrders[openLogId]);
              renderGallery(allServiceOrders[openLogId]);
          }
      });
  };

  const createCard = (os) => {
      // Prioridade Visual
      let prioDot = '';
      if(os.priority === 'verde') prioDot = '<span class="priority-dot bg-prio-verde" title="Normal"></span>';
      if(os.priority === 'amarelo') prioDot = '<span class="priority-dot bg-prio-amarelo" title="Atenção"></span>';
      if(os.priority === 'vermelho') prioDot = '<span class="priority-dot bg-prio-vermelho" title="Urgente"></span>';

      return `
      <div class="vehicle-card status-${os.status}" onclick="openDetails('${os.id}')">
          <div class="flex justify-between items-start mb-1">
              <div class="font-black text-slate-800 text-lg leading-none">${prioDot} ${os.placa}</div>
              ${os.priority === 'vermelho' ? '<i class="bx bxs-hot text-red-500 animate-pulse"></i>' : ''}
          </div>
          <div class="text-xs font-bold text-blue-700 uppercase mb-2 truncate">${os.modelo}</div>
          <div class="border-t border-dashed border-gray-200 pt-2 flex justify-between items-center text-[10px] text-gray-500 font-medium">
             <span class="flex items-center gap-1"><i class='bx bxs-user'></i> ${os.cliente.split(' ')[0]}</span>
             <span>${os.km ? os.km + ' km' : ''}</span>
          </div>
      </div>`;
  };

  // 6. DETALHES & LÓGICA
  window.openDetails = (id) => {
      const os = allServiceOrders[id];
      if(!os) return;
      
      document.getElementById('logOsId').value = id;
      document.getElementById('modalTitlePlaca').textContent = os.placa;
      document.getElementById('modalTitleModelo').textContent = `${os.modelo} • ${os.cliente}`;
      
      // Reseta forms
      document.getElementById('logForm').reset();
      document.getElementById('fileName').innerText = '';
      filesToUpload = [];
      document.getElementById('post-log-actions').classList.add('hidden');
      
      // Info Card
      document.getElementById('detailsInfoContent').innerHTML = `
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
              <div><p class="text-xs text-slate-400 uppercase font-bold">Telefone</p><p class="font-bold text-slate-700">${os.telefone || '-'}</p></div>
              <div><p class="text-xs text-slate-400 uppercase font-bold">KM Atual</p><p class="font-bold text-slate-700">${os.km || '-'}</p></div>
              <div><p class="text-xs text-slate-400 uppercase font-bold">Consultor</p><p class="font-bold text-slate-700">${os.responsible || '-'}</p></div>
              <div><p class="text-xs text-slate-400 uppercase font-bold">Entrada</p><p class="font-bold text-slate-700">${new Date(os.createdAt).toLocaleDateString('pt-BR')}</p></div>
          </div>
          ${os.observacoes ? `
          <div class="bg-red-50 border-l-4 border-red-400 p-3 rounded text-sm text-red-800">
              <span class="font-bold block text-xs uppercase mb-1">Queixa do Cliente:</span>
              ${os.observacoes}
          </div>` : ''}
      `;

      // Configurar Botão Excluir
      const delBtn = document.getElementById('deleteOsBtn');
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

      // Configurar Impressão (AÇÃO CORRIGIDA)
      document.getElementById('exportOsBtn').onclick = () => printOS(os);

      renderTimeline(os);
      renderGallery(os);
      document.getElementById('detailsModal').classList.remove('hidden');
  };

  // --- IMPRESSÃO PERFEITA (PADRÃO CHEVRON/MENECHELLI) ---
  const printOS = (os) => {
      const logs = os.logs ? Object.values(os.logs).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)) : [];
      let totalPecas = 0;
      let totalServicos = 0; // Se tivesse campo separado, mas vamos somar tudo no valor

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

      const midia = os.media ? Object.values(os.media).filter(m => m.type.includes('image')).slice(0, 6) : []; // Max 6 fotos no print
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
                    <div><strong>Modelo:</strong> ${os.modelo}</div>
                    <div><strong>KM:</strong> ${os.km || '-'}</div>
                    <div><strong>Cliente:</strong> ${os.cliente}</div>
                    <div><strong>Tel:</strong> ${os.telefone || '-'}</div>
                    <div><strong>Consultor:</strong> ${os.responsible}</div>
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
              ${currentUser.role === 'Gestor' ? `<button onclick="deleteLog('${os.id}','${key}')" class="text-[10px] text-red-300 hover:text-red-500 mt-1">Excluir</button>` : ''}
          </div>
      `).join('');
  };

  window.deleteLog = (osId, key) => { if(confirm('Excluir log?')) db.ref(`serviceOrders/${osId}/logs/${key}`).remove(); };

  const renderGallery = (os) => {
      const grid = document.getElementById('thumbnail-grid');
      if(!os.media) { grid.innerHTML = '<p class="col-span-full text-center text-slate-400 text-xs py-2">Sem fotos.</p>'; return; }
      
      const midia = Object.entries(os.media);
      lightboxMedia = midia.map(m => m[1]); // array de objetos url/type

      grid.innerHTML = midia.map(([key, m], idx) => `
          <div class="aspect-square bg-slate-100 rounded-lg overflow-hidden relative group border border-slate-200 cursor-pointer" onclick="openLightbox(${idx})">
              ${m.type.includes('video') ? '<div class="absolute inset-0 flex items-center justify-center text-blue-500 text-3xl"><i class="bx bx-play-circle"></i></div>' : `<img src="${m.url}" class="w-full h-full object-cover">`}
              
              ${currentUser.role === 'Gestor' ? `<button onclick="event.stopPropagation(); deleteMedia('${os.id}','${key}')" class="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center shadow">&times;</button>` : ''}
          </div>
      `).join('');
  };

  window.deleteMedia = (osId, key) => { if(confirm('Apagar imagem?')) db.ref(`serviceOrders/${osId}/media/${key}`).remove(); };
  
  window.openLightbox = (idx) => {
      currentLightboxIndex = idx;
      const m = lightboxMedia[idx];
      const content = document.getElementById('lightbox-content');
      
      if(m.type.includes('image')) content.innerHTML = `<img src="${m.url}" class="max-w-full max-h-full object-contain rounded shadow-2xl">`;
      else if(m.type.includes('video')) content.innerHTML = `<video src="${m.url}" controls autoplay class="max-w-full max-h-full rounded shadow-2xl"></video>`;
      else window.open(m.url);

      document.getElementById('lightbox-download').href = m.url;
      document.getElementById('lightbox').classList.remove('hidden');
      document.getElementById('lightbox').classList.add('flex');
  };

  // --- LOGIC FORM ---
  document.getElementById('logForm').onsubmit = async (e) => {
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
          
          if(document.getElementById('logDescricao').value) {
              await db.ref(`serviceOrders/${osId}/logs`).push({
                  user: currentUser.name,
                  timestamp: new Date().toISOString(),
                  description: document.getElementById('logDescricao').value,
                  parts: document.getElementById('logPecas').value,
                  value: document.getElementById('logValor').value
              });
          }
          
          showNotification('Atualizado!');
          e.target.reset();
          filesToUpload = []; 
          document.getElementById('fileName').innerText = '';
          
          // Mostrar Mover
          document.getElementById('post-log-actions').classList.remove('hidden');
          
      } catch(err) {
          showNotification(err.message, 'error');
      } finally {
          btn.disabled = false; btn.innerHTML = originalText;
      }
  };

  // --- MOVIMENTAÇÃO RÁPIDA ---
  const moveStatus = (dir) => {
      const id = document.getElementById('logOsId').value;
      const os = allServiceOrders[id];
      const idx = STATUS_LIST.indexOf(os.status);
      let newStatus = null;
      
      if(dir === 'next' && idx < STATUS_LIST.length - 1) newStatus = STATUS_LIST[idx + 1];
      if(dir === 'prev' && idx > 0) newStatus = STATUS_LIST[idx - 1];
      
      if(newStatus) {
          db.ref(`serviceOrders/${id}`).update({status: newStatus, lastUpdate: new Date().toISOString()});
          
          // Log automático de movimento
          db.ref(`serviceOrders/${id}/logs`).push({
              user: 'SISTEMA',
              timestamp: new Date().toISOString(),
              description: `Status alterado: ${os.status} ➔ ${newStatus}`,
              type: 'status'
          });
          
          showNotification('Veículo movido!');
          document.getElementById('detailsModal').classList.add('hidden');
      }
  };
  
  document.getElementById('btn-move-next').onclick = () => moveStatus('next');
  document.getElementById('btn-move-prev').onclick = () => moveStatus('prev');
  document.getElementById('btn-stay').onclick = () => document.getElementById('post-log-actions').classList.add('hidden');

  // --- ALERTA PAINEL ---
  const updateAlerts = () => {
      const alertPanel = document.getElementById('attention-panel');
      const container = document.getElementById('attention-panel-container');
      const led = document.getElementById('alert-led');
      
      const alerts = Object.values(allServiceOrders).filter(o => 
          o.status === 'Aguardando-Mecanico' || o.status === 'Servico-Autorizado'
      );
      
      if(alerts.length > 0) {
          led.classList.remove('hidden');
          led.classList.add('animate-ping');
      } else {
          led.classList.add('hidden');
      }
      
      alertPanel.innerHTML = alerts.map(o => `
          <div class="bg-slate-700 p-3 rounded border-l-4 ${o.status.includes('Mecanico') ? 'border-yellow-500' : 'border-green-500'} cursor-pointer hover:bg-slate-600 transition" onclick="openDetails('${o.id}')">
              <p class="text-[10px] font-bold text-white uppercase opacity-70">${o.status.replace(/-/g,' ')}</p>
              <div class="flex justify-between items-center text-white font-bold">
                  <span>${o.placa}</span> <span class="text-xs font-normal opacity-50">${o.modelo}</span>
              </div>
          </div>
      `).join('');
  };
  
  document.getElementById('toggle-panel-btn').onclick = () => {
      const c = document.getElementById('attention-panel-container');
      c.style.maxHeight = c.style.maxHeight === '0px' || c.style.maxHeight === '' ? '300px' : '0px';
  };

  // --- MEDIA INPUTS ---
  const fileInp = document.getElementById('media-input');
  fileInp.onchange = (e) => {
      if(e.target.files.length) {
          filesToUpload = Array.from(e.target.files);
          document.getElementById('fileName').innerText = `${filesToUpload.length} arquivo(s) selecionado(s)`;
      }
  };
  document.getElementById('openCameraBtn').onclick = () => { fileInp.setAttribute('capture','environment'); fileInp.click(); };
  document.getElementById('openGalleryBtn').onclick = () => { fileInp.removeAttribute('capture'); fileInp.click(); };

  // --- MODAL UTILS ---
  document.querySelectorAll('.btn-close-modal').forEach(b => b.onclick = (e) => {
      e.target.closest('.modal').classList.add('hidden');
      document.getElementById('lightbox').classList.add('hidden'); // Fecha lightbox tb se for o botão de lá
  });
  
  document.getElementById('lightbox-close').onclick = () => document.getElementById('lightbox').classList.add('hidden');
  document.getElementById('lightbox-next').onclick = () => { if(currentLightboxIndex < lightboxMedia.length-1) openLightbox(currentLightboxIndex+1); };
  document.getElementById('lightbox-prev').onclick = () => { if(currentLightboxIndex > 0) openLightbox(currentLightboxIndex-1); };
  
  // --- NOVA OS E FILTROS ---
  document.getElementById('addOSBtn').onclick = () => {
      document.getElementById('osForm').reset();
      const sel = document.getElementById('osResponsavel');
      // Re-popula select de usuários
      const userSelectLogin = document.getElementById('userSelect');
      sel.innerHTML = userSelectLogin.innerHTML;
      document.getElementById('osModal').classList.remove('hidden');
      document.getElementById('osModal').classList.add('flex');
  };
  
  document.getElementById('osForm').onsubmit = (e) => {
      e.preventDefault();
      const prio = document.querySelector('input[name="osPrioridade"]:checked').value;
      const respJson = document.getElementById('osResponsavel').value;
      const respName = respJson ? JSON.parse(respJson).name : 'Não Atribuído';

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

  document.getElementById('globalSearchInput').oninput = (e) => {
      const term = e.target.value.toUpperCase();
      const res = document.getElementById('globalSearchResults');
      
      if(term.length < 2) { res.classList.add('hidden'); return; }
      
      const found = Object.values(allServiceOrders).filter(o => 
          o.placa.includes(term) || o.cliente.toUpperCase().includes(term) || o.modelo.toUpperCase().includes(term)
      );
      
      if(found.length) {
          res.innerHTML = found.map(o => `
              <div class="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-0 flex justify-between items-center" onclick="openDetails('${o.id}'); document.getElementById('globalSearchResults').classList.add('hidden')">
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
  
  document.getElementById('logoutButton').onclick = () => location.reload();
});
