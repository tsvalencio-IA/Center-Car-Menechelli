/* ==================================================================
   DASHBOARD CENTER CAR MENECHELLI - V3.0 (PRO)
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

// --- VARIÁVEIS GLOBAIS ---
let activeCloudinaryConfig = null;
let currentUser = null;
let allServiceOrders = {};
let allUsers = []; 
let lightboxMedia = [];
let currentLightboxIndex = 0;
let filesToUpload = [];

// --- STATUS ---
const STATUS_LIST = [ 
    'Aguardando-Mecanico', 'Em-Analise', 'Orcamento-Enviado', 
    'Aguardando-Aprovacao', 'Servico-Autorizado', 'Em-Execucao', 
    'Finalizado-Aguardando-Retirada', 'Entregue' 
];

// --- NOTIFICAÇÕES ---
function showNotification(message, type = 'success') {
  const existing = document.getElementById('notification');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.id = 'notification';
  div.className = `fixed top-5 right-5 z-[200] px-4 py-3 rounded-lg shadow-xl text-white font-bold transform transition-all duration-300 translate-x-full ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`;
  div.innerHTML = `<i class='bx ${type === 'success' ? 'bx-check' : 'bx-error'}'></i> ${message}`;
  document.body.appendChild(div);
  requestAnimationFrame(() => div.classList.remove('translate-x-full'));
  setTimeout(() => div.remove(), 4000);
}

// --- CLOUDINARY UPLOAD ---
const uploadFileToCloudinary = async (file) => {
  if (!activeCloudinaryConfig) throw new Error('Mídia não configurada. Fale com o Admin.');
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', activeCloudinaryConfig.uploadPreset);
  
  const res = await fetch(`https://api.cloudinary.com/v1_1/${activeCloudinaryConfig.cloudName}/auto/upload`, {
      method: 'POST', body: formData
  });
  
  if (!res.ok) throw new Error('Falha no upload da imagem.');
  const data = await res.json();
  return { url: data.secure_url, type: data.resource_type };
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  // 1. CARREGAR/CRIAR USUÁRIOS
  const usersRef = db.ref('users');
  usersRef.on('value', snapshot => {
      const data = snapshot.val();
      const select = document.getElementById('userSelect');
      select.innerHTML = '<option value="">Selecione...</option>';
      allUsers = [];

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
      if(val) {
          activeCloudinaryConfig = Object.values(val)[0];
          document.getElementById('activeCloudinaryInfo').innerHTML = 
            `<span class="text-green-600 font-bold">Ativo:</span> ${activeCloudinaryConfig.cloudName}`;
      }
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

      if (user.role === 'Gestor' || user.name === 'Thiago Ventura Valencio') {
          document.getElementById('adminControls').classList.remove('hidden');
          document.getElementById('adminControls').classList.add('flex');
      }

      initKanban();
      listenOS();
  };

  // 4. KANBAN
  const initKanban = () => {
      const board = document.getElementById('kanbanBoard');
      board.innerHTML = STATUS_LIST.map(status => `
        <div class="status-column">
            <div class="p-3 bg-gray-200 rounded-t-xl flex justify-between font-bold text-gray-700 text-sm uppercase items-center sticky top-0 z-10 shadow-sm border-b border-gray-300">
                <span>${status.replace(/-/g, ' ')}</span>
                <span class="bg-white px-2 py-0.5 rounded-full text-xs shadow-sm" id="count-${status}">0</span>
            </div>
            <div class="vehicle-list space-y-3 p-2" id="col-${status}"></div>
        </div>
      `).join('');
  };

  // 5. ESCUTAR OS
  const listenOS = () => {
      db.ref('serviceOrders').on('value', snap => {
          const data = snap.val() || {};
          allServiceOrders = data;
          
          STATUS_LIST.forEach(s => {
              document.getElementById(`col-${s}`).innerHTML = '';
              document.getElementById(`count-${s}`).innerText = '0';
          });

          Object.entries(data).forEach(([id, os]) => {
              os.id = id;
              const col = document.getElementById(`col-${os.status}`);
              if(col) col.innerHTML += createCard(os);
          });

          STATUS_LIST.forEach(s => {
              const el = document.getElementById(`count-${s}`);
              if(el) el.innerText = document.getElementById(`col-${s}`).children.length;
          });
          
          updateAlerts();
      });
  };

  const createCard = (os) => {
      const priorityClass = os.priority === 'vermelho' ? 'border-red-500 bg-red-50' : 
                            os.priority === 'amarelo' ? 'border-yellow-500' : 'border-l-4 border-gray-300';
      
      const blink = os.priority === 'vermelho' ? 'animate-pulse' : '';

      return `
      <div class="vehicle-card status-${os.status} ${priorityClass}" onclick="openDetails('${os.id}')">
          <div class="flex justify-between items-center mb-1">
              <span class="font-black text-gray-800 text-lg ${blink}">${os.placa}</span>
              ${os.priority === 'vermelho' ? '<i class="bx bxs-hot text-red-600"></i>' : ''}
          </div>
          <div class="text-xs font-bold text-blue-700 uppercase truncate">${os.modelo}</div>
          <div class="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
             <i class='bx bxs-user'></i> ${os.cliente.split(' ')[0]}
          </div>
      </div>`;
  };

  // 6. DETALHES E FUNÇÕES
  window.openDetails = (id) => {
      const os = allServiceOrders[id];
      if(!os) return;
      
      // Reseta visualização do Log
      document.getElementById('logOsId').value = id;
      document.getElementById('post-log-actions').classList.add('hidden'); // Esconde ações de mover
      document.getElementById('logFormContainer').classList.remove('hidden'); // Mostra form

      document.getElementById('detailsHeader').innerHTML = `
          <div class="flex justify-between items-start">
              <div>
                  <h1 class="text-3xl font-black text-gray-900">${os.placa}</h1>
                  <p class="text-lg text-blue-700 font-bold uppercase">${os.modelo}</p>
              </div>
              <div class="text-right">
                  <span class="text-xs bg-gray-200 px-2 py-1 rounded font-mono">#${os.id.slice(-4)}</span>
              </div>
          </div>
          <div class="mt-3 text-sm text-gray-600 grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded border border-gray-100">
              <p><i class='bx bxs-user'></i> ${os.cliente}</p>
              <p><i class='bx bxs-phone'></i> ${os.telefone}</p>
              <p><i class='bx bxs-tachometer'></i> ${os.km} KM</p>
              <p><i class='bx bxs-wrench'></i> ${os.responsible}</p>
          </div>
      `;
      
      const obsEl = document.getElementById('detailsObservacoes');
      if(os.observacoes) {
          obsEl.innerHTML = `<strong class="text-red-700">QUEIXA:</strong> ${os.observacoes}`;
          obsEl.classList.remove('hidden');
      } else {
          obsEl.classList.add('hidden');
      }

      // Botão Excluir (Admin)
      const isMaster = currentUser.role === 'Gestor' || currentUser.name === 'Thiago Ventura Valencio';
      const delBtn = document.getElementById('deleteOsBtn');
      
      if(isMaster) {
          delBtn.classList.remove('hidden');
          delBtn.onclick = () => {
              if(confirm('ATENÇÃO: Isso apagará permanentemente a OS e todo o histórico. Confirmar?')) {
                  db.ref(`serviceOrders/${id}`).remove();
                  document.getElementById('detailsModal').classList.add('hidden');
              }
          };
      } else {
          delBtn.classList.add('hidden');
      }

      // --- EXPORTAR PDF PROFISSIONAL (jspdf-autotable) ---
      document.getElementById('exportOsBtn').onclick = () => {
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          
          // Cabeçalho
          doc.setFillColor(30, 58, 138); // Azul Menechelli
          doc.rect(0, 0, 210, 40, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(22);
          doc.setFont("helvetica", "bold");
          doc.text("CENTER CAR MENECHELLI", 105, 20, null, null, "center");
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.text("Relatório Técnico de Serviço", 105, 28, null, null, "center");

          // Dados do Veículo
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text(`Ordem de Serviço: ${os.placa}`, 14, 50);
          
          doc.autoTable({
              startY: 55,
              head: [['Veículo', 'Cliente', 'Telefone', 'KM', 'Técnico']],
              body: [[os.modelo, os.cliente, os.telefone, os.km, os.responsible]],
              theme: 'striped',
              headStyles: { fillColor: [30, 58, 138] }
          });

          // Queixa
          if (os.observacoes) {
              doc.setFontSize(10);
              doc.setTextColor(200, 0, 0);
              doc.text(`Reclamação: ${os.observacoes}`, 14, doc.lastAutoTable.finalY + 10);
          }

          // Histórico (Tabela)
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(12);
          doc.text("Histórico de Execução", 14, doc.lastAutoTable.finalY + 25);

          const historyData = os.logs ? Object.values(os.logs).map(l => [
              new Date(l.timestamp).toLocaleString(),
              l.user,
              l.description,
              l.parts || '-',
              l.value ? `R$ ${l.value}` : '-'
          ]) : [];

          if (historyData.length > 0) {
              doc.autoTable({
                  startY: doc.lastAutoTable.finalY + 30,
                  head: [['Data', 'Usuário', 'Descrição', 'Peças', 'Valor']],
                  body: historyData,
                  theme: 'grid',
                  styles: { fontSize: 8 },
                  headStyles: { fillColor: [100, 100, 100] }
              });
          } else {
              doc.setFontSize(10);
              doc.text("Nenhum registro encontrado.", 14, doc.lastAutoTable.finalY + 35);
          }

          // Rodapé
          const pageCount = doc.internal.getNumberOfPages();
          for(let i = 1; i <= pageCount; i++) {
              doc.setPage(i);
              doc.setFontSize(8);
              doc.setTextColor(150);
              doc.text(`Gerado por thIAguinho Soluções em ${new Date().toLocaleDateString()}`, 10, 285);
              doc.text(`Página ${i} de ${pageCount}`, 190, 285);
          }

          doc.save(`OS_${os.placa}_Menechelli.pdf`);
      };

      renderTimeline(os);
      renderGallery(os);
      document.getElementById('detailsModal').classList.remove('hidden');
      document.getElementById('detailsModal').classList.add('flex');
  };

  const renderTimeline = (os) => {
      const container = document.getElementById('timelineContainer');
      if (!os.logs) { container.innerHTML = '<p class="text-gray-400 text-center italic text-xs">Nenhum registro.</p>'; return; }
      
      const logs = Object.entries(os.logs).sort((a,b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
      const isMaster = currentUser.role === 'Gestor' || currentUser.name === 'Thiago Ventura Valencio';

      container.innerHTML = logs.map(([key, log]) => `
          <div class="border-l-2 border-blue-200 pl-4 pb-6 relative last:pb-0">
              <div class="w-2.5 h-2.5 bg-blue-500 rounded-full absolute -left-[5px] top-1"></div>
              <div class="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                  <div class="flex justify-between items-baseline mb-1">
                      <span class="font-bold text-xs text-blue-900 uppercase">${log.user}</span>
                      <span class="text-[10px] text-gray-400">${new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p class="text-sm text-gray-800">${log.description}</p>
                  ${log.parts ? `<div class="mt-2 text-xs bg-gray-50 p-1.5 rounded border border-gray-200"><strong>Peças:</strong> ${log.parts} <span class="float-right text-green-700 font-bold">R$ ${log.value}</span></div>` : ''}
                  
                  ${isMaster ? `<button onclick="deleteLog('${os.id}', '${key}')" class="text-red-400 text-[10px] hover:text-red-600 hover:underline mt-2 w-full text-right block">Apagar</button>` : ''}
              </div>
          </div>
      `).join('');
  };
  
  window.deleteLog = (osId, logKey) => {
      if(confirm('Apagar este registro?')) db.ref(`serviceOrders/${osId}/logs/${logKey}`).remove();
  };

  const renderGallery = (os) => {
      const grid = document.getElementById('thumbnail-grid');
      if(!os.media) { grid.innerHTML = '<p class="col-span-full text-center text-gray-400 text-xs">Sem fotos.</p>'; return; }
      
      const isMaster = currentUser.role === 'Gestor' || currentUser.name === 'Thiago Ventura Valencio';
      
      grid.innerHTML = Object.entries(os.media).map(([key, m]) => `
          <div class="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
              <img src="${m.url}" class="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform duration-300" onclick="window.open('${m.url}')">
              ${isMaster ? `<button onclick="deleteMedia('${os.id}', '${key}')" class="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md">&times;</button>` : ''}
          </div>
      `).join('');
  };
  
  window.deleteMedia = (osId, key) => {
      if(confirm('Apagar imagem?')) db.ref(`serviceOrders/${osId}/media/${key}`).remove();
  };

  // 7. GESTÃO DE USUÁRIOS (ADMIN)
  const renderAdminUserList = () => {
      const list = document.getElementById('usersList');
      if(!list) return;
      list.innerHTML = allUsers.map(u => `
          <div class="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
              <div>
                  <p class="font-bold text-gray-800 text-sm">${u.name}</p>
                  <p class="text-xs text-gray-500">${u.role} | Senha: ${u.password}</p>
              </div>
              ${u.name !== 'Thiago Ventura Valencio' ? `<button onclick="removeUser('${u.id}')" class="text-red-500 hover:bg-red-50 p-2 rounded transition"><i class='bx bxs-trash'></i></button>` : '<span class="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded">MASTER</span>'}
          </div>
      `).join('');
  };
  
  window.removeUser = (id) => {
      if(confirm('Remover usuário?')) db.ref(`users/${id}`).remove();
  };

  // 8. LOGS E UPLOADS (FLUXO CORRIGIDO)
  document.getElementById('logForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true; btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Processando...";
      const osId = document.getElementById('logOsId').value;
      
      try {
          if(filesToUpload.length > 0) {
              const uploads = filesToUpload.map(f => uploadFileToCloudinary(f));
              const res = await Promise.all(uploads);
              res.forEach(r => db.ref(`serviceOrders/${osId}/media`).push({ url: r.url, timestamp: new Date().toISOString() }));
          }
          
          if(document.getElementById('logDescricao').value.trim() !== "") {
              db.ref(`serviceOrders/${osId}/logs`).push({
                  user: currentUser.name,
                  timestamp: new Date().toISOString(),
                  description: document.getElementById('logDescricao').value,
                  parts: document.getElementById('logPecas').value,
                  value: document.getElementById('logValor').value
              });
          }
          
          e.target.reset(); filesToUpload = []; document.getElementById('fileName').innerText = "";
          showNotification('Salvo com sucesso!');
          
          // MOSTRAR OPÇÕES DE MOVIMENTAÇÃO (FLUXO CHEVRON)
          document.getElementById('logFormContainer').classList.add('hidden'); // Esconde form
          document.getElementById('post-log-actions').classList.remove('hidden'); // Mostra botões
          
      } catch(err) { alert(err.message); }
      btn.disabled = false; btn.innerHTML = "Salvar Registro";
  };

  // 9. FUNÇÕES DE SUPORTE
  const mediaInput = document.getElementById('media-input');
  mediaInput.onchange = (e) => { if(e.target.files.length) { filesToUpload = Array.from(e.target.files); document.getElementById('fileName').innerText = `${filesToUpload.length} arquivos`; } };
  document.getElementById('openCameraBtn').onclick = () => mediaInput.click();
  document.getElementById('openGalleryBtn').onclick = () => mediaInput.click();
  
  document.getElementById('adminBtn').onclick = () => { document.getElementById('adminModal').classList.remove('hidden'); document.getElementById('adminModal').classList.add('flex'); };
  
  // Tabs Admin
  document.querySelectorAll('.admin-tab').forEach(t => t.onclick = () => {
      document.querySelectorAll('.admin-tab').forEach(x => {
          x.classList.remove('active', 'border-blue-600', 'text-blue-600', 'bg-blue-50/50');
          x.classList.add('text-gray-500');
      });
      t.classList.add('active', 'border-blue-600', 'text-blue-600', 'bg-blue-50/50');
      t.classList.remove('text-gray-500');
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
          cloudName: document.getElementById('cloudNameInput').value.trim(),
          uploadPreset: document.getElementById('uploadPresetInput').value.trim(),
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
      showNotification('OS Criada!');
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
      if(list.length === 0) { container.innerHTML = '<p class="p-4 text-center text-gray-500">Nenhum veículo entregue no período.</p>'; return; }
      
      container.innerHTML = list.map(o => `
        <div class="p-3 border-b flex justify-between items-center hover:bg-gray-50">
            <div>
                <span class="font-bold block">${o.placa}</span>
                <span class="text-xs text-gray-500">${o.modelo} | ${o.cliente}</span>
            </div>
            <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">${new Date(o.createdAt).toLocaleDateString()}</span>
        </div>`).join('');
      
      const pdfBtn = document.getElementById('exportReportBtn');
      pdfBtn.classList.remove('hidden');
      pdfBtn.onclick = () => {
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          doc.text("Relatório de Entregas - Center Car Menechelli", 10, 10);
          
          const bodyData = list.map(o => [o.placa, o.modelo, o.cliente, new Date(o.createdAt).toLocaleDateString()]);
          
          doc.autoTable({
              head: [['Placa', 'Modelo', 'Cliente', 'Data Entrada']],
              body: bodyData,
              startY: 20
          });
          
          doc.save("relatorio_entregas.pdf");
      };
  };

  // Painel Alertas (Toggle)
  const updateAlerts = () => {
      const panel = document.getElementById('attention-panel');
      const alerts = Object.values(allServiceOrders).filter(o => o.status === 'Aguardando-Mecanico' || o.status === 'Servico-Autorizado');
      if(alerts.length > 0) document.getElementById('alert-led').classList.remove('hidden');
      else document.getElementById('alert-led').classList.add('hidden');
      
      panel.innerHTML = alerts.map(o => `
          <div class="bg-white p-3 rounded-lg border-l-4 ${o.status === 'Aguardando-Mecanico' ? 'border-yellow-500' : 'border-green-500'} shadow cursor-pointer hover:bg-gray-50" onclick="openDetails('${o.id}')">
              <div class="font-bold text-xs uppercase mb-1 ${o.status === 'Aguardando-Mecanico' ? 'text-yellow-600' : 'text-green-600'}">
                  ${o.status.replace(/-/g,' ')}
              </div>
              <div class="flex justify-between font-bold text-gray-800">
                  ${o.placa} <span class="font-normal text-gray-500">${o.modelo}</span>
              </div>
          </div>
      `).join('');
  };
  
  document.getElementById('toggle-panel-btn').onclick = () => {
      const p = document.getElementById('attention-panel-container');
      const icon = document.getElementById('toggle-icon');
      if (p.style.maxHeight === '300px') {
          p.style.maxHeight = '0';
          icon.classList.remove('rotate-180');
      } else {
          p.style.maxHeight = '300px';
          icon.classList.add('rotate-180');
      }
  };

  // Actions (Move Status)
  window.quickMove = (id, direction) => {
      const os = allServiceOrders[id];
      const idx = STATUS_LIST.indexOf(os.status);
      let newStatus = null;
      if (direction === 'next' && idx < STATUS_LIST.length - 1) newStatus = STATUS_LIST[idx + 1];
      if (direction === 'prev' && idx > 0) newStatus = STATUS_LIST[idx - 1];
      if (newStatus) {
          db.ref(`serviceOrders/${id}`).update({ status: newStatus });
          // Reseta a UI do modal
          document.getElementById('logFormContainer').classList.remove('hidden');
          document.getElementById('post-log-actions').classList.add('hidden');
          showNotification(`Movido para ${newStatus.replace(/-/g, ' ')}`);
      }
  };

  document.getElementById('btn-move-next').onclick = () => window.quickMove(document.getElementById('logOsId').value, 'next');
  document.getElementById('btn-move-prev').onclick = () => window.quickMove(document.getElementById('logOsId').value, 'prev');
  document.getElementById('btn-stay').onclick = () => {
      document.getElementById('logFormContainer').classList.remove('hidden');
      document.getElementById('post-log-actions').classList.add('hidden');
  };

  document.querySelectorAll('.btn-close-modal').forEach(b => b.onclick = (e) => e.target.closest('.modal').classList.add('hidden'));
});
