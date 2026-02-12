// --- BLOQUEIO DE ATUALIZAÇÃO/SAÍDA COM MODAL CUSTOMIZADO ---
let allowPageUnload = false;
const confirmExitModal = document.getElementById('confirm-exit-modal');
const confirmExitBtn = document.getElementById('confirm-exit-btn');
const cancelExitBtn = document.getElementById('cancel-exit-btn');

function showConfirmExitModal() {
    if (confirmExitModal) {
        confirmExitModal.style.display = 'flex';
    }
}

function hideConfirmExitModal() {
    if (confirmExitModal) {
        confirmExitModal.style.display = 'none';
    }
}

// Intercepta F5, Ctrl+R, Cmd+R e tentativas de fechar/atualizar

// Sempre mostrar modal customizado para F5/Ctrl+R/Cmd+R
window.addEventListener('keydown', function (e) {
    if ((e.key === 'F5') || (e.key === 'r' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        showConfirmExitModal();
    }
});

// Sempre mostrar o modal nativo do navegador para qualquer tentativa de sair/atualizar
window.addEventListener('beforeunload', function (e) {
    if (!allowPageUnload) {
        // O navegador só permite modal nativo aqui
        e.preventDefault();
        e.returnValue = 'Tem certeza que deseja sair? Você pode perder dados não salvos.';
        return 'Tem certeza que deseja sair? Você pode perder dados não salvos.';
    }
});

if (confirmExitBtn && cancelExitBtn) {
    confirmExitBtn.onclick = function () {
        allowPageUnload = true;
        hideConfirmExitModal();
        window.location.reload(); // Força atualização
    };
    cancelExitBtn.onclick = function () {
        hideConfirmExitModal();
    };
}
// --- FIM BLOQUEIO DE ATUALIZAÇÃO/SAÍDA ---
// Função para concluir a contagem (deve ser global)
window.handleSalvarContagem = async function handleSalvarContagem() {
    // Verifica se há divergência
    const cards = document.querySelectorAll('.item-card');
    let temDivergencia = false;
    cards.forEach(card => {
        const input = card.querySelector('.quantidade-input');
        if (input && input.dataset.temDivergencia === 'true') {
            temDivergencia = true;
        }
    });

    // Envia PUT para liberar contagem sempre, incluindo divergencia no body
    try {
        const bodyData = {
            contagem_cuid: currentContagem.contagem_cuid,
            contagem: currentContagem.contagem,
            divergencia: temDivergencia,
            itensParaRevalidar: window.failedValidationItems ? Array.from(window.failedValidationItems) : []
        };
        await makeRequest(`${API_BASE_URL}/estoque/contagem/liberar`, {
            method: 'PUT',
            body: JSON.stringify(bodyData)
        });
        showToast(temDivergencia ? 'Contagem com divergência liberada!' : 'Contagem finalizada!');

        // --- CLEANUP ---
        // Se concluiu com sucesso, limpa os logs locais desta contagem
        // para evitar que reapareçam em uma futura contagem com mesmo número.
        console.log("Limpando cache local para contagem:", currentContagem.contagem);
        await window.localDB.clearLogsByContagem(currentContagem.contagem);

    } catch (error) {
        showToast('Erro ao liberar contagem!');
    }
    // Salva o estado atual da contagem no localStorage
    if (currentContagem) {
        localStorage.setItem('currentContagem', JSON.stringify(currentContagem));
    }
    showContagensScreen();
};
// Configuração da API
const hostname = window.location.hostname;
const protocol = window.location.protocol;

// Carrega da configuração global (definida em config.js) ou usa fallback seguro
const API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || 'http://127.0.0.1:8000';

// Expose globally for SyncManager
window.API_BASE_URL = API_BASE_URL;

// Estado da aplicação
let currentUser = null;
let currentContagem = null;

// Elementos DOM
const loginScreen = document.getElementById('login-screen');
const contagensScreen = document.getElementById('contagens-screen');
const itensScreen = document.getElementById('itens-screen');
const loginForm = document.getElementById('login-form');
const loginLoading = document.getElementById('login-loading');
const userNameSpan = document.getElementById('user-name');
const contagensGrid = document.getElementById('contagens-grid');
const contagensLoading = document.getElementById('contagens-loading');
const itensLoading = document.getElementById('itens-loading');
const itensList = document.getElementById('itens-list');
const contagemHeading = document.getElementById('contagem-heading');
const backBtn = document.getElementById('back-btn');
const logoutBtn = document.getElementById('logout-btn');
const salvarBtn = document.getElementById('salvar-btn');
const toast = document.getElementById('toast');

// InicializaÃ§Ã£o
document.addEventListener('DOMContentLoaded', function () {
    // Ajusta estado inicial da classe do body baseada na tela ativa
    document.body.classList.toggle('login-screen-active', loginScreen.classList.contains('active'));

    // Verificar se já está logado
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);

        // RECUPERAR ESTADO DA NAVEGAÇÃO
        const savedContagem = localStorage.getItem('currentContagem');
        if (savedContagem) {
            try {
                currentContagem = JSON.parse(savedContagem);
                console.log("Restaurando contagem ativa:", currentContagem.contagem);
                showItensScreen();

                // Preencher campos com dados salvos
                setTimeout(() => {
                    const cards = document.querySelectorAll('.item-card');
                    if (currentContagem.itens) {
                        cards.forEach(card => {
                            const input = card.querySelector('.quantidade-input');
                            const itemId = card.dataset.itemId;
                            if (input && currentContagem.itens[itemId]) {
                                input.value = currentContagem.itens[itemId].quantidade || '';
                            }
                        });
                    }
                }, 100);

            } catch (e) {
                console.error("Erro ao restaurar contagem:", e);
                showContagensScreen();
            }
        } else {
            showContagensScreen();
        }
    }

    // Event listeners
    loginForm.addEventListener('submit', handleLogin);
    backBtn.addEventListener('click', () => {
        localStorage.removeItem('currentContagem'); // Limpa persistencia
        showContagensScreen();
    });
    logoutBtn.addEventListener('click', handleLogout);

    // Debug: verificar se o botÃ£o salvar existe
    if (salvarBtn) {
        console.log('âœ… BotÃ£o salvar encontrado, adicionando event listener');
        console.log('ðŸ“ BotÃ£o info:', {
            id: salvarBtn.id,
            display: salvarBtn.style.display,
            disabled: salvarBtn.disabled,
            innerHTML: salvarBtn.innerHTML
        });

        // Remover qualquer listener anterior
        salvarBtn.removeEventListener('click', handleSalvarContagem);

        // Usar onclick diretamente 
        salvarBtn.onclick = function (event) {
            console.log('ðŸ–±ï¸ BOTÃƒO SALVAR CLICADO!!! Event:', event);
            console.log('ðŸ“ Estado do botÃ£o no click:', {
                display: salvarBtn.style.display,
                disabled: salvarBtn.disabled,
                innerHTML: salvarBtn.innerHTML
            });

            event.preventDefault();
            event.stopPropagation();

            handleSalvarContagem();
            return false;
        };

        // Adicionar tambÃ©m via addEventListener como backup
        salvarBtn.addEventListener('click', (event) => {
            console.log('ðŸ–±ï¸ BACKUP EVENT LISTENER ATIVADO!');
        }, true); // useCapture = true

        // Adicionar tambÃ©m um listener de mousedown para debug
        salvarBtn.addEventListener('mousedown', () => {
            console.log('ðŸ–±ï¸ MOUSEDOWN no botÃ£o salvar');
        });

    } else {
        console.log('âŒ BotÃ£o salvar NÃƒO encontrado!');
    }
});

// FunÃ§Ã£o para mostrar toast
function showToast(message, actionText = '', timeout = 3000) {
    if (toast && toast.MaterialSnackbar && typeof toast.MaterialSnackbar.showSnackbar === 'function') {
        const snackbar = toast.MaterialSnackbar;
        const data = {
            message: message,
            timeout: timeout
        };
        if (actionText) {
            data.actionText = actionText;
        }
        snackbar.showSnackbar(data);
    } else {
        // Fallback: use alert if snackbar is not available
        alert(message);
    }
}

// FunÃ§Ã£o para fazer requisiÃ§Ãµes HTTP
async function makeRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || errorData.error || `Erro HTTP! status: ${response.status}`;
            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        console.error('Request error:', error);
        throw error;
    }
}

// FunÃ§Ã£o de login
async function handleLogin(event) {
    event.preventDefault();

    const codigo = document.getElementById('codigo').value.trim();
    const senha = document.getElementById('senha').value.trim();

    if (!codigo || !senha) {
        showToast('Por favor, preencha todos os campos');
        return;
    }

    // Mostrar loading
    loginLoading.style.display = 'block';
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const response = await makeRequest(`${API_BASE_URL}/login`, {
            method: 'POST',
            body: JSON.stringify({
                codigo: codigo,
                senha: senha
            })
        });

        if (response.success) {
            currentUser = {
                id: response.usuario_id,
                nome: response.usuario,
                codigo: response.codigo
            };

            // Salvar no localStorage
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            showToast('Login realizado com sucesso!');
            showContagensScreen();
        } else {
            showToast(response.message || 'Erro na sincronização');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showToast('Erro de conexão. Tente novamente.');
    } finally {
        loginLoading.style.display = 'none';
        submitButton.disabled = false;
    }
}

// FunÃ§Ã£o para logout
function handleLogout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    currentContagem = null;

    // Limpar formulÃ¡rio
    loginForm.reset();

    // Mostrar tela de login
    showScreen('login-screen');

    showToast('Logout realizado com sucesso');
}

// FunÃ§Ã£o para mostrar tela especÃ­fica
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
    document.body.classList.toggle('login-screen-active', screenId === 'login-screen');
}

// FunÃ§Ã£o para mostrar tela de contagens
async function showContagensScreen() {
    showScreen('contagens-screen');

    // Mostrar nome do usuÃ¡rio
    if (currentUser) {
        userNameSpan.textContent = `Olá, ${currentUser.nome}`;
    }

    // Carregar contagens
    await loadContagens();
}

// FunÃ§Ã£o para carregar contagens (Com suporte Offline)
async function loadContagens() {
    if (!currentUser) return;

    contagensLoading.style.display = 'flex';
    contagensGrid.innerHTML = '';

    console.log('--- loadContagens ---');
    console.log('Current User:', currentUser);

    if (!currentUser || !currentUser.id) {
        showToast("Erro: Usuário não identificado. Faça login novamente.");
        return;
    }

    // Key para cache
    const cacheKey = `contagens_${currentUser.id}`;

    try {
        // 1. Tentar pegar da API
        if (navigator.onLine) {
            try {
                const response = await makeRequest(`${API_BASE_URL}/estoque/contagem/${currentUser.id}`);

                if (Array.isArray(response)) {
                    // Sucesso API: Renderiza e Salva no Cache
                    await window.localDB.saveCache(cacheKey, response);

                    const liberadas = response.filter(c => c.liberado_contagem === true).length;
                    showToast(`Conectado! ${response.length} contagens encontradas (${liberadas} liberadas).`);

                    renderContagens(response);
                    return; // Fim com sucesso via API
                }
            } catch (apiError) {
                console.warn('Erro ao carregar da API, tentando cache...', apiError);
                // MOSTRAR ERRO REAL DA API PARA DEBUG
                let msg = apiError;
                if (apiError instanceof Error) msg = apiError.message;
                else if (typeof apiError === 'object') msg = JSON.stringify(apiError);

                showToast(`Erro API: ${msg}`, null, 5000);
            }
        }

        // 2. Fallback para Cache (Se offline ou erro na API)
        const cachedData = await window.localDB.getCache(cacheKey);

        if (cachedData && Array.isArray(cachedData)) {
            showToast('Mostrando dados Sem Conexão', null, 2000);
            renderContagens(cachedData);
        } else {
            // Se não tem cache nem API
            if (!navigator.onLine) {
                showToast('Sem conexão e sem dados locais.');
                contagensGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                        <i class="material-icons" style="font-size: 48px; margin-bottom: 16px; color: #F44336;">wifi_off</i>
                        <h4 style="color: #333; margin-bottom: 8px;">Você está Sem Conexão</h4>
                        <p style="color: #666;">Não existem contagens salvas neste dispositivo.</p>
                    </div>
                `;
            } else {
                showToast('Erro ao carregar contagens');
            }
        }

    } catch (error) {
        console.error('Erro geral ao carregar contagens:', error);
        // Show detailed error in toaster
        const errorMsg = error.message || "Erro desconhecido";
        showToast(`Erro ao carregar: ${errorMsg}`);
    } finally {
        contagensLoading.style.display = 'none';
    }
}

// FunÃ§Ã£o para renderizar contagens
function renderContagens(contagens) {
    // Filtrar apenas contagens liberadas
    const contagensLiberadas = contagens.filter(contagem => contagem.liberado_contagem === true);

    if (contagensLiberadas.length === 0) {
        contagensGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                <i class="material-icons" style="font-size: 48px; margin-bottom: 16px; color: #bbb;">inbox</i>
                <h4 style="color: #333; margin-bottom: 8px;">Nenhuma contagem liberada encontrada</h4>
                <p style="color: #666;">Não há contagens liberadas para você no momento.</p>
            </div>
        `;
        return;
    }

    contagensLiberadas.forEach((contagem, index) => {
        const dataFormatada = new Date(contagem.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const card = document.createElement('div');
        card.className = 'mdl-card mdl-shadow--2dp contagem-card';
        card.style.animationDelay = `${index * 0.1}s`;

        card.innerHTML = `
            <div class="mdl-card__title">
                <h2 class="mdl-card__title-text">Contagem #${contagem.contagem}</h2>
            </div>
            <div class="mdl-card__supporting-text">
                <div class="contagem-info">
                    <strong>Piso:</strong> ${contagem.piso || '-'}
                </div>
                <div class="contagem-info">
                    <strong>Responsável:</strong> ${contagem.usuario?.nome || 'N/A'}
                </div>
                <div class="contagem-info">
                    <strong>Código:</strong> ${contagem.usuario?.codigo || 'N/A'}
                </div>
                <div class="contagem-date">
                    <i class="material-icons" style="font-size: 16px; vertical-align: middle;">schedule</i>
                    ${dataFormatada}
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            currentContagem = contagem;
            showItensScreen();
        });

        contagensGrid.appendChild(card);
    });
}

// FunÃ§Ã£o para mostrar tela de itens
async function showItensScreen() {
    if (!currentContagem) return;

    // PERSISTÊNCIA DE NAVEGAÇÃO: Salvar referência para reload
    localStorage.setItem('currentContagem', JSON.stringify(currentContagem));

    showScreen('itens-screen');

    // Resetar estados
    salvarBtn.style.display = 'inline-flex';
    salvarBtn.disabled = true;
    salvarBtn.innerHTML = '<i class="material-icons" style="margin-right: 8px;">save</i>Concluir Contagem';

    // Mostrar informaÃ§Ãµes da contagem
    const itensParaConferir = currentContagem.itens ? currentContagem.itens.filter(item => item.conferir === true) : [];
    const totalItens = currentContagem.itens ? currentContagem.itens.length : 0;

    contagemHeading.textContent = `Contagem #${currentContagem.contagem} | ${itensParaConferir.length} de ${totalItens} itens para conferir`;

    // Carregar itens
    await loadItens();
}

// FunÃ§Ã£o para carregar itens
async function loadItens() {
    if (!currentContagem || !currentContagem.itens) return;

    itensLoading.style.display = 'flex';
    itensList.innerHTML = '';

    try {
        // Sticky Data: Buscar TODOS os logs desta contagem (mesmo os sincronizados)
        // Isso garante que o valor local "vença" e permaneça na tela mesmo se a API 
        // ainda não retornou o total atualizado no endpoint da lista.
        // DEBUG PERSISTENCE
        console.log('--- loadItens Debug ---');
        console.log('Current Contagem:', currentContagem);
        console.log('Searching logs for Contagem Num:', currentContagem.contagem, '(Type:', typeof currentContagem.contagem, ')');
        console.log('Searching logs for Contagem ID:', currentContagem.id, '(Type:', typeof currentContagem.id, ')');

        if (currentContagem.contagem) {
            const byNum = await window.localDB.getLogsByContagemNum(currentContagem.contagem);
            console.log('Found by Log Num:', byNum);
            if (byNum && Array.isArray(byNum)) logs = logs.concat(byNum);
        }

        // 2. Fallback: buscar por ID original (caso existam logs antigos ou sync via ID)
        if (currentContagem.id) {
            const byId = await window.localDB.getLogsByContagem(currentContagem.id);
            console.log('Found by Log ID:', byId);
            if (byId && Array.isArray(byId)) logs = logs.concat(byId);
        }

        // Se ainda não achou nada (ex: primeira vez), tenta logs pendentes gerais (fallback)
        if (logs.length === 0) {
            const pending = await window.localDB.getPendingLogs();
            console.log('Found by Pending (Fallback):', pending);
            if (pending && Array.isArray(pending)) logs = pending;
        }

        console.log('Total Logs Merged:', logs);

        if (logs.length > 0) {
            // Opcional: mostrar aviso discreto
            // showToast(`Restaurados ${logs.length} itens da memória.`);
        }

        // Criar mapa de ItemID -> Ultimo Log
        const localState = {};
        if (logs && Array.isArray(logs)) {
            // Ordenar por data de criação para garantir que o último prevaleça
            logs.sort((a, b) => (a.creationTime || 0) - (b.creationTime || 0));

            logs.forEach(log => {
                localState[log.item_id] = log;
            });
        }

        renderItens(currentContagem.itens, localState);
    } catch (e) {
        console.error("Erro ao carregar itens/logs:", e);
        renderItens(currentContagem.itens, {});
    } finally {
        itensLoading.style.display = 'none';
    }
}

// Função para renderizar itens na tabela
function renderItens(itens, localState = {}) {
    itensList.innerHTML = '';

    if (!itens || itens.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'itens-empty';
        emptyState.innerHTML = `
            <i class="material-icons">inventory_2</i>
            <p>Nenhum item encontrado nesta contagem</p>
        `;
        itensList.appendChild(emptyState);
        return;
    }

    // Filtrar apenas itens com conferir = true
    let itensParaConferir = itens.filter(item => item.conferir === true);

    if (itensParaConferir.length === 0) {
        const doneState = document.createElement('div');
        doneState.className = 'itens-empty sucesso';
        doneState.innerHTML = `
            <i class="material-icons">check_circle</i>
            <h4>Todos os itens conferidos!</h4>
            <p>NÃ£o hÃ¡ divergÃªncias nesta contagem.</p>
        `;
        itensList.appendChild(doneState);
        return;
    }

    let cardIndex = 0;
    const allCards = [];
    itensParaConferir.forEach((item) => {
        // Verificar se tem estado local salvo (Rehydration)
        const savedLog = localState[item.id];
        const hasLocalValue = savedLog !== undefined;
        // Prioridade: Valor Local > Valor da API (que geralmente vem 0 ou desatualizado se tiver delay)
        // Mas se a API tiver um valor (ex: jÃ¡ contado antes) e nÃ£o tiver local, usa API.
        // Assumindo que input deve mostrar o que foi contado.

        // Se tiver log pendente, usa ele. Se nÃ£o, usa o valor que veio da API (se houver, mas geralmente a API nÃ£o manda o "input", manda o estoque)
        // Espere, o endpoint getContagens retorna o que? 
        // Retorna a lista de itens. O item nÃ£o tem "quantidade contada" nele persistida separadamente alÃ©m dos logs.
        // EntÃ£o o input comeÃ§a vazio ou com valor local.

        const inputValue = hasLocalValue ? savedLog.contado : '';
        const statusClass = hasLocalValue ? 'conferencia-pendente' : '';
        const statusMessage = hasLocalValue ? ' (Salvo Local)' : '';

        // Card único por item
        const card = document.createElement('div');
        const isSaved = hasLocalValue === true; // Garante booleano para facilitar leitura

        card.className = `item-card ${isSaved ? 'item-card--saved' : ''}`;
        card.dataset.itemId = item.id;
        card.style.animationDelay = `${cardIndex * 0.05}s`;

        // Define o estado inicial do botão (Salvar ou Editar)
        const btnIcon = isSaved ? 'edit' : 'save';
        const btnText = isSaved ? 'Editar' : 'Salvar';
        const btnMode = isSaved ? 'edit' : 'save';

        card.innerHTML = `
            <div class="item-card__info">
                <div class="item-card__title">
                    <span class="item-code">#${item.cod_produto}</span>
                    <span class="item-desc">${item.desc_produto || '-'}</span>
                </div>
                <div class="item-card__meta">
                    <span>Localização: <strong>${item.localizacao || '-'}</strong></span>
                    ${isSaved ? `<span style="color:green; font-size:10px;">${statusMessage}</span>` : ''}
                </div>
            </div>
            <div class="item-card__actions">
                <div class="quantity-wrapper">
                    <label>Qtd</label>
                    <input 
                        type="number" 
                        class="quantidade-input ${statusClass}" 
                        value="${inputValue}"
                        placeholder="0"
                        min="0"
                        step="1"
                        data-item-id="${item.id}"
                        data-cod-produto="${item.cod_produto}"
                        data-tipo="locacao"
                        data-identificador-item="${item.identificador_item}"
                        data-tem-aplicacao="${item.tem_aplicacao || false}"
                        ${isSaved ? 'disabled' : ''}
                    >
                </div>
                <button type="button" class="item-save-btn" data-mode="${btnMode}" onclick="toggleItemSave(this)">
                    <i class="material-icons">${btnIcon}</i> ${btnText}
                </button>
            </div>
        `;
        allCards.push({
            el: card,
            sortVal: (item.localizacao || '')
        });
        cardIndex++;
    });

    // Ordena os cards em ordem crescente
    allCards.sort((a, b) => a.sortVal.localeCompare(b.sortVal, undefined, { numeric: true, sensitivity: 'base' }));
    allCards.forEach(cardObj => {
        itensList.appendChild(cardObj.el);
    });

    componentHandler.upgradeDom();
    updateConcluirButtonState();
}

async function toggleItemSave(button) {
    const card = button.closest('.item-card');
    if (!card) return;
    if (!itensList) return;

    const input = card.querySelector('.quantidade-input');
    if (!input) return;

    const currentMode = button.dataset.mode;

    // --- MODO: EDITAR (Ao clicar em Editar) ---
    if (currentMode === 'edit') {
        // Habilita edição
        input.disabled = false;
        input.focus();

        // Remove estilo de salvo
        card.classList.remove('item-card--saved');

        // Muda botão para "Salvar"
        button.innerHTML = '<i class="material-icons">save</i> Salvar';
        button.dataset.mode = 'save';

        return;
    }

    // --- MODO: SALVAR (Ao clicar em Salvar) ---
    if (currentMode === 'save') {
        if (!input.value || input.value.trim() === '') {
            showToast('Informe a quantidade antes de salvar');
            input.focus();
            return;
        }

        // Recuperar IDs para acionar a validação
        const itemId = input.dataset.itemId;
        const codProduto = input.dataset.codProduto;

        // Feedback visual de carregamento
        const originalText = button.innerHTML;
        button.disabled = true;
        button.textContent = 'Salvando...';

        try {
            // Força a execução da lógica de validação e envio (mesmo se já estava salvo local)
            await handleQuantidadeChange(input, itemId, codProduto);

            // Se chegou aqui sem erro, significa que salvou e conferiu (ou salvou offline) e não deu erro de API.

            // 1. Trava a UI novamente
            input.disabled = true;
            card.classList.add('item-card--saved');

            // 2. Muda botão para "Editar" novamente
            button.innerHTML = '<i class="material-icons">edit</i> Editar';
            button.dataset.mode = 'edit';

            // Reabilita o botão (pois agora é um botão de Editar)
            button.disabled = false;

            // Salvar no localStorage (Fallback extra, já que o main logic usa IndexedDB)
            // Mantemos isso para compatibilidade se o app usa isso em outro lugar, 
            // mas o ideal seria centralizar tudo no IndexedDB/localDB.
            let savedItens = JSON.parse(localStorage.getItem('itensSalvos') || '[]');
            savedItens = savedItens.filter(i => i.itemId !== itemId);
            savedItens.push({
                itemId,
                codProduto,
                quantidade: input.value,
                timestamp: Date.now()
            });
            localStorage.setItem('itensSalvos', JSON.stringify(savedItens));

            // Move para o final da lista? O usuário pediu para editar, se movermos pode perder o foco visual.
            // Vou comentar a linha que move para o final, para manter a consistência visual onde o usuário estava.
            // itensList.appendChild(card); 

        } catch (error) {
            console.error('Erro ao salvar item:', error);
            showToast('Erro ao validar item. Tente novamente.');

            // Restaura estado anterior em caso de erro
            button.disabled = false;
            button.innerHTML = originalText;
            return;
        }
    }

    updateConcluirButtonState();
}

window.toggleItemSave = toggleItemSave;

function updateConcluirButtonState() {
    if (!salvarBtn) return;

    salvarBtn.style.display = 'inline-flex';

    const cards = document.querySelectorAll('.item-card');

    if (!cards.length) {
        salvarBtn.disabled = true;
        return;
    }

    // Verifica se há pelo menos um item salvo (permite conclusão mesmo com itens sobrando)
    const hasSavedItems = Array.from(cards).some(card => card.classList.contains('item-card--saved'));

    salvarBtn.disabled = !hasSavedItems;
}

// FunÃ§Ã£o para lidar com mudanÃ§a de quantidade
async function handleQuantidadeChange(input, itemId, codProduto) {
    const quantidade = parseInt(input.value);
    if (isNaN(quantidade) || quantidade < 0) {
        input.value = '';
        showToast('Quantidade inválida');
        return;
    }

    // Verifica se existem inputs de OUTROS cartões que sejam do mesmo PRODUTO (mesmo codProduto)
    // para somar tudo.
    const allInputs = document.querySelectorAll(`.quantidade-input`);
    let soma = 0;

    // Filtra inputs que tenham o mesmo data-cod-produto
    const inputsDoProduto = Array.from(allInputs).filter(inp => inp.dataset.codProduto === String(codProduto));

    inputsDoProduto.forEach(inp => {
        const val = parseInt(inp.value);
        if (!isNaN(val)) soma += val;
    });

    console.log(`Item ${itemId} (Cod ${codProduto}): Soma TOTAL das quantidades = ${soma}`);

    try {
        // Conferir o estoque no sistema usando a soma TOTAL
        await conferirEstoqueSoma(itemId, codProduto, soma, inputsDoProduto);
        // Focar no próximo input
        focusNextInput(input);
    } catch (error) {
        console.error('Erro ao conferir estoque:', error);
        showToast('Erro ao conferir estoque');
        inputsDoProduto.forEach(inp => {
            inp.classList.remove('conferencia-ok', 'conferencia-divergente');

            inp.classList.add('conferencia-erro');
            setTimeout(() => {
                inp.classList.remove('conferencia-erro');
            }, 3000);
        });
    }
}

// Função para conferir estoque
// Nova função para conferir estoque somando locação e sublocação
async function conferirEstoqueSoma(itemId, codProduto, somaQuantidades, allInputs) {

    // 1. SALVAR LOCALMENTE PRIMEIRO (Offline-First)
    // Marca visualmente como Pendente/Salvo Local enquanto processa
    allInputs.forEach(inp => {
        inp.classList.remove('conferencia-ok', 'conferencia-divergente', 'conferencia-erro');
        inp.classList.add('conferencia-pendente');
        inp.dataset.temDivergencia = 'false';
    });

    try {
        // Salva no IndexedDB imediatamente com estoque 0 (será atualizado ou ignorado pelo backend na validação)
        // O importante é garantir que o "contado" (somaQuantidades) esteja salvo.
        // Nota: enviarLogContagem já chama o syncManager.triggerSync() se estiver online.
        await enviarLogContagem(itemId, 0);
    } catch (e) {
        console.error("Erro ao salvar localmente:", e);
        showToast("Erro ao salvar dados no dispositivo!");
        return; // Se não salvou local, nem tenta rede.
    }

    const isOnline = navigator.onLine;

    // Se estiver offline, paramos por aqui (já salvou e marcou pendente/amarelo)
    if (!isOnline) {
        console.log('Dispositivo Offline: Dados salvos localmente.');
        showToast('Salvo offline. Será sincronizado quando retomar conexão.');
        updateConcluirButtonState();
        return;
    }

    // 2. SE ONLINE: Conferir divergência com o servidor
    try {
        console.log('Dispositivo Online: Conferindo estoque...');
        let conferir = false;

        // Fazer GET para conferir estoque
        const response = await makeRequest(`${API_BASE_URL}/estoque/contagem/conferir/${codProduto}?empresa=3`);
        const estoqueReal = response.ESTOQUE;
        console.log(`Produto ${codProduto} - Quantidade em estoque: ${estoqueReal}`);

        // Se a soma for igual ao estoque real, marcar ambos como conferido (conferir: false)
        conferir = somaQuantidades !== estoqueReal;

        // --- ATUALIZAÇÃO LOCAL DO ESTOQUE ---
        // Se a busca online teve sucesso, ATUALIZAMOS o log local com o estoque real recuperado.
        // Isso garante que o dispositivo fique com o dado mais quente possível.
        try {
            // Recriar o objeto logData para atualizar apenas o estoque
            // Precisamos do ID do user e contagem, que estão globais
            const identificadorItem = allInputs[0].dataset.identificadorItem;
            if (identificadorItem) {
                // Atualiza logs locais que batem com esse identificador
                await window.localDB.updateEstoqueByItem(identificadorItem, estoqueReal);
                console.log(`[FRONT] Estoque local atualizado para ${estoqueReal} (Item ${identificadorItem})`);
            }
        } catch (dbError) {
            console.warn("[FRONT] Falha ao atualizar estoque local:", dbError);
        }

        const input = document.querySelector(`.quantidade-input[data-item-id='${itemId}']`);
        const temAplicacao = input && input.dataset.temAplicacao === 'true';

        if (temAplicacao) {
            console.log(`Produto ${codProduto} - Item com aplicação: Marcando como conferido (conferir: false) para aguardar segunda contagem.`);
            conferir = false;
        }

        console.log(`Produto ${codProduto} - Conferir final: ${conferir} (Estoque: ${estoqueReal}, Contado: ${somaQuantidades}) {itemId: ${itemId}}`);

        // Atualizar o item de contagem
        let identificadorItem = null;
        if (currentContagem && Array.isArray(currentContagem.itens)) {
            const itemObj = currentContagem.itens.find(it => it.id === itemId);
            if (itemObj && itemObj.identificador_item) {
                identificadorItem = itemObj.identificador_item;
            }
        }
        if (!identificadorItem) {
            throw new Error('identificador_item não encontrado para o item');
        }

        // UPDATE no servidor para marcar se está conferido ou não
        await makeRequest(`${API_BASE_URL}/estoque/contagem/item/${identificadorItem}`, {
            method: 'PUT',
            body: JSON.stringify({
                conferir: conferir,
                itemId: itemId
            })
        });

        // Atualizar feedback visual Definitivo (Verde/Vermelho)
        allInputs.forEach(inp => {
            inp.classList.remove('conferencia-ok', 'conferencia-divergente', 'conferencia-erro', 'conferencia-pendente');
            if (conferir) {
                inp.classList.add('conferencia-divergente');
                inp.dataset.temDivergencia = 'true';
            } else {
                if (temAplicacao && somaQuantidades !== estoqueReal) {
                    inp.classList.add('conferencia-pendente');
                    inp.dataset.temDivergencia = 'false';
                } else {
                    inp.classList.add('conferencia-ok');
                    inp.dataset.temDivergencia = 'false';
                }
            }
        });

        updateConcluirButtonState();
    } catch (error) {
        console.error('Erro na conferência online:', error);
        // Remove estado de pendente antes de lançar o erro para o caller tratar
        if (allInputs) {
            allInputs.forEach(inp => inp.classList.remove('conferencia-pendente'));
        }
        throw error;
    }
}

window.conferirEstoqueSoma = conferirEstoqueSoma;

// FunÃ§Ã£o para enviar log da contagem (Agora Offline-First)
async function enviarLogContagem(itemId, estoque) {
    try {
        let totalContado = 0;
        let identificadorItem = null;
        const inputs = document.querySelectorAll(`.quantidade-input[data-item-id='${itemId}']`);

        inputs.forEach(input => {
            const val = parseInt(input.value);
            if (!isNaN(val)) totalContado += val;
            if (!identificadorItem && input.dataset.identificadorItem) {
                identificadorItem = input.dataset.identificadorItem;
            }
        });

        const logData = {
            contagem_id: currentContagem.id, // Mantemos o ID original para Sync
            contagem_num: currentContagem.contagem, // Adicionamos Número Estável para Persistência Local
            usuario_id: currentUser.id,
            item_id: itemId,
            estoque: estoque,
            contado: totalContado,
            identificador_item: identificadorItem
        };

        console.log('Salvando log localmente:', logData);

        // 1. Salvar SEMPRE no LocalDB primeiro
        const logId = await window.localDB.addLog(logData);
        // console.log(`Log salvo com ID ${logId} para Contagem ${logData.contagem_id} (Num: ${logData.contagem_num})`);

        showToast('Item salvo!');

        // 2. Tentar disparar o sync (Se online)
        // O SyncManager vai cuidar de ler o banco e enviar.
        if (window.syncManager) {
            window.syncManager.triggerSync();
        }

    } catch (error) {
        console.error('Erro ao salvar log local:', error);
        let msg = error.message || error;
        showToast(`Erro crítico ao salvar: ${msg}`);
    }
}

// Função para focar no próximo input
function focusNextInput(currentInput) {
    const allInputs = document.querySelectorAll('.quantidade-input');
    const currentIndex = Array.from(allInputs).indexOf(currentInput);

    if (currentIndex >= 0 && currentIndex < allInputs.length - 1) {
        let nextIndex = currentIndex + 1;
        while (nextIndex < allInputs.length && allInputs[nextIndex].disabled) {
            nextIndex++;
        }
        if (nextIndex < allInputs.length) {
            const nextInput = allInputs[nextIndex];
            nextInput.focus();
            nextInput.select();
        }
    }
}

// para salvar todas as quantidades (exemplo)
function salvarQuantidades() {
    const inputs = document.querySelectorAll('.quantidade-input');
    const quantidades = [];

    inputs.forEach(input => {
        if (input.value && input.value.trim() !== '') {
            quantidades.push({
                itemId: input.dataset.itemId,
                quantidade: parseInt(input.value)
            });
        }
    });

    console.log('Quantidades a salvar:', quantidades);

    // Aqui vocÃª implementaria a requisiÃ§Ã£o para salvar no backend
    showToast(`${quantidades.length} quantidades salvas com sucesso!`);
}

// FunÃ§Ã£o para formatar data
function formatarData(dataString) {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// FunÃ§Ã£o para filtrar itens (exemplo de funcionalidade extra)
function filtrarItens(texto) {
    if (!itensList) return;
    const cards = itensList.querySelectorAll('.item-card');

    cards.forEach(card => {
        const textoCard = card.textContent.toLowerCase();
        const mostrar = textoCard.includes(texto.toLowerCase());
        card.style.display = mostrar ? '' : 'none';
    });
}

// Event listeners adicionais
document.addEventListener('keydown', (event) => {
    // ESC para voltar
    if (event.key === 'Escape') {
        if (itensScreen.classList.contains('active')) {
            showContagensScreen();
        }
    }

    // Enter para fazer login se estiver na tela de login
    if (event.key === 'Enter' && loginScreen.classList.contains('active')) {
        handleLogin(event);
    }
});

// Adicionar funcionalidade de pesquisa (exemplo)
function adicionarPesquisa() {
    const searchInput = document.createElement('div');
    searchInput.className = 'mdl-textfield mdl-js-textfield mdl-textfield--floating-label';
    searchInput.innerHTML = `
        <input class="mdl-textfield__input" type="text" id="search-input" onkeyup="filtrarItens(this.value)">
        <label class="mdl-textfield__label" for="search-input">Pesquisar itens...</label>
    `;

    const tableContainer = document.getElementById('itens-table-container');
    tableContainer.parentNode.insertBefore(searchInput, tableContainer);

    // Upgrade MDL
    componentHandler.upgradeDom();
}

// FunÃ§Ã£o para exportar dados (exemplo)
function exportarDados() {
    if (!currentContagem) return;

    const dados = {
        contagem: currentContagem,
        quantidades: []
    };

    const inputs = document.querySelectorAll('.quantidade-input');
    inputs.forEach(input => {
        if (input.value) {
            dados.quantidades.push({
                itemId: input.dataset.itemId,
                quantidade: parseInt(input.value)
            });
        }
    });

    const dataStr = JSON.stringify(dados, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `contagem_${currentContagem.contagem}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Dados exportados com sucesso!');
}