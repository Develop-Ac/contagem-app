// Configuração da API
const API_BASE_URL = 'https://intranetbackend.acacessorios.local';

// Estado da aplicação
let currentUser = null;
let currentContagem = null;
let temDivergencias = false;

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
const salvarBtn = document.getElementById('salvar-btn');
const salvarBtnAlt = document.getElementById('salvar-btn-alt');
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
    
    // Debug: verificar se o botão salvar existe
    if (salvarBtn) {
        console.log('✅ Botão salvar encontrado, adicionando event listener');
        console.log('📍 Botão info:', {
            id: salvarBtn.id,
            display: salvarBtn.style.display,
            disabled: salvarBtn.disabled,
            innerHTML: salvarBtn.innerHTML
        });
        
        // Remover qualquer listener anterior
        salvarBtn.removeEventListener('click', handleSalvarContagem);
        
        // Usar onclick diretamente 
        salvarBtn.onclick = function(event) {
            console.log('🖱️ BOTÃO SALVAR CLICADO!!! Event:', event);
            console.log('📍 Estado do botão no click:', {
                display: salvarBtn.style.display,
                disabled: salvarBtn.disabled,
                innerHTML: salvarBtn.innerHTML
            });
            
            event.preventDefault();
            event.stopPropagation();
            
            handleSalvarContagem();
            return false;
        };
        
        // Adicionar também via addEventListener como backup
        salvarBtn.addEventListener('click', (event) => {
            console.log('🖱️ BACKUP EVENT LISTENER ATIVADO!');
        }, true); // useCapture = true
        
        // Adicionar também um listener de mousedown para debug
        salvarBtn.addEventListener('mousedown', () => {
            console.log('🖱️ MOUSEDOWN no botão salvar');
        });
        
    } else {
        console.log('❌ Botão salvar NÃO encontrado!');
    }
});

// Função para mostrar toast
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

// Função para mostrar tela de itens
async function showItensScreen() {
    if (!currentContagem) return;

    showScreen('itens-screen');
    
    // Resetar estados
    temDivergencias = false;
    salvarBtn.style.display = 'none';
    salvarBtn.disabled = false;
    salvarBtn.innerHTML = '<i class="material-icons" style="margin-right: 8px;">save</i>Finalizar Contagem';
    
    // Mostrar informações da contagem
    const itensParaConferir = currentContagem.itens ? currentContagem.itens.filter(item => item.conferir === true) : [];
    const totalItens = currentContagem.itens ? currentContagem.itens.length : 0;
    
    contagemDetails.textContent = `Contagem #${currentContagem.contagem} - ${currentContagem.usuario?.nome || 'N/A'} | ${itensParaConferir.length} de ${totalItens} itens para conferir`;

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
            <td colspan="4" style="text-align: center; padding: 40px; color: #666;">
                <i class="material-icons" style="font-size: 32px; margin-bottom: 8px;">inventory_2</i><br>
                Nenhum item encontrado nesta contagem
            </td>
        `;
        itensTbody.appendChild(row);
        return;
    }

    // Filtrar apenas itens com conferir = true
    let itensParaConferir = itens.filter(item => item.conferir === true);

    // Ordenar por localização de forma crescente e numérica
    itensParaConferir = itensParaConferir.sort((a, b) => {
        // Extrai os números da localização (ex: V702D01 -> 702, V802D01 -> 802)
        const numA = parseInt(a.localizacao.replace(/[^0-9]/g, ''));
        const numB = parseInt(b.localizacao.replace(/[^0-9]/g, ''));
        return numA - numB;
    });

    if (itensParaConferir.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="4" style="text-align: center; padding: 40px; color: #666;">
                <i class="material-icons" style="font-size: 32px; margin-bottom: 8px; color: #4caf50;">check_circle</i><br>
                <h4 style="color: #4caf50; margin: 8px 0;">Todos os itens conferidos!</h4>
                <p>Não há divergências nesta contagem.</p>
            </td>
        `;
        itensTbody.appendChild(row);
        return;
    }

    itensParaConferir.forEach((item, index) => {
        const row = document.createElement('tr');
        row.style.animationDelay = `${index * 0.05}s`;
        row.style.animation = 'fadeInUp 0.3s ease-out forwards';
        
        row.innerHTML = `
            <td class="mdl-data-table__cell--non-numeric">
                <div class="produto-info">
                    <div class="produto-nome">${item.desc_produto}</div>
                </div>
            </td>
            <td class="mdl-data-table__cell--numeric">
                ${item.cod_produto}
            </td>
            <td class="mdl-data-table__cell--non-numeric">
                <span class="localizacao-badge">${item.localizacao}</span>
            </td>
               <td class="mdl-data-table__cell--non-numeric">
                   <span class="aplicacoes-badge">${item.aplicacoes ? item.aplicacoes : ''}</span>
               </td>
            <td class="mdl-data-table__cell--numeric">
                <input 
                    type="number" 
                    class="quantidade-input" 
                    placeholder="Qtd"
                    min="0"
                    step="1"
                    data-item-id="${item.id}"
                    data-cod-produto="${item.cod_produto}"
                    onblur="handleQuantidadeChange(this, '${item.id}', '${item.cod_produto}')"
                >
            </td>
        `;

        itensTbody.appendChild(row);
    });

    // Upgrade MDL components
    componentHandler.upgradeDom();
}

// Função para lidar com mudança de quantidade
async function handleQuantidadeChange(input, itemId, codProduto) {
    const quantidade = parseInt(input.value);
    
    if (isNaN(quantidade) || quantidade < 0) {
        input.value = '';
        showToast('Quantidade inválida');
        return;
    }

    console.log(`Item ${itemId}: Quantidade alterada para ${quantidade}`);
    
    try {
        // Conferir o estoque no sistema
        await conferirEstoque(itemId, codProduto, quantidade, input);
        
        // Focar no próximo input
        focusNextInput(input);
        
    } catch (error) {
        console.error('Erro ao conferir estoque:', error);
        showToast('❌ Erro ao conferir estoque');
        input.classList.remove('conferencia-ok', 'conferencia-divergente');
        input.classList.add('conferencia-erro');
        setTimeout(() => {
            input.classList.remove('conferencia-erro');
        }, 3000);
    }
}

// Função para conferir estoque
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
        
        // Feedback visual baseado na conferência
        if (conferir) {
            // Quantidade diferente - precisa conferir
            input.classList.add('conferencia-divergente');
            input.dataset.temDivergencia = 'true';
            showToast(`⚠️ Divergência! Estoque: ${estoqueReal}, Digitado: ${quantidadeDigitada}`);
        } else {
            // Quantidade igual - não precisa conferir
            input.classList.add('conferencia-ok');
            input.dataset.temDivergencia = 'false';
            showToast(`✓ Conferido: ${quantidadeDigitada}`);
        }
        
        // Verificar se há divergências e mostrar botão de salvar
        verificarDivergenciasEMostrarBotao();
        
        // Resetar classe após alguns segundos
        setTimeout(() => {
            input.classList.remove('conferencia-ok', 'conferencia-divergente');
        }, 3000);
        
    } catch (error) {
        throw error;
    }
}

// Função para enviar log da contagem para a API
async function enviarLogContagem(itemId, estoque, contado) {
    try {
        const logData = {
            contagem_id: currentContagem.id,
            usuario_id: currentUser.id,
            item_id: itemId,
            estoque: estoque,
            contado: contado
        };

        console.log('📤 Enviando log da contagem:', logData);

        const response = await makeRequest(`${API_BASE_URL}/estoque/contagem/log`, {
            method: 'POST',
            body: JSON.stringify(logData)
        });

        console.log('✅ Log enviado com sucesso:', response);

    } catch (error) {
        console.error('❌ Erro ao enviar log da contagem:', error);
        // Não interromper o fluxo principal mesmo se o log falhar
    }
}

// Função para focar no próximo input
function focusNextInput(currentInput) {
    const allInputs = document.querySelectorAll('.quantidade-input');
    const currentIndex = Array.from(allInputs).indexOf(currentInput);
    
    if (currentIndex >= 0 && currentIndex < allInputs.length - 1) {
        const nextInput = allInputs[currentIndex + 1];
        nextInput.focus();
        nextInput.select();
    }
}

// Função para verificar divergências e mostrar botão de salvar
function verificarDivergenciasEMostrarBotao() {
    console.log('🔍 verificarDivergenciasEMostrarBotao chamada');
    
    const totalInputs = document.querySelectorAll('.quantidade-input');
    console.log('📊 Total inputs encontrados:', totalInputs.length);
    
    // Se não há inputs (todos os itens já foram conferidos), não mostrar botão
    if (totalInputs.length === 0) {
        console.log('❌ Nenhum input encontrado, escondendo botão');
        salvarBtn.style.display = 'none';
        temDivergencias = false;
        return;
    }
    
    // Verificar se todos os inputs foram preenchidos
    const todosPreenchidos = Array.from(totalInputs).every(input => 
        input.value && input.value.trim() !== '' && input.dataset.temDivergencia !== undefined
    );
    
    console.log('✅ Todos inputs preenchidos:', todosPreenchidos);
    
    if (todosPreenchidos) {
        // Verificar se há pelo menos uma divergência real
        const inputsComDivergencia = document.querySelectorAll('.quantidade-input[data-tem-divergencia="true"]');
        
        console.log('⚠️ Inputs com divergência encontrados:', inputsComDivergencia.length);
        
        if (inputsComDivergencia.length > 0) {
            temDivergencias = true;
            salvarBtn.style.display = 'inline-block';
            // salvarBtnAlt sempre visível - não controlar aqui
            console.log(`✅ ${inputsComDivergencia.length} divergências encontradas, MOSTRANDO botão de salvar`);
            
            // Debug adicional do botão
            setTimeout(() => {
                console.log('🔍 Verificação do botão após mostrar:', {
                    elemento: salvarBtn,
                    display: salvarBtn.style.display,
                    visible: salvarBtn.offsetWidth > 0 && salvarBtn.offsetHeight > 0,
                    disabled: salvarBtn.disabled,
                    innerHTML: salvarBtn.innerHTML,
                    rect: salvarBtn.getBoundingClientRect()
                });
            }, 100);
        } else {
            temDivergencias = false;
            salvarBtn.style.display = 'none';
            // salvarBtnAlt sempre visível - não esconder
            console.log('❌ Nenhuma divergência encontrada, ESCONDENDO botão de salvar');
        }
    } else {
        salvarBtn.style.display = 'none';
        // salvarBtnAlt sempre visível - não esconder
        temDivergencias = false;
        console.log('❌ Nem todos os inputs foram preenchidos, escondendo botão');
    }
    
    console.log('🎯 Estado final: temDivergencias =', temDivergencias, ', botão display =', salvarBtn.style.display);
    
    // Função de teste - você pode chamar no console: testarBotaoSalvar()
    window.testarBotaoSalvar = function() {
        console.log('🧪 Testando click programático do botão salvar...');
        if (salvarBtn) {
            salvarBtn.click();
        } else {
            console.log('❌ Botão não encontrado para teste');
        }
    };
    
    // Função para forçar execução direta
    window.forceSalvar = function() {
        console.log('💪 FORÇANDO EXECUÇÃO DIRETA DA FUNÇÃO SALVAR');
        handleSalvarContagem();
    };
    
    // Teste automático removido conforme solicitado
}

// Função para salvar contagem (enviar para liberação)
window.handleSalvarContagem = async function handleSalvarContagem() {
    console.log('🔄 handleSalvarContagem iniciada');
    
    if (!currentContagem) {
        console.log('❌ currentContagem não encontrada');
        showToast('Erro: contagem não encontrada');
        return;
    }
    
    console.log('✅ currentContagem encontrada:', currentContagem);

    // Verificar se algum input teve divergência
    const inputsComDivergencia = document.querySelectorAll('.quantidade-input[data-tem-divergencia="true"]');
    const todosInputs = document.querySelectorAll('.quantidade-input');
    
    console.log('📊 Total de inputs:', todosInputs.length);
    console.log('⚠️ Inputs com divergência:', inputsComDivergencia.length);
    
    // Debug: listar todos os inputs e seus valores
    todosInputs.forEach((input, index) => {
        console.log(`Input ${index}:`, {
            value: input.value,
            temDivergencia: input.dataset.temDivergencia,
            itemId: input.dataset.itemId,
            codProduto: input.dataset.codProduto
        });
    });
    
    if (inputsComDivergencia.length === 0) {
        console.log('❌ Nenhuma divergência encontrada, saindo da função');
        showToast('Nenhuma divergência encontrada para salvar');
        return;
    }
    
    console.log('✅ Divergências encontradas, continuando...');

    // Desabilitar botão durante o envio
    salvarBtn.disabled = true;
    salvarBtn.innerHTML = '<i class="material-icons">hourglass_empty</i> Salvando...';

    try {
        // Preparar o body que será enviado
        const bodyData = {
            contagem_cuid: currentContagem.contagem_cuid,
            contagem: currentContagem.contagem
        };
        
        const bodyJson = JSON.stringify(bodyData);
        
        // Log no console
        console.log('Enviando PUT para liberar contagem:', bodyData);
        console.log('Body JSON:', bodyJson);
        
        // Mostrar na tela para o usuário
        showToast(`📤 Enviando: contagem_cuid: ${bodyData.contagem_cuid}, contagem: ${bodyData.contagem}`, '', 5000);
        
        // Alert detalhado (opcional - pode comentar se não quiser)
        alert(`🔄 ENVIANDO PUT:\n\nURL: ${API_BASE_URL}/estoque/contagem/liberar\n\nBody:\n${bodyJson}`);

        const response = await makeRequest(`${API_BASE_URL}/estoque/contagem/liberar`, {
            method: 'PUT',
            body: bodyJson
        });

        console.log('Resposta do servidor:', response);

        if (response) {
            showToast('✅ Contagem finalizada com sucesso!');
            setTimeout(() => {
                showContagensScreen();
            }, 1500);
        } else {
            throw new Error('Resposta inválida do servidor');
        }

    } catch (error) {
        console.error('Erro ao salvar contagem:', error);
        showToast('❌ Erro ao finalizar contagem');
        
        // Restaurar botão
        salvarBtn.disabled = false;
        salvarBtn.innerHTML = '<i class="material-icons" style="margin-right: 8px;">save</i>Finalizar Contagem';
    }
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