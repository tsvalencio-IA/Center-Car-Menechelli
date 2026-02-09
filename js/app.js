/* ==================================================================
   DASHBOARD OFICINA PRO - V2.0 (SaaS Ready)
   Desenvolvido por: Thiago Ventura Valencio
   Funcionalidades: Kanban, Upload Cloudinary Dinâmico, IA Gemini,
   Gestão de Usuários e Permissões.
==================================================================
*/

/* --- 1. CONFIGURAÇÃO INICIAL DO FIREBASE --- */
// (Mantenha suas configurações originais aqui. Em um SaaS real, isso viria de env vars na build,
// mas para este projeto cliente-side, mantemos hardcoded para conectar ao seu projeto)
const firebaseConfig = {
    apiKey: "AIzaSyB5JpYm8l0AlF5ZG3HtkyFZgmrpsUrDhv0",
    authDomain: "dashboard-oficina-pro.firebaseapp.com",
    databaseURL: "https://dashboard-oficina-pro-default-rtdb.firebaseio.com",
    projectId: "dashboard-oficina-pro",
    storageBucket: "dashboard-oficina-pro.appspot.com",
    messagingSenderId: "736157192887",
    appId: "1:736157192887:web:c23d3daade848a33d67332"
};

// Inicializa Firebase se ainda não foi
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

/* --- 2. ESTADO GLOBAL DA APLICAÇÃO --- */
let currentUser = null; // Usuário logado
let systemConfig = {};  // Configurações (Chaves API, Nome da Oficina)
let allUsers = {};      // Lista de usuários para Admin

// Definição de Perfis de Acesso
const ROLES = {
    admin: {
        canDelete: true,
        canEditConfig: true,
        canManageUsers: true,
        canExportReports: true,
        label: "Administrador (DEV)"
    },
    gerente: {
        canDelete: false,
        canEditConfig: false,
        canManageUsers: true,
        canExportReports: true,
        label: "Gerente"
    },
    colaborador: {
        canDelete: false,
        canEditConfig: false,
        canManageUsers: false,
        canExportReports: false,
        label: "Colaborador"
    }
};

/* --- 3. INICIALIZAÇÃO E AUTENTICAÇÃO --- */

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Busca configurações do sistema (Chaves API)
    await loadSystemConfig();
    
    // 2. Busca usuários cadastrados
    await loadUsers();
});

async function loadSystemConfig() {
    const configRef = db.ref('system_config');
    configRef.on('value', (snapshot) => {
        const val = snapshot.val();
        if (val) {
            systemConfig = val;
            updateUIWithConfig();
        } else {
            // Se não existir config, cria o padrão (Primeiro uso)
            createDefaultConfig();
        }
    });
}

function createDefaultConfig() {
    const defaultConfig = {
        shopName: "CHEVRON Bosch Service",
        apiKeys: {
            cloudinary_cloud_name: "", // Preencher no painel admin
            cloudinary_upload_preset: "",
            gemini_api_key: ""
        }
    };
    db.ref('system_config').set(defaultConfig);
}

function updateUIWithConfig() {
    // Atualiza títulos da página com o nome da oficina
    if(systemConfig.shopName) {
        document.querySelectorAll('h1').forEach(el => {
            if(el.textContent.includes('CHEVRON')) el.textContent = systemConfig.shopName;
        });
    }
    // Remove loading
    const loader = document.getElementById('loadingConfig');
    if(loader) loader.style.display = 'none';
    
    const userList = document.getElementById('userList');
    if(userList) userList.classList.remove('hidden');
}

async function loadUsers() {
    const usersRef = db.ref('users');
    usersRef.on('value', (snapshot) => {
        allUsers = snapshot.val() || {};
        renderUserSelectionScreen(allUsers);
        
        // Se a lista estiver vazia (primeiro uso), cria o Super Admin
        if (Object.keys(allUsers).length === 0) {
            createSuperAdmin();
        }
    });
}

function createSuperAdmin() {
    const devUser = {
        name: "Thiago Ventura Valencio",
        role: "admin",
        avatar: "images/avatar_dev.png",
        pin: "0000" // Opcional para futuro
    };
    db.ref('users').push(devUser);
}

function renderUserSelectionScreen(users) {
    const container = document.getElementById('userList');
    container.innerHTML = '';

    Object.entries(users).forEach(([key, user]) => {
        const btn = document.createElement('button');
        btn.className = "w-full bg-gray-50 hover:bg-blue-50 border border-gray-200 text-gray-800 font-semibold py-3 px-4 rounded-lg shadow-sm transition-all mb-2 flex items-center gap-3";
        
        // Avatar simples baseado nas iniciais
        const initials = user.name.substring(0,2).toUpperCase();
        
        btn.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
                ${initials}
            </div>
            <div class="text-left flex-1">
                <div class="text-sm font-bold">${user.name}</div>
                <div class="text-xs text-gray-500">${ROLES[user.role]?.label || 'Colaborador'}</div>
            </div>
            <i class='bx bx-chevron-right text-gray-400'></i>
        `;
        
        btn.onclick = () => loginUser(key, user);
        container.appendChild(btn);
    });
}

function loginUser(userId, userData) {
    currentUser = { id: userId, ...userData };
    
    // Configura permissões baseadas no cargo
    currentUser.permissions = ROLES[currentUser.role] || ROLES['colaborador'];

    document.getElementById('userScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    
    document.getElementById('currentUserDisplay').textContent = currentUser.name;
    
    // Configura UI baseada em permissões
    setupPermissionsUI();
    
    // Inicia o app principal
    initKanbanBoard();
}

function setupPermissionsUI() {
    const adminBtn = document.getElementById('btnAdminPanel');
    const deleteBtn = document.getElementById('btnDeleteOS');
    const reportsBtn = document.getElementById('btnReports');

    // Botão Admin
    if (currentUser.permissions.canEditConfig) {
        adminBtn.classList.remove('hidden');
    } else {
        adminBtn.classList.add('hidden');
    }

    // Botão Deletar OS (no modal)
    if (currentUser.permissions.canDelete) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }
}

document.getElementById('btnLogout').addEventListener('click', () => {
    window.location.reload();
});

/* --- 4. CLOUDINARY UPLOAD (CORRIGIDO E OTIMIZADO) --- */

async function uploadFileToCloudinary(file) {
    // Validação de Chaves
    if (!systemConfig.apiKeys || !systemConfig.apiKeys.cloudinary_cloud_name) {
        alert("ERRO: Chaves do Cloudinary não configuradas no Painel Admin.");
        throw new Error("Missing Cloudinary Config");
    }

    // 1. Sanitização das chaves (Remove espaços em branco que causaram o erro anterior)
    const cloudName = systemConfig.apiKeys.cloudinary_cloud_name.trim();
    const uploadPreset = systemConfig.apiKeys.cloudinary_upload_preset.trim();

    if (!cloudName || !uploadPreset) {
        alert("ERRO: Cloud Name ou Preset vazios.");
        return;
    }

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    // Tags ajudam a organizar no painel do Cloudinary
    formData.append('tags', `oficina,${currentUser.name}`); 

    // UI Feedback
    const progressDiv = document.getElementById('uploadProgress');
    const progressBar = progressDiv.querySelector('div');
    progressDiv.classList.remove('hidden');
    progressBar.style.width = '30%';

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        progressBar.style.width = '80%';

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error.message);
        }

        const data = await response.json();
        progressBar.style.width = '100%';
        
        setTimeout(() => progressDiv.classList.add('hidden'), 500);
        
        return data.secure_url;

    } catch (error) {
        progressDiv.classList.add('hidden');
        console.error('Upload Error:', error);
        alert(`Falha no envio da imagem: ${error.message}`);
        throw error;
    }
}

/* --- 5. LÓGICA DO KANBAN E ORDEM DE SERVIÇO --- */

const STATUS_COLUMNS = [
    { id: 'aguardando_mecanico', title: 'Aguardando Mecânico', color: 'border-l-4 border-yellow-400' },
    { id: 'em_analise', title: 'Em Análise', color: 'border-l-4 border-blue-400' },
    { id: 'orcamento_enviado', title: 'Orçamento Enviado', color: 'border-l-4 border-purple-400' },
    { id: 'aguardando_aprovacao', title: 'Aguardando Aprovação', color: 'border-l-4 border-orange-400' },
    { id: 'servico_autorizado', title: 'Serviço Autorizado', color: 'border-l-4 border-green-400' },
    { id: 'em_execucao', title: 'Em Execução', color: 'border-l-4 border-indigo-500' },
    { id: 'finalizado_retirada', title: 'Finalizado / Aguardando Retirada', color: 'border-l-4 border-teal-500' },
    { id: 'entregue', title: 'Entregue', color: 'border-l-4 border-gray-500' }
];

let currentEditingOsId = null;

function initKanbanBoard() {
    const board = document.getElementById('kanbanBoard');
    board.innerHTML = '';

    STATUS_COLUMNS.forEach(col => {
        const colDiv = document.createElement('div');
        colDiv.className = "min-w-[300px] w-[300px] flex flex-col h-full bg-gray-200 rounded-xl shadow-inner";
        
        colDiv.innerHTML = `
            <div class="p-3 font-bold text-gray-700 flex justify-between items-center bg-gray-300 rounded-t-xl">
                ${col.title}
                <span class="bg-white text-xs px-2 py-1 rounded-full shadow-sm count-badge" id="count-${col.id}">0</span>
            </div>
            <div class="flex-1 p-2 overflow-y-auto custom-scrollbar space-y-2 kanban-column" id="col-${col.id}" data-status="${col.id}">
                <!-- Cards aqui -->
            </div>
        `;
        board.appendChild(colDiv);
    });

    loadWorkOrders();
}

function loadWorkOrders() {
    const osRef = db.ref('work_orders');
    
    osRef.on('value', (snapshot) => {
        // Limpa colunas
        STATUS_COLUMNS.forEach(c => {
            document.getElementById(`col-${c.id}`).innerHTML = '';
            document.getElementById(`count-${c.id}`).textContent = '0';
        });

        const data = snapshot.val();
        if (!data) return;

        Object.entries(data).forEach(([id, os]) => {
            const card = createCardElement(id, os);
            const col = document.getElementById(`col-${os.status}`);
            if (col) {
                col.appendChild(card);
            }
        });

        // Atualiza contadores
        STATUS_COLUMNS.forEach(c => {
            const count = document.getElementById(`col-${c.id}`).children.length;
            document.getElementById(`count-${c.id}`).textContent = count;
        });
    });
}

function createCardElement(id, os) {
    const div = document.createElement('div');
    div.className = "bg-white p-4 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow border-l-4 " + 
                    (STATUS_COLUMNS.find(c => c.id === os.status)?.color || 'border-gray-500');
    
    // Verifica se tem placa, senão mostra um placeholder
    const placaDisplay = os.placa || "SEM PLACA";
    const modeloDisplay = os.modelo || "Veículo não ident.";

    div.innerHTML = `
        <div class="flex justify-between items-start mb-1">
            <span class="font-bold text-lg text-gray-800">${placaDisplay}</span>
            <i class='bx bx-dots-vertical-rounded text-gray-400'></i>
        </div>
        <div class="text-sm font-medium text-gray-600 mb-2">${modeloDisplay}</div>
        <div class="text-xs text-gray-400 flex items-center gap-1">
            <i class='bx bxs-user'></i> ${os.cliente || 'Consumidor'}
        </div>
        ${os.km ? `<div class="text-xs text-gray-400 mt-1">KM: ${os.km}</div>` : ''}
    `;

    div.onclick = () => openOSModal(id, os);

    // Permitir Drag and Drop (Simplificado para Mobile/Touch)
    // Para uma versão futura, implementaremos drag and drop visual.
    // Por enquanto, a mudança de status é feita dentro do modal.

    return div;
}

/* --- 6. MODAL DE ORDEM DE SERVIÇO --- */

const modalOS = document.getElementById('modalOS');
const formOS = document.getElementById('formOS');

document.getElementById('btnNewOS').addEventListener('click', () => {
    currentEditingOsId = null;
    formOS.reset();
    document.getElementById('modalTitle').textContent = "Nova Ordem de Serviço";
    document.getElementById('mediaGallery').innerHTML = '<p class="col-span-3 text-center text-sm text-gray-400">Nenhuma mídia adicionada</p>';
    document.getElementById('historyFeed').innerHTML = '';
    document.getElementById('btnDeleteOS').classList.add('hidden');
    
    modalOS.classList.remove('hidden');
});

// Fechar Modais
document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.target.closest('.modal-overlay').classList.add('hidden');
    });
});

function openOSModal(id, os) {
    currentEditingOsId = id;
    document.getElementById('modalTitle').textContent = `Editar O.S. - ${os.placa}`;
    
    // Preencher campos
    document.getElementById('placa').value = os.placa || '';
    document.getElementById('modelo').value = os.modelo || '';
    document.getElementById('cliente').value = os.cliente || '';
    document.getElementById('telefone').value = os.telefone || '';
    document.getElementById('km').value = os.km || '';
    document.getElementById('reclamacao').value = os.reclamacao || '';

    // Renderizar Galeria
    renderGallery(os.media || []);
    
    // Renderizar Histórico
    renderHistory(os.history || []);

    // Botão de Deletar (Check Permissão)
    if(currentUser.permissions.canDelete) {
        document.getElementById('btnDeleteOS').classList.remove('hidden');
    }

    modalOS.classList.remove('hidden');
}

// Salvar OS
formOS.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(formOS);
    const osData = {
        placa: formData.get('placa').toUpperCase(),
        modelo: formData.get('modelo'),
        cliente: formData.get('cliente'),
        telefone: formData.get('telefone'),
        km: formData.get('km'),
        reclamacao: formData.get('reclamacao'),
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    };

    if (!currentEditingOsId) {
        // Nova OS
        osData.createdAt = firebase.database.ServerValue.TIMESTAMP;
        osData.status = 'aguardando_mecanico';
        osData.createdBy = currentUser.name;
        
        // Histórico Inicial
        osData.history = [{
            date: new Date().toISOString(),
            user: currentUser.name,
            action: "Criação da O.S.",
            note: "Ordem de serviço aberta."
        }];
        
        await db.ref('work_orders').push(osData);
    } else {
        // Atualizar OS
        await db.ref(`work_orders/${currentEditingOsId}`).update(osData);
    }

    modalOS.classList.add('hidden');
    // showNotification("O.S. salva com sucesso!", "success");
});

// Deletar OS
document.getElementById('btnDeleteOS').addEventListener('click', async () => {
    if (!currentEditingOsId) return;
    if (confirm("Tem certeza que deseja excluir esta O.S.? Esta ação é irreversível.")) {
        await db.ref(`work_orders/${currentEditingOsId}`).remove();
        modalOS.classList.add('hidden');
    }
});

/* --- 7. GERENCIAMENTO DE MÍDIA E HISTÓRICO --- */

// Listener para Inputs de Arquivo
['cameraInput', 'galleryInput'].forEach(inputId => {
    document.getElementById(inputId).addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            try {
                const url = await uploadFileToCloudinary(file);
                await addMediaToOS(url);
            } catch (err) {
                console.error(err);
                // Erro já tratado no uploadFileToCloudinary com alert
            }
        }
    });
});

async function addMediaToOS(url) {
    if (!currentEditingOsId) {
        alert("Salve a O.S. pela primeira vez antes de adicionar fotos.");
        return;
    }
    
    // Busca mídia atual e adiciona nova
    const snapshot = await db.ref(`work_orders/${currentEditingOsId}/media`).once('value');
    const currentMedia = snapshot.val() || [];
    currentMedia.push({
        url: url,
        uploadedAt: new Date().toISOString(),
        user: currentUser.name
    });
    
    await db.ref(`work_orders/${currentEditingOsId}`).update({ media: currentMedia });
    
    // Atualiza histórico
    addHistoryEntry("Adicionou uma foto", "Nova imagem anexada à galeria.");
    
    renderGallery(currentMedia);
}

function renderGallery(mediaList) {
    const container = document.getElementById('mediaGallery');
    if (!mediaList || mediaList.length === 0) {
        container.innerHTML = '<p class="col-span-3 text-center text-sm text-gray-400">Nenhuma mídia adicionada</p>';
        return;
    }

    container.innerHTML = mediaList.map(item => `
        <a href="${item.url}" target="_blank" class="block aspect-square rounded-lg overflow-hidden border border-gray-200 relative group">
            <img src="${item.url}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all"></div>
        </a>
    `).join('');
}

// Adicionar Histórico Rápido
document.getElementById('btnAddUpdate').addEventListener('click', () => {
    const input = document.getElementById('quickUpdateInput');
    const text = input.value.trim();
    if (text) {
        addHistoryEntry("Atualização Manual", text);
        input.value = '';
    }
});

async function addHistoryEntry(action, note) {
    if (!currentEditingOsId) return;
    
    const snapshot = await db.ref(`work_orders/${currentEditingOsId}/history`).once('value');
    const currentHistory = snapshot.val() || [];
    
    const newEntry = {
        date: new Date().toISOString(),
        user: currentUser.name,
        action: action,
        note: note
    };
    
    currentHistory.unshift(newEntry); // Adiciona no começo
    
    await db.ref(`work_orders/${currentEditingOsId}`).update({ history: currentHistory });
    renderHistory(currentHistory);
}

function renderHistory(historyList) {
    const container = document.getElementById('historyFeed');
    if (!historyList || historyList.length === 0) {
        container.innerHTML = '<p class="text-center text-sm text-gray-400">Sem histórico.</p>';
        return;
    }

    container.innerHTML = historyList.map(item => `
        <div class="flex gap-3">
            <div class="flex-shrink-0 mt-1">
                <div class="w-2 h-2 rounded-full bg-blue-400 ring-4 ring-white"></div>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 w-full">
                <div class="flex justify-between items-baseline mb-1">
                    <span class="font-bold text-sm text-gray-800">${item.user}</span>
                    <span class="text-xs text-gray-500">${new Date(item.date).toLocaleString()}</span>
                </div>
                <p class="text-xs font-semibold text-blue-600 mb-0.5">${item.action}</p>
                <p class="text-sm text-gray-600">${item.note}</p>
            </div>
        </div>
    `).join('');
}

/* --- 8. PAINEL ADMINISTRATIVO (Gestão de Usuários e Config) --- */

document.getElementById('btnAdminPanel').addEventListener('click', () => {
    document.getElementById('modalAdmin').classList.remove('hidden');
    loadAdminUsersList();
    loadAdminConfig();
});

// Abas do Admin
document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all
        document.querySelectorAll('.admin-tab-btn').forEach(b => {
            b.classList.remove('active', 'border-blue-600', 'text-blue-600', 'font-bold');
            b.classList.add('border-transparent', 'text-gray-500');
        });
        // Add active to clicked
        btn.classList.add('active', 'border-blue-600', 'text-blue-600', 'font-bold');
        btn.classList.remove('border-transparent', 'text-gray-500');
        
        // Show Content
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
    });
});

function loadAdminUsersList() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = '';
    
    Object.entries(allUsers).forEach(([key, user]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                <p class="text-gray-900 whitespace-no-wrap font-bold">${user.name}</p>
            </td>
            <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                <span class="relative inline-block px-3 py-1 font-semibold leading-tight text-green-900">
                    <span aria-hidden class="absolute inset-0 bg-green-200 opacity-50 rounded-full"></span>
                    <span class="relative">${ROLES[user.role]?.label || user.role}</span>
                </span>
            </td>
            <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                ${user.role !== 'admin' ? `
                <button class="text-red-600 hover:text-red-900" onclick="deleteUser('${key}')">Excluir</button>
                ` : '<span class="text-gray-400 italic">Super Admin</span>'}
            </td>
        `;
        list.appendChild(tr);
    });
}

document.getElementById('btnNewUser').addEventListener('click', () => {
    document.getElementById('formNewUserContainer').classList.remove('hidden');
});

document.getElementById('btnSaveNewUser').addEventListener('click', async () => {
    const name = document.getElementById('newUserName').value;
    const role = document.getElementById('newUserRole').value;
    
    if(!name) return alert("Nome é obrigatório");
    
    await db.ref('users').push({
        name: name,
        role: role,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    });
    
    document.getElementById('newUserName').value = '';
    document.getElementById('formNewUserContainer').classList.add('hidden');
    alert("Usuário criado!");
    // Listener do loadUsers atualizará a lista automaticamente
});

window.deleteUser = async (key) => {
    if(confirm("Tem certeza que deseja remover este usuário?")) {
        await db.ref(`users/${key}`).remove();
    }
};

// Configurações do Sistema
function loadAdminConfig() {
    if(systemConfig) {
        document.getElementById('configShopName').value = systemConfig.shopName || '';
        document.getElementById('configCloudName').value = systemConfig.apiKeys?.cloudinary_cloud_name || '';
        document.getElementById('configUploadPreset').value = systemConfig.apiKeys?.cloudinary_upload_preset || '';
        document.getElementById('configGeminiKey').value = systemConfig.apiKeys?.gemini_api_key || '';
    }
}

document.getElementById('btnSaveSystemConfig').addEventListener('click', async () => {
    const newConfig = {
        shopName: document.getElementById('configShopName').value,
        apiKeys: {
            cloudinary_cloud_name: document.getElementById('configCloudName').value.trim(),
            cloudinary_upload_preset: document.getElementById('configUploadPreset').value.trim(),
            gemini_api_key: document.getElementById('configGeminiKey').value.trim()
        }
    };
    
    await db.ref('system_config').update(newConfig);
    alert("Configurações salvas! A página será recarregada.");
    window.location.reload();
});

/* --- 9. BUSCA GLOBAL --- */
const searchInputs = [document.getElementById('globalSearch'), document.getElementById('globalSearchMobile')];

searchInputs.forEach(input => {
    if(!input) return;
    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.kanban-column > div'); // Seleciona os cards
        
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            if(text.includes(term)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
});
