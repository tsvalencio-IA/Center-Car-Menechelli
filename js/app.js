/* ==================================================================
   DASHBOARD CENTER CAR MENECHELLI - V3.1 (MASTER)
   Funcionalidades: PDF Pro, Navegação Rápida, Admin Power
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

// --- ESTADO GLOBAL ---
let activeCloudinaryConfig = null;
let currentUser = null;
let allServiceOrders = {};
let allUsers = [];
let filesToUpload = [];

// STATUS DO KANBAN (Ordem fixa)
const STATUS_LIST = [ 
    'Aguardando-Mecanico', 'Em-Analise', 'Orcamento-Enviado', 
    'Aguardando-Aprovacao', 'Servico-Autorizado', 'Em-Execucao', 
    'Finalizado-Aguardando-Retirada', 'Entregue' 
];

function showNotification(message, type = 'success') {
  const existing = document.getElementById('notification');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.id = 'notification';
  div.className = `fixed top-5 right-5 z-[200] px-6 py-4 rounded-xl shadow-2xl text-white font-bold transform transition-all duration-300 translate-x-full flex items-center gap-3 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`;
  div.innerHTML = `<i class='bx ${type === 'success' ? 'bx-check-circle' : 'bx-error-circle'} text-2xl'></i> <span>${message}</span>`;
  document.body.appendChild(div);
  requestAnimationFrame(() => div.classList.remove('translate-x-full'));
  setTimeout(() => { div.classList.add('translate-x-full'); setTimeout(() => div.remove(), 300); }, 4000);
}

const uploadFileToCloudinary = async (file) => {
  if (!activeCloudinaryConfig) throw new Error('ERRO: Configure o Cloudinary na Engrenagem!');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', activeCloudinaryConfig.uploadPreset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${activeCloudinaryConfig.cloudName}/auto/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Falha no upload da imagem.');
  return await res.json();
};

document.addEventListener('DOMContentLoaded', () => {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  // --- 1. USUÁRIOS E LOGIN ---
  db.ref('users').on('value', snap => {
      const data = snap.val();
      const select = document.getElementById('userSelect');
      select.innerHTML = '<option value="">Selecione...</option>';
      allUsers = [];
      if (!data) db.ref('users').push({ name: 'Thiago Ventura Valencio', role: 'Gestor', password: 'dev' });
      else Object.entries(data).forEach(([k, u]) => { u.id = k; allUsers.push(u); select.innerHTML += `<option value="${u.id}">${u.name}</option>`; });
      renderAdminUserList();
  });

  db.ref('cloudinaryConfigs').limitToLast(1).on('value', s => { if(s.val()) activeCloudinaryConfig = Object.values(s.val())[0]; });

  document.getElementById('loginForm').onsubmit = (e) => {
      e.preventDefault();
      const user = allUsers.find(u => u.id === document.getElementById('userSelect').value);
      if (user && user.password === document.getElementById('passwordInput').value) loginUser(user);
      else document.getElementById('loginError').textContent = "Senha Incorreta!";
  };

  const loginUser = (user) => {
      currentUser = user;
      document.getElementById('userScreen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      document.getElementById('app').classList.add('flex');
      document.getElementById('currentUserName').textContent = user.name;
      
      const isMaster = user.role === 'Gestor' || user.name === 'Thiago Ventura Valencio';
      if (isMaster) document.getElementById('adminControls').classList.remove('hidden');
      
      initKanban();
      listenOS();
  };

  // --- 2. KANBAN E CARDS ---
  const initKanban = () => {
      document.getElementById('kanbanBoard').innerHTML = STATUS_LIST.map(s => `
        <div class="status-column">
            <div class="p-3 bg-gray-200 rounded-t-xl flex justify-between items-center border-b border-gray-300 sticky top-0 z-10">
                <span class="font-bold text-gray-700 text-sm uppercase">${s.replace(/-/g, ' ')}</span>
                <span class="bg-white px-2 py-0.5 rounded-full text-xs font-bold shadow-sm" id="count-${s}">0</span>
            </div>
            <div class="vehicle-list space-y-3 p-2" id="col-${s}"></div>
        </div>`).join('');
  };

  const listenOS = () => {
      db.ref('serviceOrders').on('value', snap => {
          allServiceOrders = snap.val() || {};
          STATUS_LIST.forEach(s => { 
              document.getElementById(`col-${s}`).innerHTML = ''; 
              document.getElementById(`count-${s}`).innerText = '0';
          });
          Object.entries(allServiceOrders).forEach(([id, os]) => {
              os.id = id;
              document.getElementById(`col-${os.status}`).innerHTML += createCard(os);
          });
          STATUS_LIST.forEach(s => document.getElementById(`count-${s}`).innerText = document.getElementById(`col-${s}`).children.length);
          updateAlerts();
      });
  };

  const createCard = (os) => {
      const colors = { 'vermelho': 'border-red-500 bg-red-50', 'amarelo': 'border-yellow-500', 'verde': 'border-l-4 border-gray-300' };
      const blink = os.priority === 'vermelho' ? 'animate-pulse' : '';
      
      return `
      <div class="vehicle-card group relative ${colors[os.priority] || colors['verde']}" onclick="openDetails('${os.id}')">
          <div class="flex justify-between items-center mb-1">
              <span class="font-black text-gray-800 text-lg ${blink}">${os.placa}</span>
              ${os.priority === 'vermelho' ? '<i class="bx bxs-hot text-red-600"></i>' : ''}
          </div>
          <div class="text-xs font-bold text-blue-700 uppercase truncate mb-1">${os.modelo}</div>
          <div class="text-[10px] text-gray-500 flex items-center gap-1"><i class='bx bxs-user'></i> ${os.cliente.split(' ')[0]}</div>
          
          <!-- SETAS DE NAVEGAÇÃO RÁPIDA (APARECEM NO HOVER) -->
          <div class="absolute bottom-2 right-2 hidden group-hover:flex gap-1 bg-white p-1 rounded shadow-sm z-20">
              <button class="p-1 hover:bg-gray-200 rounded text-gray-600" onclick="event.stopPropagation(); quickMove('${os.id}', 'prev')" title="Voltar Etapa"><i class='bx bx-chevron-left'></i></button>
              <button class="p-1 hover:bg-gray-200 rounded text-gray-600" onclick="event.stopPropagation(); quickMove('${os.id}', 'next')" title="Avançar Etapa"><i class='bx bx-chevron-right'></i></button>
          </div>
      </div>`;
  };

  // --- 3. DETALHES E FUNÇÕES DE ADMIN ---
  window.openDetails = (id) => {
      const os = allServiceOrders[id];
      if(!os) return;
      document.getElementById('logOsId').value = id;
      
      // Reseta UI para estado inicial (Form visível, botões de mover ocultos)
      document.getElementById('logFormContainer').classList.remove('hidden');
      document.getElementById('post-log-actions').classList.add('hidden');

      document.getElementById('detailsHeader').innerHTML = `
          <div class="flex justify-between items-start">
              <div>
                  <h1 class="text-3xl font-black text-gray-900">${os.placa}</h1>
                  <p class="text-lg text-blue-700 font-bold uppercase">${os.modelo}</p>
              </div>
              <span class="bg-gray-200 px-3 py-1 rounded text-sm font-bold tracking-wider">${os.status.replace(/-/g, ' ')}</span>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded border border-gray-200">
              <div><span class="text-gray-500 block text-xs">CLIENTE</span><span class="font-bold">${os.cliente}</span></div>
              <div><span class="text-gray-500 block text-xs">CONTATO</span><span class="font-bold">${os.telefone}</span></div>
              <div><span class="text-gray-500 block text-xs">KM</span><span class="font-bold">${os.km}</span></div>
              <div><span class="text-gray-500 block text-xs">TÉCNICO</span><span class="font-bold">${os.responsible}</span></div>
          </div>
      `;
      
      const obsEl = document.getElementById('detailsObservacoes');
      if(os.observacoes) {
          obsEl.innerHTML = `<i class='bx bxs-error-circle'></i> <strong>RECLAMAÇÃO:</strong> ${os.observacoes}`;
          obsEl.classList.remove('hidden');
      } else { obsEl.classList.add('hidden'); }

      // Botão Excluir (Super Admin)
      const isMaster = currentUser.role === 'Gestor' || currentUser.name === 'Thiago Ventura Valencio';
      const delBtn = document.getElementById('deleteOsBtn');
      if (isMaster) {
          delBtn.classList.remove('hidden');
          delBtn.onclick = () => {
              if(confirm('ATENÇÃO: Excluir esta OS apagará TODO o histórico. Confirmar?')) {
                  db.ref(`serviceOrders/${id}`).remove();
                  document.getElementById('detailsModal').classList.add('hidden');
              }
          };
      } else { delBtn.classList.add('hidden'); }

      // PDF EXPORT
      document.getElementById('exportOsBtn').onclick = () => generatePDF(os);

      renderTimeline(os);
      renderGallery(os);
      document.getElementById('detailsModal').classList.remove('hidden');
      document.getElementById('detailsModal').classList.add('flex');
  };

  // --- 4. GERAÇÃO DE PDF PROFISSIONAL ---
  const generatePDF = (os) => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      // Cabeçalho Azul
      doc.setFillColor(20, 30, 90); 
      doc.rect(0, 0, 210, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("CENTER CAR MENECHELLI", 105, 18, null, null, "center");
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Ficha Técnica de Manutenção Automotiva", 105, 26, null, null, "center");

      // Dados do Veículo
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`OS: ${os.placa}`, 14, 48);
      
      doc.autoTable({
          startY: 52,
          head: [['Veículo/Modelo', 'Cliente', 'Telefone', 'KM Atual', 'Técnico']],
          body: [[os.modelo, os.cliente, os.telefone, os.km, os.responsible]],
          theme: 'grid',
          headStyles: { fillColor: [20, 30, 90], textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 10, cellPadding: 3 }
      });

      let finalY = doc.lastAutoTable.finalY + 10;

      // Reclamação
      if (os.observacoes) {
          doc.setFillColor(255, 235, 235);
          doc.rect(14, finalY, 182, 15, 'F');
          doc.setTextColor(180, 0, 0);
          doc.setFontSize(10);
          doc.text(`QUEIXA DO CLIENTE: ${os.observacoes}`, 18, finalY + 10);
          finalY += 25;
      }

      // Histórico
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text("Histórico de Serviços & Peças", 14, finalY);

      const historyData = os.logs ? Object.values(os.logs).map(l => [
          new Date(l.timestamp).toLocaleString(),
          l.user,
          l.description,
          l.parts || '-',
          l.value ? `R$ ${l.value}` : '-'
      ]) : [];

      if (historyData.length > 0) {
          doc.autoTable({
              startY: finalY + 5,
              head: [['Data/Hora', 'Responsável', 'Descrição do Serviço', 'Peças Utilizadas', 'Valor']],
              body: historyData,
              theme: 'striped',
              styles: { fontSize: 9 },
              headStyles: { fillColor: [100, 100, 100] }
          });
      } else {
          doc.setFontSize(10);
          doc.setTextColor(100);
          doc.text("Nenhum registro de atividade até o momento.", 14, finalY + 10);
      }

      // Rodapé
      const pageCount = doc.internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(`Gerado via Sistema thIAguinho em ${new Date().toLocaleString()}`, 10, 285);
          doc.text(`Página ${i} de ${pageCount}`, 200, 285, null, null, "right");
      }

      doc.save(`${os.placa}_Ficha_Tecnica.pdf`);
  };

  // --- 5. LOGS, TIMELINE E MÍDIA ---
  document.getElementById('logForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      const originalText = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Salvando...";
      const osId = document.getElementById('logOsId').value;
      
      try {
          // Upload de Imagens
          if(filesToUpload.length > 0) {
              const uploads = filesToUpload.map(f => uploadFileToCloudinary(f));
              const res = await Promise.all(uploads);
              res.forEach(r => db.ref(`serviceOrders/${osId}/media`).push({ url: r.url, type: r.type, timestamp: new Date().toISOString() }));
          }
          
          // Salvar Log Texto
          if(document.getElementById('logDescricao').value.trim() !== "" || filesToUpload.length > 0) {
              db.ref(`serviceOrders/${osId}/logs`).push({
                  user: currentUser.name,
                  timestamp: new Date().toISOString(),
                  description: document.getElementById('logDescricao').value || "Mídia adicionada",
                  parts: document.getElementById('logPecas').value,
                  value: document.getElementById('logValor').value
              });
          }
          
          e.target.reset(); filesToUpload = []; document.getElementById('fileName').innerText = "";
          showNotification('Registro salvo com sucesso!');
          
          // MOSTRA BOTÕES DE MOVER (Fluxo Inteligente)
          document.getElementById('logFormContainer').classList.add('hidden');
          document.getElementById('post-log-actions').classList.remove('hidden');
          
      } catch(err) { alert(err.message); }
      btn.disabled = false; btn.innerHTML = originalText;
  };

  window.quickMove = (id, dir) => {
      const os = allServiceOrders[id];
      const idx = STATUS_LIST.indexOf(os.status);
      let next = null;
      if(dir === 'next' && idx < STATUS_LIST.length - 1) next = STATUS_LIST[idx + 1];
      if(dir === 'prev' && idx > 0) next = STATUS_LIST[idx - 1];
      
      if(next) {
          db.ref(`serviceOrders/${id}`).update({ status: next });
          showNotification(`Movido para: ${next.replace(/-/g, ' ')}`);
          // Se estiver no modal, reseta a view
          document.getElementById('logFormContainer').classList.remove('hidden');
          document.getElementById('post-log-actions').classList.add('hidden');
      }
  };

  document.getElementById('btn-move-next').onclick = () => window.quickMove(document.getElementById('logOsId').value, 'next');
  document.getElementById('btn-move-prev').onclick = () => window.quickMove(document.getElementById('logOsId').value, 'prev');
  document.getElementById('btn-stay').onclick = () => {
      document.getElementById('logFormContainer').classList.remove('hidden');
      document.getElementById('post-log-actions').classList.add('hidden');
  };

  // --- HELPERS E ADMIN ---
  const renderTimeline = (os) => {
      const container = document.getElementById('timelineContainer');
      if (!os.logs) { container.innerHTML = '<p class="text-gray-400 text-center text-xs py-4">Sem histórico.</p>'; return; }
      
      const logs = Object.entries(os.logs).sort((a,b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
      const isMaster = currentUser.role === 'Gestor' || currentUser.name === 'Thiago Ventura Valencio';

      container.innerHTML = logs.map(([key, log]) => `
          <div class="relative pl-4 pb-6 border-l-2 border-blue-100 last:pb-0">
              <div class="absolute -left-[5px] top-1 w-2.5 h-2.5 bg-blue-600 rounded-full"></div>
              <div class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                  <div class="flex justify-between text-xs text-gray-500 mb-1">
                      <span class="font-bold text-blue-900 uppercase">${log.user}</span>
                      <span>${new Date(log.timestamp).toLocaleDateString()}</span>
                  </div>
                  <p class="text-sm text-gray-800">${log.description}</p>
                  ${log.parts ? `<div class="mt-2 text-xs bg-gray-50 p-2 rounded border border-gray-100 flex justify-between"><span>🔧 ${log.parts}</span> <span class="font-bold text-green-600">R$ ${log.value}</span></div>` : ''}
                  ${isMaster ? `<button onclick="deleteLog('${os.id}', '${key}')" class="text-[10px] text-red-400 hover:text-red-600 mt-2 block w-full text-right">Apagar</button>` : ''}
              </div>
          </div>
      `).join('');
  };
  
  window.deleteLog = (osId, k) => { if(confirm('Apagar?')) db.ref(`serviceOrders/${osId}/logs/${k}`).remove(); };

  const renderGallery = (os) => {
      const grid = document.getElementById('thumbnail-grid');
      if(!os.media) { grid.innerHTML = '<p class="col-span-full text-center text-gray-400 text-xs">Sem mídia.</p>'; return; }
      const isMaster = currentUser.role === 'Gestor' || currentUser.name === 'Thiago Ventura Valencio';
      grid.innerHTML = Object.entries(os.media).map(([k, m]) => `
          <div class="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
              <img src="${m.url}" class="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform" onclick="window.open('${m.url}')">
              ${isMaster ? `<button onclick="deleteMedia('${os.id}', '${k}')" class="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition">&times;</button>` : ''}
          </div>
      `).join('');
  };
  
  window.deleteMedia = (osId, k) => { if(confirm('Apagar foto?')) db.ref(`serviceOrders/${osId}/media/${k}`).remove(); };

  // Admin Modals e Forms
  document.getElementById('adminBtn').onclick = () => { document.getElementById('adminModal').classList.remove('hidden'); document.getElementById('adminModal').classList.add('flex'); };
  
  const renderAdminUserList = () => {
      const list = document.getElementById('usersList');
      if(!list) return;
      list.innerHTML = allUsers.map(u => `<div class="flex justify-between p-3 bg-gray-50 rounded border items-center"><div><span class="font-bold">${u.name}</span> <span class="text-xs text-gray-500">(${u.role})</span></div>${u.name !== 'Thiago Ventura Valencio' ? `<button onclick="removeUser('${u.id}')" class="text-red-500"><i class='bx bxs-trash'></i></button>` : ''}</div>`).join('');
  };
  window.removeUser = (id) => { if(confirm('Remover?')) db.ref(`users/${id}`).remove(); };

  document.getElementById('addUserForm').onsubmit = (e) => {
      e.preventDefault();
      db.ref('users').push({ name: document.getElementById('newUserName').value, role: document.getElementById('newUserRole').value, password: document.getElementById('newUserPass').value });
      e.target.reset(); showNotification('Usuário Criado');
  };

  document.getElementById('cloudinaryForm').onsubmit = (e) => {
      e.preventDefault();
      db.ref('cloudinaryConfigs').push({ cloudName: document.getElementById('cloudNameInput').value, uploadPreset: document.getElementById('uploadPresetInput').value, updatedBy: currentUser.name });
      showNotification('Configuração Salva');
  };

  // Tabs
  document.querySelectorAll('.admin-tab').forEach(t => t.onclick = () => {
      document.querySelectorAll('.admin-tab').forEach(x => { x.classList.remove('active', 'border-blue-600', 'text-blue-600', 'bg-blue-50/30'); x.classList.add('text-gray-500'); });
      t.classList.add('active', 'border-blue-600', 'text-blue-600', 'bg-blue-50/30'); t.classList.remove('text-gray-500');
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById(t.dataset.target).classList.remove('hidden');
  });

  // Upload Buttons
  const mediaInput = document.getElementById('media-input');
  mediaInput.onchange = (e) => { if(e.target.files.length) { filesToUpload = Array.from(e.target.files); document.getElementById('fileName').innerText = `${filesToUpload.length} arquivos`; } };
  document.getElementById('openCameraBtn').onclick = () => mediaInput.click();
  document.getElementById('openGalleryBtn').onclick = () => mediaInput.click();

  // Create OS
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

  // Alerts & Toggle
  const updateAlerts = () => {
      const p = document.getElementById('attention-panel');
      const alerts = Object.values(allServiceOrders).filter(o => o.status === 'Aguardando-Mecanico' || o.status === 'Servico-Autorizado');
      document.getElementById('alert-led').classList.toggle('hidden', alerts.length === 0);
      p.innerHTML = alerts.map(o => `<div class="bg-white p-2 rounded border-l-4 ${o.status.includes('Aguardando') ? 'border-yellow-500' : 'border-green-500'} shadow text-xs cursor-pointer" onclick="openDetails('${o.id}')"><strong>${o.status}</strong>: ${o.placa}</div>`).join('');
  };
  document.getElementById('toggle-panel-btn').onclick = () => {
      const p = document.getElementById('attention-panel-container');
      p.style.maxHeight = p.style.maxHeight === '300px' ? '0' : '300px';
  };

  document.querySelectorAll('.btn-close-modal').forEach(b => b.onclick = (e) => e.target.closest('.modal').classList.add('hidden'));
});
