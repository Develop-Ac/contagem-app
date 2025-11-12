// ConfiguraÃ§Ã£o da API
const API_BASE_URL = 'http://intranetbackend.acacessorios.local';

// Estado da aplicaÃ§Ã£o
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
document.addEventListener('DOMContentLoaded', function() {
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
        salvarBtn.onclick = function(event) {
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
            throw new Error(`HTTP error! status: ${response.status}`);
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
        showToast('Erro de conexÃ£o ao carregar contagens');
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
                <p style="color: #666;">NÃ£o hÃ¡ contagens liberadas para vocÃª no momento.</p>
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

    // Ordenar pela localização da esquerda para a direita (ordem alfanumérica completa)
    itensParaConferir = itensParaConferir.sort((a, b) => {
        const locA = a.localizacao || '';
        const locB = b.localizacao || '';
        // Utiliza localeCompare com opção numeric para comparar cada caractere da esquerda para a direita
        return locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
    });

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
    itensParaConferir.forEach((item) => {
        // Se tem sub locação, cria dois cards
        if (item.aplicacoes) {
            // Card para localização principal
            const cardLoc = document.createElement('div');
            cardLoc.className = 'item-card';
            cardLoc.dataset.itemId = item.id + '_loc';
            cardLoc.style.animationDelay = `${cardIndex * 0.05}s`;
            cardLoc.innerHTML = `
                <div class="item-card__info">
                    <div class="item-card__title">
                        <span class="item-code">#${item.cod_produto}</span>
                        <span class="item-desc">${item.desc_produto || '-'} (Locação)</span>
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
                            onblur="handleQuantidadeChange(this, '${item.id}', '${item.cod_produto}')"
                        >
                    </div>
                    <button type="button" class="item-save-btn" data-mode="save" onclick="toggleItemSave(this)">
                        <i class="material-icons">check</i>
                        Salvar
                    </button>
                </div>
            `;
            itensList.appendChild(cardLoc);
            cardIndex++;

            // Card para sub locação
            const cardSub = document.createElement('div');
            cardSub.className = 'item-card';
            cardSub.dataset.itemId = item.id + '_sub';
            cardSub.style.animationDelay = `${cardIndex * 0.05}s`;
            cardSub.innerHTML = `
                <div class="item-card__info">
                    <div class="item-card__title">
                        <span class="item-code">#${item.cod_produto}</span>
                        <span class="item-desc">${item.desc_produto || '-'} (Sub Locação)</span>
                    </div>
                    <div class="item-card__meta">
                        <span>Sub Locação: <strong>${item.aplicacoes}</strong></span>
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
                            data-tipo="sublocacao"
                            onblur="handleQuantidadeChange(this, '${item.id}', '${item.cod_produto}')"
                        >
                    </div>
                    <button type="button" class="item-save-btn" data-mode="save" onclick="toggleItemSave(this)">
                        <i class="material-icons">check</i>
                        Salvar
                    </button>
                </div>
            `;
            itensList.appendChild(cardSub);
            cardIndex++;
        } else {
            // Card único para itens sem sub locação
            const card = document.createElement('div');
            card.className = 'item-card';
            card.dataset.itemId = item.id;
            card.style.animationDelay = `${cardIndex * 0.05}s`;
            card.innerHTML = `
                <div class="item-card__info">
                    <div class="item-card__title">
                        <span class="item-code">#${item.cod_produto}</span>
                        <span class="item-desc">${item.desc_produto || '-'} </span>
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
                            onblur="handleQuantidadeChange(this, '${item.id}', '${item.cod_produto}')"
                        >
                    </div>
                    <button type="button" class="item-save-btn" data-mode="save" onclick="toggleItemSave(this)">
                        <i class="material-icons">check</i>
                        Salvar
                    </button>
                </div>
            `;
            itensList.appendChild(card);
            cardIndex++;
        }
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
        button.dataset.mode = 'edit';
        button.classList.add('item-edit-btn');
        button.innerHTML = '<i class="material-icons">edit</i> Alterar';
        itensList.appendChild(card);
    } else {
        input.disabled = false;
        card.classList.remove('item-card--saved');
        button.dataset.mode = 'save';
        button.classList.remove('item-edit-btn');
        button.innerHTML = '<i class="material-icons">check</i> Salvar';
        input.focus();
        input.select();
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

    const allInputsValid = Array.from(cards).every(card => {
        const input = card.querySelector('.quantidade-input');
        return input && input.value && input.value.trim() !== '' && input.dataset.temDivergencia !== undefined;
    });

    const allSaved = allInputsValid && Array.from(cards).every(card => card.classList.contains('item-card--saved'));

    salvarBtn.disabled = !allSaved;
}

// FunÃ§Ã£o para lidar com mudanÃ§a de quantidade
async function handleQuantidadeChange(input, itemId, codProduto) {
    const quantidade = parseInt(input.value);
    
    if (isNaN(quantidade) || quantidade < 0) {
        input.value = '';
        showToast('Quantidade invÃ¡lida');
        return;
    }

    console.log(`Item ${itemId}: Quantidade alterada para ${quantidade}`);
    
    try {
        // Conferir o estoque no sistema
        await conferirEstoque(itemId, codProduto, quantidade, input);
        
        // Focar no prÃ³ximo input
        focusNextInput(input);
        
    } catch (error) {
        console.error('Erro ao conferir estoque:', error);
        showToast('âŒ Erro ao conferir estoque');
        input.classList.remove('conferencia-ok', 'conferencia-divergente');
        input.classList.add('conferencia-erro');
        setTimeout(() => {
            input.classList.remove('conferencia-erro');
        }, 3000);
    }
}

// FunÃ§Ã£o para conferir estoque
async function conferirEstoque(itemId, codProduto, quantidadeDigitada, input) {
    try {
        // Fazer GET para conferir estoque
        const response = await makeRequest(`${API_BASE_URL}/estoque/contagem/conferir/${codProduto}?empresa=3`);
        
        const estoqueReal = response.ESTOQUE;
        const conferir = quantidadeDigitada !== estoqueReal;
        
        // Fazer PUT para atualizar o item
        await makeRequest(`${API_BASE_URL}/estoque/contagem/item/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({
                conferir: conferir
            })
        });
        
        // Enviar log da contagem para a API
        await enviarLogContagem(itemId, estoqueReal, quantidadeDigitada);
        
        // Limpar classes anteriores
        input.classList.remove('conferencia-ok', 'conferencia-divergente', 'conferencia-erro');
        
        // Feedback visual baseado na conferÃªncia
        if (conferir) {
            // Quantidade diferente - precisa conferir
            input.classList.add('conferencia-divergente');
            input.dataset.temDivergencia = 'true';
        } else {
            // Quantidade igual - nÃ£o precisa conferir
            input.classList.add('conferencia-ok');
            input.dataset.temDivergencia = 'false';
        }
        
        updateConcluirButtonState();
        
    } catch (error) {
        throw error;
    }
}

// FunÃ§Ã£o para enviar log da contagem para a API
async function enviarLogContagem(itemId, estoque, contado) {
    try {
        // Somar os valores digitados para locação e sub locação
        let totalContado = 0;
        const inputs = document.querySelectorAll(`.quantidade-input[data-item-id='${itemId}']`);
        inputs.forEach(input => {
            const val = parseInt(input.value);
            if (!isNaN(val)) totalContado += val;
        });

        const logData = {
            contagem_id: currentContagem.id,
            usuario_id: currentUser.id,
            item_id: itemId,
            estoque: estoque,
            contado: totalContado
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
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `contagem_${currentContagem.contagem}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Dados exportados com sucesso!');
}



