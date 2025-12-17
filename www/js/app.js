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
            divergencia: temDivergencia
        };
        await makeRequest(`${API_BASE_URL}/estoque/contagem/liberar`, {
            method: 'PUT',
            body: JSON.stringify(bodyData)
        });
        showToast(temDivergencia ? 'Contagem com divergência liberada!' : 'Contagem finalizada!');
    } catch (error) {
        showToast('Erro ao liberar contagem!');
    }
    // Volta para a listagem de contagens
    showContagensScreen();
};
// Configuração da API
// Configuração da API
const hostname = window.location.hostname;
const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.');

// Se for dev/local, usa o MESMO IP na porta 8000. Se não, usa prod.
const API_BASE_URL = isLocalDev
    ? `http://${hostname}:8000`
    : 'http://estoque-service.acacessorios.local';

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

    // Verificar se jÃ¡ estÃ¡ logado
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showContagensScreen();
    }

    // Event listeners
    loginForm.addEventListener('submit', handleLogin);
    backBtn.addEventListener('click', () => showContagensScreen());
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
    const snackbar = toast.MaterialSnackbar;
    const data = {
        message: message,
        timeout: timeout
    };
    if (actionText) {
        data.actionText = actionText;
    }
    snackbar.showSnackbar(data);
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
            const errorMessage = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
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
            showToast(response.message || 'Erro no login');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showToast('Erro de conexÃ£o. Tente novamente.');
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

// FunÃ§Ã£o para carregar contagens
async function loadContagens() {
    if (!currentUser) return;

    contagensLoading.style.display = 'flex';
    contagensGrid.innerHTML = '';

    try {
        const response = await makeRequest(`${API_BASE_URL}/estoque/contagem/${currentUser.id}`);

        if (Array.isArray(response)) {
            renderContagens(response);
        } else {
            showToast('Erro ao carregar contagens');
        }
    } catch (error) {
        console.error('Erro ao carregar contagens:', error);
        showToast(`Erro: ${error.message}`);
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
                    <strong>ID:</strong> ${contagem.contagem_cuid}
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

// FunÃ§Ã£o para carregar itens (simulaÃ§Ã£o, jÃ¡ que os itens vÃªm na contagem)
async function loadItens() {
    if (!currentContagem || !currentContagem.itens) return;

    itensLoading.style.display = 'flex';
    itensList.innerHTML = '';

    // Simular delay para loading
    setTimeout(() => {
        renderItens(currentContagem.itens);
        itensLoading.style.display = 'none';
    }, 500);
}

// FunÃ§Ã£o para renderizar itens na tabela
function renderItens(itens) {
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

    // NÃO ordenar antes de gerar os cards

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
        // Card único por item
        const card = document.createElement('div');
        card.className = 'item-card';
        card.dataset.itemId = item.id;
        card.style.animationDelay = `${cardIndex * 0.05}s`;
        card.innerHTML = `
            <div class="item-card__info">
                <div class="item-card__title">
                    <span class="item-code">#${item.cod_produto}</span>
                    <span class="item-desc">${item.desc_produto || '-'}</span>
                </div>
                <div class="item-card__meta">
                    <span>Localização: <strong>${item.localizacao || '-'}</strong></span>
                </div>
            </div>
            <div class="item-card__actions">
                <div class="quantity-wrapper">
                    <label>Qtd</label>
                    <input 
                        type="number" 
                        class="quantidade-input" 
                        placeholder="0"
                        min="0"
                        step="1"
                        data-item-id="${item.id}"
                        data-cod-produto="${item.cod_produto}"
                        data-tipo="locacao"
                        data-identificador-item="${item.identificador_item}"
                        data-tem-aplicacao="${item.tem_aplicacao || false}"
                        onblur="handleQuantidadeChange(this, '${item.id}', '${item.cod_produto}')"
                    >
                </div>
                <button type="button" class="item-save-btn" data-mode="save" onclick="toggleItemSave(this)">
                    <i class="material-icons">check</i>
                    Salvar
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

function toggleItemSave(button) {
    const card = button.closest('.item-card');
    if (!card) return;
    if (!itensList) return;

    const input = card.querySelector('.quantidade-input');
    if (!input) return;

    if (button.dataset.mode === 'save') {
        if (!input.value || input.value.trim() === '') {
            showToast('Informe a quantidade antes de salvar');
            input.focus();
            return;
        }

        input.disabled = true;
        card.classList.add('item-card--saved');
        button.disabled = true;
        button.innerHTML = '<i class="material-icons">check</i> Salvo';
        itensList.appendChild(card);
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

// FunÃ§Ã£o para conferir estoque
// Nova função para conferir estoque somando locação e sublocação
async function conferirEstoqueSoma(itemId, codProduto, somaQuantidades, allInputs) {
    try {
        // Fazer GET para conferir estoque
        const response = await makeRequest(`${API_BASE_URL}/estoque/contagem/conferir/${codProduto}?empresa=3`);
        const estoqueReal = response.ESTOQUE;
        console.log(`Produto ${codProduto} - Quantidade em estoque: ${estoqueReal}`);

        // Se a soma for igual ao estoque real, marcar ambos como conferido (conferir: false)
        let conferir = somaQuantidades !== estoqueReal;

        // LÓGICA DE APLICAÇÃO:
        // Se o produto tem aplicação, a primeira contagem não deve gerar divergência imediata (stay pending).
        // Assumimos que o backend fará a soma com a segunda contagem.
        // Portanto, enviamos conferir = false para indicar que "esta" contagem foi concluída pelo usuário.
        // Se houver divergência na soma total, o backend deverá reabrir o item.
        const input = document.querySelector(`.quantidade-input[data-item-id='${itemId}']`);
        const temAplicacao = input && input.dataset.temAplicacao === 'true';

        console.log(`Produto ${codProduto} - Tem Aplicação: ${temAplicacao}`);

        if (temAplicacao) {
            console.log(`Produto ${codProduto} - Item com aplicação: Marcando como conferido (conferir: false) para aguardar segunda contagem.`);
            conferir = false;
            // Nota: Se a soma for realmente divergente após os dois contarem, 
            // o backend deve ser responsável por setar conferir = true novamente.
        }

        console.log(`Produto ${codProduto} - Conferir final: ${conferir} (Estoque: ${estoqueReal}, Contado: ${somaQuantidades}) {itemId: ${itemId}}`);

        // Atualizar o item de contagem (apenas 1 chamada, pois é o mesmo ID)
        // Buscar o identificador_item do item atual
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

        // MOVIDO PARA ANTES DO UPDATE: Enviar log da contagem PRÉVIAMENTE
        // Isso garante que o backend tenha o valor contado mais recente ao calcular a divergência.
        // O Log deve ser enviado para o ITEM específico que foi digitado (itemId).
        // OBS: Enviamos a soma parcial deste item, não a soma total do produto (o backend que some se quiser, ou usamos logs individuais).
        // A função enviarLogContagem pega o valor do input do itemId.
        await enviarLogContagem(itemId, estoqueReal);

        await makeRequest(`${API_BASE_URL}/estoque/contagem/item/${identificadorItem}`, {
            method: 'PUT',
            body: JSON.stringify({
                conferir: conferir,
                itemId: itemId
            })
        });

        // Limpar classes anteriores e aplicar feedback visual em todos os inputs
        allInputs.forEach(inp => {
            inp.classList.remove('conferencia-ok', 'conferencia-divergente', 'conferencia-erro', 'conferencia-pendente');
            if (conferir) {
                inp.classList.add('conferencia-divergente');
                inp.dataset.temDivergencia = 'true';
            } else {
                if (temAplicacao && somaQuantidades !== estoqueReal) {
                    // Visualmente indicamos que está pendente/parcial, mas salvo
                    inp.classList.add('conferencia-pendente');
                    inp.dataset.temDivergencia = 'false'; // Não bloqueia a saída
                } else {
                    inp.classList.add('conferencia-ok');
                    inp.dataset.temDivergencia = 'false';
                }
            }
        });

        updateConcluirButtonState();
    } catch (error) {
        throw error;
    }
}


// FunÃ§Ã£o para enviar log da contagem para a API
// Removido argumento 'contado' pois vamos ler do input diretamente para ser atomicamente correto com a UI
async function enviarLogContagem(itemId, estoque) {
    try {
        // Somar os valores digitados para locação e sub locação
        let totalContado = 0;
        let identificadorItem = null;
        const inputs = document.querySelectorAll(`.quantidade-input[data-item-id='${itemId}']`);
        inputs.forEach(input => {
            const val = parseInt(input.value);
            if (!isNaN(val)) totalContado += val;
            // Capturar identificador_item do primeiro input (será o mesmo para todos os inputs do mesmo item)
            if (!identificadorItem && input.dataset.identificadorItem) {
                identificadorItem = input.dataset.identificadorItem;
            }
        });

        const logData = {
            contagem_id: currentContagem.id, // ID específico da contagem (ex: clx...type1)
            usuario_id: currentUser.id,
            item_id: itemId,
            estoque: estoque,
            contado: totalContado,
            identificador_item: identificadorItem
        };

        console.log('Enviando log da contagem:', logData);

        const response = await makeRequest(`${API_BASE_URL}/estoque/contagem/log`, {
            method: 'POST',
            body: JSON.stringify(logData)
        });

        console.log('Log enviado com sucesso:', response);

    } catch (error) {
        console.error('Erro ao enviar log da contagem:', error);
        // Não interromper o fluxo principal mesmo se o log falhar
    }
}

// FunÃ§Ã£o para focar no prÃ³ximo input
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



