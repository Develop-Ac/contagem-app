// Configuração da API
const API_BASE_URL = 'https://intranetbackend.acacessorios.local';

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
const itensTbody = document.getElementById('itens-tbody');
const contagemDetails = document.getElementById('contagem-details');
const backBtn = document.getElementById('back-btn');
const logoutBtn = document.getElementById('logout-btn');
const toast = document.getElementById('toast');

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Verificar se já está logado
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showContagensScreen();
    }

    // Event listeners
    loginForm.addEventListener('submit', handleLogin);
    backBtn.addEventListener('click', () => showContagensScreen());
    logoutBtn.addEventListener('click', handleLogout);
});

// Função para mostrar toast
function showToast(message, actionText = '') {
    const snackbar = toast.MaterialSnackbar;
    const data = {
        message: message,
        timeout: 3000
    };
    if (actionText) {
        data.actionText = actionText;
    }
    snackbar.showSnackbar(data);
}

// Função para fazer requisições HTTP
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

// Função de login
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
        showToast('Erro de conexão. Tente novamente.');
    } finally {
        loginLoading.style.display = 'none';
        submitButton.disabled = false;
    }
}

// Função para logout
function handleLogout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    currentContagem = null;
    
    // Limpar formulário
    loginForm.reset();
    
    // Mostrar tela de login
    showScreen('login-screen');
    
    showToast('Logout realizado com sucesso');
}

// Função para mostrar tela específica
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Função para mostrar tela de contagens
async function showContagensScreen() {
    showScreen('contagens-screen');
    
    // Mostrar nome do usuário
    if (currentUser) {
        userNameSpan.textContent = `Olá, ${currentUser.nome}`;
    }

    // Carregar contagens
    await loadContagens();
}

// Função para carregar contagens
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
        showToast('Erro de conexão ao carregar contagens');
    } finally {
        contagensLoading.style.display = 'none';
    }
}

// Função para renderizar contagens
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
                    <strong>ID:</strong> ${contagem.id}
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

// Função para mostrar tela de itens
async function showItensScreen() {
    if (!currentContagem) return;

    showScreen('itens-screen');
    
    // Mostrar informações da contagem
    contagemDetails.textContent = `Contagem #${currentContagem.contagem} - ${currentContagem.usuario?.nome || 'N/A'}`;

    // Carregar itens
    await loadItens();
}

// Função para carregar itens (simulação, já que os itens vêm na contagem)
async function loadItens() {
    if (!currentContagem || !currentContagem.itens) return;

    itensLoading.style.display = 'flex';
    itensTbody.innerHTML = '';

    // Simular delay para loading
    setTimeout(() => {
        renderItens(currentContagem.itens);
        itensLoading.style.display = 'none';
    }, 500);
}

// Função para renderizar itens na tabela
function renderItens(itens) {
    itensTbody.innerHTML = '';

    if (!itens || itens.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="3" style="text-align: center; padding: 40px; color: #666;">
                <i class="material-icons" style="font-size: 32px; margin-bottom: 8px;">inventory_2</i><br>
                Nenhum item encontrado nesta contagem
            </td>
        `;
        itensTbody.appendChild(row);
        return;
    }

    itens.forEach((item, index) => {
        const row = document.createElement('tr');
        row.style.animationDelay = `${index * 0.05}s`;
        row.style.animation = 'fadeInUp 0.3s ease-out forwards';
        
        row.innerHTML = `
            <td class="mdl-data-table__cell--non-numeric">
                <div class="produto-info">
                    <div class="produto-nome">${item.desc_produto}</div>
                </div>
            </td>
            <td class="mdl-data-table__cell--non-numeric">
                <span class="localizacao-badge">${item.localizacao}</span>
            </td>
            <td class="mdl-data-table__cell--numeric">
                <input 
                    type="number" 
                    class="quantidade-input" 
                    placeholder="Qtd"
                    min="0"
                    step="1"
                    data-item-id="${item.id}"
                    onchange="handleQuantidadeChange(this, '${item.id}')"
                >
            </td>
        `;

        itensTbody.appendChild(row);
    });

    // Upgrade MDL components
    componentHandler.upgradeDom();
}

// Função para lidar com mudança de quantidade
function handleQuantidadeChange(input, itemId) {
    const quantidade = parseInt(input.value);
    
    if (isNaN(quantidade) || quantidade < 0) {
        input.value = '';
        showToast('Quantidade inválida');
        return;
    }

    console.log(`Item ${itemId}: Quantidade alterada para ${quantidade}`);
    
    // Aqui você pode adicionar lógica para salvar a quantidade
    // Por exemplo, fazer uma requisição para API para salvar
    
    // Feedback visual
    input.style.borderColor = '#4caf50';
    setTimeout(() => {
        input.style.borderColor = '#e0e0e0';
    }, 1000);

    showToast(`Quantidade ${quantidade} registrada`);
}

// Função para salvar todas as quantidades (exemplo)
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
    
    // Aqui você implementaria a requisição para salvar no backend
    showToast(`${quantidades.length} quantidades salvas com sucesso!`);
}

// Função para formatar data
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

// Função para filtrar itens (exemplo de funcionalidade extra)
function filtrarItens(texto) {
    const rows = itensTbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const textoRow = row.textContent.toLowerCase();
        const mostrar = textoRow.includes(texto.toLowerCase());
        row.style.display = mostrar ? '' : 'none';
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

// Função para exportar dados (exemplo)
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

// Adicionar botão de salvar na tela de itens
document.addEventListener('DOMContentLoaded', function() {
    const pageHeader = itensScreen.querySelector('.page-header');
    const salvarBtn = document.createElement('button');
    salvarBtn.className = 'mdl-button mdl-js-button mdl-button--raised mdl-button--colored';
    salvarBtn.innerHTML = '<i class="material-icons">save</i> Salvar';
    salvarBtn.onclick = salvarQuantidades;
    salvarBtn.style.marginLeft = 'auto';
    
    pageHeader.appendChild(salvarBtn);
});