/* =====================================================
   LOGIN / CADASTRO - Lógica do modal
   Sistema BiblioBeta
   ===================================================== */
(function () {

  // ---------- Conexão com a API ----------
  // Endereço do backend (server.js). Ajuste aqui se o backend rodar em outra porta/host.
  const API_URL = window.BiblioBetaAPI?.base || '/api';

  // ---------- Configuração de cada tipo de usuário ----------
  // "campos" agora fica organizado em 3 etapas (steps), cada uma com seu
  // próprio título curto. O cadastro mostra uma etapa por vez.
  const CONFIGS = {
    aluno: {
      titulo: 'Cadastro de Aluno',
      descricao: 'Crie sua conta para utilizar todos os serviços da Biblioteca Escolar.',
      botao: 'Cadastrar Aluno',
      steps: [
        {
          titulo: 'Dados pessoais',
          campos: [
            { id: 'nome', label: 'Nome completo', type: 'text', validacao: 'nome' }
          ]
        },
        {
          titulo: 'Informações escolares',
          campos: [
            { id: 'ra', label: 'RA (9, 12 ou 13 dígitos)', type: 'text', validacao: 'ra', inputmode: 'numeric', pattern: '\\d{9}|\\d{12}|\\d{13}', maxlength: 13, autocomplete: 'off' },
            { id: 'ra_digito', label: 'Dígito', type: 'text', validacao: 'raDigito', inputmode: 'text', pattern: '[0-9A-Za-z]', maxlength: 1, autocomplete: 'off' },
            { id: 'etapa', label: 'Etapa de ensino', type: 'select', validacao: 'obrigatorio', opcoes: [
              { value: 'fundamental', label: 'Ensino Fundamental' },
              { value: 'medio', label: 'Ensino Médio' }
            ] },
            { id: 'serie', label: 'Ano', type: 'select', validacao: 'obrigatorio', opcoes: [] },
            { id: 'turma', label: 'Turma', type: 'select', validacao: 'obrigatorio', opcoes: [
              { value: 'A', label: 'Turma A' },
              { value: 'B', label: 'Turma B' },
              { value: 'C', label: 'Turma C' },
              { value: 'D', label: 'Turma D' },
              { value: 'E', label: 'Turma E' },
              { value: 'F', label: 'Turma F' },
              { value: 'G', label: 'Turma G' },
              { value: 'H', label: 'Turma H' },
              { value: 'I', label: 'Turma I' },
              { value: 'J', label: 'Turma J' }
            ] }
          ]
        },
        {
          titulo: 'Contato e senha',
          campos: [
            { id: 'email', label: 'E-mail', type: 'email', validacao: 'email' },
            { id: 'senha', label: 'Senha', type: 'password', validacao: 'senha' },
            { id: 'confirmar_senha', label: 'Confirmar senha', type: 'password', validacao: 'confirmarSenha' }
          ]
        }
      ]
    },
    professor: {
      titulo: 'Cadastro de Professor',
      descricao: 'Cadastre-se para acessar o sistema da biblioteca.',
      botao: 'Cadastrar Professor',
      steps: [
        {
          titulo: 'Dados pessoais',
          campos: [
            { id: 'nome', label: 'Nome completo', type: 'text', validacao: 'nome' }
          ]
        },
        {
          titulo: 'Contato',
          campos: [
            { id: 'email', label: 'Gmail pessoal', type: 'email', validacao: 'email' },
            { id: 'email_institucional', label: 'E-mail institucional (opcional)', type: 'email', validacao: 'emailInstitucional' }
          ]
        },
        {
          titulo: 'Senha',
          campos: [
            { id: 'senha', label: 'Senha', type: 'password', validacao: 'senha' },
            { id: 'confirmar_senha', label: 'Confirmar senha', type: 'password', validacao: 'confirmarSenha' }
          ]
        }
      ]
    },
    gestao: {
      titulo: 'Cadastro da Gestão',
      descricao: 'Cadastre-se para administrar o Sistema da Biblioteca.',
      botao: 'Cadastrar Gestão',
      steps: [
        {
          titulo: 'Dados pessoais',
          campos: [
            { id: 'nome', label: 'Nome completo', type: 'text', validacao: 'nome' }
          ]
        },
        {
          titulo: 'Contato',
          campos: [
            { id: 'email', label: 'E-mail', type: 'email', validacao: 'email' }
          ]
        },
        {
          titulo: 'Senha',
          campos: [
            { id: 'senha', label: 'Senha', type: 'password', validacao: 'senha' },
            { id: 'confirmar_senha', label: 'Confirmar senha', type: 'password', validacao: 'confirmarSenha' }
          ]
        }
      ]
    }
  };

  // ---------- Painel de destino de cada tipo de usuário ----------
  // Aluno e Professor usam o mesmo painel (o menu lateral e as telas
  // são idênticos); só o conteúdo muda conforme quem está logado.
  const PAINEIS = {
    aluno: 'painel.html',
    professor: 'painel.html',
    gestao: 'gestao.html'
  };

  // ---------- Elementos ----------
  const overlay = document.getElementById('loginOverlay');
  const container = document.getElementById('loginContainer');
  const closeBtn = document.getElementById('loginClose');

  const cadastroForm = document.getElementById('cadastroForm');
  const cadastroTitulo = document.getElementById('cadastroTitulo');
  const cadastroDescricao = document.getElementById('cadastroDescricao');
  const cadastroCampos = document.getElementById('cadastroCampos');
  const cadastroBotao = document.getElementById('cadastroBotao');

  const entrarForm = document.getElementById('entrarForm');
  const entrarSide = entrarForm.closest('.login-form-side');
  const cadastroSide = cadastroForm.closest('.login-form-side');
  const loginEmail = document.getElementById('loginEmail');
  if (loginEmail) {
    // No login, o campo é para E-MAIL. Não limitar a 13 caracteres:
    // a regra de 9/12/13 dígitos pertence somente ao campo RA do cadastro.
    loginEmail.removeAttribute('maxlength');
    loginEmail.maxLength = 254;
    loginEmail.setAttribute('inputmode', 'email');
    loginEmail.setAttribute('type', 'email');
  }
  const loginSenha = document.getElementById('loginSenha');
  const erroLoginEmail = document.getElementById('erroLoginEmail');
  const erroLoginSenha = document.getElementById('erroLoginSenha');
  const esqueciSenha = document.getElementById('esqueciSenha');

  const btnIrParaCadastro = document.getElementById('btnIrParaCadastro');
  const btnIrParaLogin = document.getElementById('btnIrParaLogin');

  const roleSwitch = document.getElementById('loginRoleSwitch');
  const rolePills = roleSwitch ? Array.from(roleSwitch.querySelectorAll('.role-pill')) : [];

  const cadastroVoltarBtn = document.getElementById('cadastroVoltarBtn');
  const cadastroStepLabel = document.getElementById('cadastroStepLabel');
  const cadastroStepDots = [
    document.getElementById('cadastroStep1'),
    document.getElementById('cadastroStep2'),
    document.getElementById('cadastroStep3')
  ];

  let tipoAtual = 'aluno';
  let contextoAtual = 'padrao'; // 'padrao' (card Alunos e Professores: pills Aluno/Professor), 'gestao' (card Gestão: sem seletor) ou 'geral' (menu "Entrar": Aluno/Professor/Gestão)
  const loginDescricao = document.getElementById('loginDescricao');
  const TEXTOS_LOGIN = {
    padrao: 'Acesse sua conta do BiblioBeta (Aluno ou Professor).',
    gestao: 'Acesse sua conta de Gestão do BiblioBeta.',
    geral: 'Acesse sua conta do BiblioBeta (Aluno, Professor ou Gestão).'
  };
  // Ajusta texto do login e mostra/esconde a aba Gestão conforme de onde o modal foi aberto.
  function aplicarContextoVisual() {
    if (loginDescricao) loginDescricao.textContent = TEXTOS_LOGIN[contextoAtual] || TEXTOS_LOGIN.geral;
    rolePills.forEach(function (pill) {
      if (pill.dataset.role === 'gestao') pill.hidden = (contextoAtual === 'padrao');
    });
  }
  let etapaAtual = 0; // índice da etapa de cadastro visível (0-based)

  // ---------- Validações ----------
  function validarEmail(v) {
    const email = v.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    if (tipoAtual === 'aluno') return /^([0-9a-z]+)sp@(aluno|al)\.educacao\.sp\.gov\.br$/i.test(email);
    if (tipoAtual === 'professor') return emailGmailPessoal(email) || emailInstitucionalProf(email);
    return true;
  }
  // Gmail pessoal: qualquer @gmail.com (com ou sem ponto). Institucional: @prof.educacao.sp.gov.br.
  function emailGmailPessoal(e) { return /^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?@(?:gmail|googlemail)\.com$/i.test(String(e || '').trim()); }
  function emailInstitucionalProf(e) { return /^[^\s@]+@(?:prof\.|professor\.)?educacao\.sp\.gov\.br$/i.test(String(e || '').trim()); }
  // 2º e-mail do professor: pode ficar vazio; se preenchido, precisa ser válido e diferente do primeiro.
  function validarEmailInstitucional(v) {
    const e = String(v || '').trim().toLowerCase();
    if (!e) return true;
    if (!(emailGmailPessoal(e) || emailInstitucionalProf(e))) return false;
    const principal = document.getElementById('cad_email');
    return !(principal && principal.value.trim().toLowerCase() === e);
  }
  function validarTelefone(v) {
    const digitos = v.replace(/\D/g, '');
    return digitos.length >= 10 && digitos.length <= 11;
  }
  function validarRA(v) {
    const d = String(v || '').replace(/\D/g, '');
    return [9, 12, 13].includes(d.length);
  }
  function validarRADigito(v) {
    return /^[0-9A-Za-z]$/.test(String(v || '').trim());
  }
  function validarSenha(v) {
    // Política: mínimo 8 caracteres, com maiúscula, minúscula, número e símbolo.
    return v.length >= 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v);
  }
  function validarConfirmarSenha(v) {
    const senha = document.getElementById('cad_senha');
    return !!senha && v === senha.value && v.length > 0;
  }
  function validarNome(v) {
    return v.trim().length >= 3 && v.trim().includes(' ');
  }
  function validarObrigatorio(v) {
    return v.trim().length > 0;
  }

  function mensagemEmail() {
    if (tipoAtual === 'aluno') return 'Use somente o e-mail institucional: RA+dígito+sp@al.educacao.sp.gov.br.';
    if (tipoAtual === 'professor') return 'Use um Gmail (nome@gmail.com) ou o e-mail @prof.educacao.sp.gov.br.';
    return 'Informe um e-mail válido.';
  }

  const VALIDADORES = {
    email: { fn: validarEmail, get msg() { return mensagemEmail(); } },
    emailInstitucional: { fn: validarEmailInstitucional, msg: 'Informe um e-mail institucional (@prof.educacao.sp.gov.br) ou Gmail diferente do primeiro, ou deixe em branco.' },
    telefone: { fn: validarTelefone, msg: 'Informe um telefone válido (DDD + número).' },
    ra: { fn: validarRA, msg: 'Informe o RA somente com números. Você pode usar ou omitir zeros à esquerda.' },
    raDigito: { fn: validarRADigito, msg: 'Informe o dígito do RA com apenas 1 caractere (número ou letra).' },
    senha: { fn: validarSenha, msg: 'Use 8+ caracteres, com maiúscula, minúscula, número e símbolo.' },
    confirmarSenha: { fn: validarConfirmarSenha, msg: 'As senhas não coincidem.' },
    nome: { fn: validarNome, msg: 'Informe o nome completo.' },
    obrigatorio: { fn: validarObrigatorio, msg: 'Este campo é obrigatório.' }
  };

  // ---------- Renderização dos campos de cadastro ----------
  function criarBotaoOlho(targetId) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'login-eye';
    btn.setAttribute('aria-label', 'Mostrar senha');
    btn.dataset.target = targetId;
    btn.innerHTML =
      '<svg class="icon-olho-aberto" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>' +
      '<svg class="icon-olho-fechado" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/>' +
      '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    return btn;
  }

  // Monta um grupo (div.cadastro-step-group) por etapa do config atual.
  // Todos os campos de todas as etapas ficam no DOM (só o grupo da etapa
  // ativa fica visível), então a validação final do envio continua vendo
  // todos os inputs, exatamente como antes.
  // Monta o wrapper (.login-field) de um único campo: input/select,
  // validações específicas (RA, senha, etc.) e o span de erro.
  // Extraído do loop de renderEtapas() para poder ser reaproveitado
  // quando dois campos precisam ficar lado a lado (ex.: RA + Dígito).
  // Impede o navegador de oferecer/preencher e-mails e senhas salvos (login e cadastro):
  // nome único por carregamento, autocomplete desligado (new-password nos campos de senha,
  // que também esconde a lista de "Senhas salvas") e somente-leitura até o primeiro toque.
  const SUPORTA_MASCARA_CSS = !!(window.CSS && CSS.supports && (CSS.supports('-webkit-text-security', 'disc') || CSS.supports('text-security', 'disc')));
  function blindarAutofill(input, ehSenha) {
    if (!input || input.dataset.semAutofill) return;
    input.dataset.semAutofill = '1';
    // valor inválido de propósito: o Edge/Chrome ignoram "off" e respeitam tokens desconhecidos
    input.setAttribute('autocomplete', 'nope-' + Math.random().toString(36).slice(2, 6));
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('data-lpignore', 'true');
    input.setAttribute('data-1p-ignore', 'true');
    input.setAttribute('data-form-type', 'other');
    input.spellcheck = false;
    // Edge/Chrome ignoram autocomplete="off" em type=password/email e mostram "Senhas salvas".
    // Solução: campo de texto comum; a senha é mascarada via CSS (-webkit-text-security).
    if (ehSenha && SUPORTA_MASCARA_CSS) {
      input.type = 'text';
      input.classList.add('senha-oculta');
      input.dataset.oculta = '1';
    } else if (input.type === 'email') {
      input.type = 'text';
      input.inputMode = 'email';
    }
    input.name = 'bb_' + (input.id || 'campo') + '_' + Math.random().toString(36).slice(2, 8);
    input.readOnly = true;
    const liberar = function () { input.readOnly = false; };
    input.addEventListener('focus', liberar, { once: true });
    input.addEventListener('pointerdown', liberar, { once: true });
  }
  window.__bibliobetaBlindarAutofill = blindarAutofill;

  function criarCampoWrapper(campo) {
    const wrapper = document.createElement('div');
    wrapper.className = 'login-field';

    const input = campo.type === 'select' ? document.createElement('select') : document.createElement('input');
    input.type = campo.type === 'select' ? 'select-one' : campo.type;
    input.id = 'cad_' + campo.id;
    input.dataset.validacao = campo.validacao;
    if (campo.type !== 'select') blindarAutofill(input, campo.type === 'password');

    if (campo.type === 'select') {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = campo.label;
      placeholder.disabled = true;
      placeholder.selected = true;
      input.appendChild(placeholder);
      (campo.opcoes || []).forEach(function (opcao) {
        const option = document.createElement('option');
        option.value = opcao.value;
        option.textContent = opcao.label;
        input.appendChild(option);
      });
    } else {
      input.placeholder = campo.label;
    }

    // RA: aceita somente dígitos, preserva zeros à esquerda e impede
    // hífen, letras e espaços tanto na digitação quanto na colagem.
    // Formatos permitidos: exatamente 9, 12 ou 13 dígitos.
    if (campo.id === 'ra' || campo.id === 'ra_digito') {
      const limite = campo.id === 'ra' ? 13 : 1;
      // RA: só números. Dígito: 1 caractere, número OU letra (sempre maiúscula).
      input.inputMode = campo.id === 'ra' ? 'numeric' : 'text';
      input.pattern = campo.id === 'ra' ? '\\d{9}|\\d{12}|\\d{13}' : '[0-9A-Za-z]';
      input.maxLength = limite;
      input.autocomplete = 'off';
      if (campo.id === 'ra_digito') input.style.textTransform = 'uppercase';
      const somenteNumeros = function () {
        this.value = campo.id === 'ra'
          ? this.value.replace(/\D/g, '').slice(0, limite)
          : this.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase().slice(0, limite);
      };
      input.addEventListener('input', somenteNumeros);
      input.addEventListener('paste', function () {
        setTimeout(somenteNumeros.bind(this), 0);
      });
    }

    if (campo.type === 'date') {
      input.setAttribute('aria-label', campo.label);
    }

    const erro = document.createElement('span');
    erro.className = 'login-error';
    erro.id = 'erro_cad_' + campo.id;

    if (campo.type === 'password') {
      const passWrap = document.createElement('div');
      passWrap.className = 'login-password-wrap';
      passWrap.appendChild(input);
      passWrap.appendChild(criarBotaoOlho(input.id));
      wrapper.appendChild(passWrap);
    } else {
      wrapper.appendChild(input);
    }

    // Explica a política de senha diretamente no cadastro.
    if (campo.id === 'senha') {
      const politica = document.createElement('small');
      politica.className = 'senha-politica';
      politica.textContent = 'Política de senha: mínimo 8 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.';
      wrapper.appendChild(politica);
    }

    wrapper.appendChild(erro);
    return wrapper;
  }

  function renderEtapas(config) {
    cadastroCampos.innerHTML = '';
    config.steps.forEach(function (step, indice) {
      const grupo = document.createElement('div');
      grupo.className = 'cadastro-step-group';
      grupo.dataset.stepIndex = String(indice);

      step.campos.forEach(function (campo) {
        // O dígito do RA já é renderizado junto com o RA (mesma linha),
        // então pula aqui pra não duplicar o campo.
        if (campo.id === 'ra_digito') return;

        // RA e Dígito ficam lado a lado numa única linha, igual ao
        // padrão de outros sistemas escolares — reduz a altura do painel.
        if (campo.id === 'ra') {
          const raDigito = step.campos.find(function (c) { return c.id === 'ra_digito'; });
          const linha = document.createElement('div');
          linha.className = 'cadastro-ra-row';
          linha.appendChild(criarCampoWrapper(campo));
          if (raDigito) linha.appendChild(criarCampoWrapper(raDigito));
          grupo.appendChild(linha);
          return;
        }

        grupo.appendChild(criarCampoWrapper(campo));
      });

      cadastroCampos.appendChild(grupo);
    });
  }

  function atualizarAnosPorEtapa() {
    const etapa = document.getElementById('cad_etapa');
    const ano = document.getElementById('cad_serie');
    if (!etapa || !ano) return;
    const atual = ano.value;
    const anos = etapa.value === 'fundamental'
      ? [1,2,3,4,5,6,7,8,9]
      : etapa.value === 'medio'
        ? [1,2,3]
        : [];
    ano.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecione o ano';
    placeholder.disabled = true;
    placeholder.selected = true;
    ano.appendChild(placeholder);
    anos.forEach(function(n) {
      const option = document.createElement('option');
      option.value = String(n);
      option.textContent = n + 'º ano';
      ano.appendChild(option);
    });
    if (anos.includes(Number(atual))) ano.value = atual;
  }

  // Mostra a etapa "indice" e atualiza stepper, botões e foco.
  function irParaEtapa(config, indice) {
    etapaAtual = indice;
    const totalEtapas = config.steps.length;
    const ehUltima = indice === totalEtapas - 1;

    cadastroCampos.querySelectorAll('.cadastro-step-group').forEach(function (grupo) {
      grupo.classList.toggle('active', Number(grupo.dataset.stepIndex) === indice);
    });

    cadastroStepDots.forEach(function (dot, i) {
      if (!dot) return;
      dot.classList.toggle('filled', i < indice);
      dot.classList.toggle('current', i === indice);
    });

    if (cadastroStepLabel) {
      cadastroStepLabel.textContent =
        'Etapa ' + (indice + 1) + ' de ' + totalEtapas + ' · ' + config.steps[indice].titulo;
    }

    // O botão sempre fica type="submit" (assim Enter funciona em qualquer
    // etapa); o texto muda e o próprio handler de submit decide se deve
    // só avançar a etapa ou enviar o cadastro de verdade (ver mais abaixo).
    if (cadastroBotao) {
      cadastroBotao.textContent = ehUltima ? config.botao : 'Continuar';
    }

    if (cadastroVoltarBtn) {
      cadastroVoltarBtn.hidden = false; // sempre visível: na etapa 1 volta pro login
    }

    sincronizarAlturaModal();

    // Leva o foco pro primeiro campo da etapa (ajuda teclado/leitor de tela)
    const primeiroInput = cadastroCampos.querySelector(
      '.cadastro-step-group[data-step-index="' + indice + '"] input, .cadastro-step-group[data-step-index="' + indice + '"] select'
    );
    if (primeiroInput) primeiroInput.focus({ preventScroll: true });
  }

  // Valida só os campos da etapa visível no momento.
  function validarEtapaAtual() {
    let tudoValido = true;
    const grupoAtivo = cadastroCampos.querySelector('.cadastro-step-group.active');
    if (!grupoAtivo) return true;
    grupoAtivo.querySelectorAll('input, select').forEach(function (input) {
      const erroEl = document.getElementById('erro_' + input.id);
      const valido = validarCampo(input, erroEl);
      if (!valido) tudoValido = false;
    });
    return tudoValido;
  }

  function validarCampo(input, erroEl) {
    const tipoValidacao = input.dataset.validacao;
    const validador = VALIDADORES[tipoValidacao];
    if (!validador) return true;

    const valido = validador.fn(input.value || '');
    if (!valido) {
      input.classList.add('invalid');
      erroEl.textContent = validador.msg;
    } else {
      input.classList.remove('invalid');
      erroEl.textContent = '';
    }
    return valido;
  }

  function validarCadastro() {
    let tudoValido = true;
    cadastroCampos.querySelectorAll('input, select').forEach(function (input) {
      const erroEl = document.getElementById('erro_' + input.id);
      const valido = validarCampo(input, erroEl);
      if (!valido) tudoValido = false;
    });
    return tudoValido;
  }

  function normalizarIdentificadorLogin(v) {
    const valor = String(v || '').trim();
    if (/^\d+$/.test(valor)) return valor.replace(/^0+(?=\d)/, '');
    return valor.toLowerCase();
  }

  function validarLogin() {
    const identificador = (loginEmail.value || '').trim();
    const emailOk = validarEmail(identificador);
    const identificadorOk = emailOk;
    if (!identificadorOk) {
      loginEmail.classList.add('invalid');
      erroLoginEmail.textContent = 'Informe um e-mail válido.';
    } else {
      loginEmail.classList.remove('invalid');
      erroLoginEmail.textContent = '';
    }
    const senhaValida = (loginSenha.value || '').length > 0;
    if (!senhaValida) {
      loginSenha.classList.add('invalid');
      erroLoginSenha.textContent = 'Informe sua senha.';
    } else {
      loginSenha.classList.remove('invalid');
      erroLoginSenha.textContent = '';
    }
    return identificadorOk && senhaValida;
  }

  // ---------- Iguala a altura do painel de Entrar e do de Cadastro ----------
  // Sem isso, o card muda de tamanho ao alternar entre login e cadastro,
  // porque cada formulário tem uma quantidade diferente de campos.
  function sincronizarAlturaModal() {
    // Na versão mobile (empilhada) cada card já usa altura natural própria
    // e alternar não deve ficar "travado" numa altura fixa; então só
    // igualamos as alturas no layout lado a lado (desktop/tablet).
    if (window.matchMedia('(max-width: 720px)').matches) {
      container.style.minHeight = '';
      return;
    }
    const alturaEntrar = entrarSide.scrollHeight;
    const alturaCadastro = cadastroSide.scrollHeight;
    const maior = Math.max(alturaEntrar, alturaCadastro);
    if (maior > 0) {
      container.style.minHeight = maior + 'px';
    }
  }

  window.addEventListener('resize', function () {
    if (overlay.classList.contains('show')) sincronizarAlturaModal();
  });

  // Aplica o conteúdo de um perfil (título, descrição, campos, pill ativa)
  // sem decidir se o modal deve resetar para a tela de Entrar ou não —
  // isso é decidido por quem chama (abrirLogin vs. trocarPerfil).
  // OBS: o botão "Entrar" nunca muda de texto — o login é sempre genérico,
  // porque o backend já identifica o tipo de conta pelo e-mail/senha.
  function aplicarPerfil(tipoUsuario) {
    const config = CONFIGS[tipoUsuario] || CONFIGS.aluno;
    tipoAtual = CONFIGS[tipoUsuario] ? tipoUsuario : 'aluno';

    cadastroTitulo.textContent = config.titulo;
    cadastroDescricao.textContent = config.descricao;
    renderEtapas(config);
    const etapaSelect = document.getElementById('cad_etapa');
    if (etapaSelect) etapaSelect.addEventListener('change', atualizarAnosPorEtapa);
    atualizarAnosPorEtapa();
    irParaEtapa(config, 0);

    if (cadastroSide) {
      cadastroSide.classList.toggle('cadastro-sem-seletor', contextoAtual === 'gestao');
    }

    rolePills.forEach(function (pill) {
      const ativo = pill.dataset.role === tipoAtual;
      pill.classList.toggle('active', ativo);
      pill.setAttribute('aria-selected', ativo ? 'true' : 'false');
    });

    return config;
  }

  // ---------- Abrir modal do zero (chamado pelos cartões "Acessar" e pelo menu) ----------
  // A Gestão é um acesso isolado: abrir com tipoUsuario === 'gestao' esconde
  // o seletor de perfil por completo (não dá pra trocar pra Aluno/Professor
  // nem vice-versa a partir daqui).
  function abrirLogin(tipoUsuario) {
    // Sem argumento (menu "Entrar") = contexto geral, com as 3 abas no cadastro.
    contextoAtual = (tipoUsuario === 'gestao') ? 'gestao' : (tipoUsuario ? 'padrao' : 'geral');
    if (roleSwitch) roleSwitch.hidden = (contextoAtual === 'gestao');
    aplicarContextoVisual();

    aplicarPerfil(tipoUsuario);
    limparFormularios();
    container.classList.remove('active');

    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
    sincronizarAlturaModal();
  }

  // ---------- Trocar de perfil com o modal já aberto (pills Aluno/Professor) ----------
  // Só existe no contexto "padrao"; a Gestão nem mostra o seletor.
  // Reinicia o cadastro na Etapa 1 do novo perfil, mas preserva se o usuário
  // estava na tela de Entrar ou na de Cadastro.
  function trocarPerfil(tipoUsuario) {
    if (contextoAtual === 'gestao' || tipoUsuario === tipoAtual) return;
    if (contextoAtual === 'padrao' && tipoUsuario === 'gestao') return;
    aplicarPerfil(tipoUsuario);
    limparFormularios();
    sincronizarAlturaModal();
  }

  function fecharLogin() {
    overlay.classList.remove('show');
    document.body.style.overflow = '';
    limparFormularios();
    container.classList.remove('active');
    container.style.minHeight = '';
  }

  function limparFormularios() {
    if (entrarForm) entrarForm.reset();
    if (cadastroForm) cadastroForm.reset();
    document.querySelectorAll('.login-overlay .login-error').forEach(function (el) {
      el.textContent = '';
    });
    document.querySelectorAll('.login-overlay input').forEach(function (el) {
      el.classList.remove('invalid');
    });
  }

  // Expor globalmente para os botões "Acessar" dos cartões
  window.abrirLogin = abrirLogin;

  // ---------- Eventos ----------
  closeBtn.addEventListener('click', fecharLogin);

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) fecharLogin();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('show')) {
      if (recuperacaoOverlay && !recuperacaoOverlay.hidden) {
        fecharRecuperacao();
        return;
      }
      fecharLogin();
    }
  });

  btnIrParaCadastro.addEventListener('click', function () {
    container.classList.add('active');
    irParaEtapa(CONFIGS[tipoAtual], 0); // sempre começa a Etapa 1
    sincronizarAlturaModal();
  });

  btnIrParaLogin.addEventListener('click', function () {
    container.classList.remove('active');
    sincronizarAlturaModal();
  });

  // ---------- Seletor de perfil (Aluno / Professor / Gestão) ----------
  // A aba "Gestão" aparece no cadastro aberto pelo menu "Entrar" (contexto 'padrao').
  if (roleSwitch) {
    roleSwitch.addEventListener('click', function (e) {
      const btn = e.target.closest('.role-pill');
      if (!btn) return;
      trocarPerfil(btn.dataset.role);
    });
  }

  // ---------- Botão "Voltar" dentro do cadastro ----------
  // Na Etapa 1, volta para a tela de Entrar. Da Etapa 2 em diante, volta
  // uma etapa do próprio cadastro.
  if (cadastroVoltarBtn) {
    cadastroVoltarBtn.addEventListener('click', function () {
      const config = CONFIGS[tipoAtual];
      if (etapaAtual > 0) {
        irParaEtapa(config, etapaAtual - 1);
      } else {
        container.classList.remove('active');
        sincronizarAlturaModal();
      }
    });
  }

  // ---------- Recuperação de senha própria do BiblioBeta ----------
  const recuperacaoOverlay = document.getElementById('recuperacaoOverlay');
  const recuperacaoClose = document.getElementById('recuperacaoClose');
  const recuperacaoDescricao = document.getElementById('recuperacaoDescricao');
  const recuperacaoIdentificador = document.getElementById('recuperacaoIdentificador');
  const recuperacaoNome = document.getElementById('recuperacaoNome');
  const recuperacaoContinuar = document.getElementById('recuperacaoContinuar');
  const recuperacaoCodigo = document.getElementById('recuperacaoCodigo');
  const recuperacaoCodigoInput = document.getElementById('recuperacaoCodigoInput');
  const recuperacaoValidarCodigo = document.getElementById('recuperacaoValidarCodigo');
  const recuperacaoNovaSenha = document.getElementById('recuperacaoNovaSenha');
  const recuperacaoConfirmarSenha = document.getElementById('recuperacaoConfirmarSenha');
  const recuperacaoSalvarSenha = document.getElementById('recuperacaoSalvarSenha');
  const recuperacaoCopiar = document.getElementById('recuperacaoCopiar');
  const recuperacaoConcluir = document.getElementById('recuperacaoConcluir');

  let recuperacaoDados = { identificador: '', codigo: '' };

  function setErroRecuperacao(id, mensagem) {
    const el = document.getElementById(id);
    if (el) el.textContent = mensagem || '';
  }

  function limparErrosRecuperacao() {
    document.querySelectorAll('#recuperacaoOverlay .login-error').forEach(el => el.textContent = '');
    document.querySelectorAll('#recuperacaoOverlay input').forEach(el => el.classList.remove('invalid'));
  }

  function mostrarEtapaRecuperacao(indice) {
    if (!recuperacaoOverlay) return;
    recuperacaoOverlay.querySelectorAll('.recuperacao-step').forEach(step => {
      const ativa = Number(step.dataset.recuperacaoStep) === indice;
      step.hidden = !ativa;
      step.classList.toggle('active', ativa);
    });
    const textos = {
      1: 'Confirme seus dados para gerar um código de recuperação.',
      2: 'O código foi enviado para o e-mail cadastrado. Digite os 6 números para continuar.',
      3: 'Digite e confirme sua nova senha.',
      4: 'Tudo certo. Sua senha foi alterada com sucesso.'
    };
    if (recuperacaoDescricao) recuperacaoDescricao.textContent = textos[indice] || '';
  }

  function abrirRecuperacao() {
    limparErrosRecuperacao();
    recuperacaoDados = { identificador: '', codigo: '' };
    recuperacaoIdentificador.value = '';
    recuperacaoNome.value = '';
    recuperacaoCodigoInput.value = '';
    recuperacaoNovaSenha.value = '';
    recuperacaoConfirmarSenha.value = '';
    mostrarEtapaRecuperacao(1);
    recuperacaoOverlay.hidden = false;
    setTimeout(() => recuperacaoIdentificador.focus(), 30);
  }

  function fecharRecuperacao() {
    if (recuperacaoOverlay) recuperacaoOverlay.hidden = true;
  }

  if (esqueciSenha) {
    esqueciSenha.addEventListener('click', function (e) {
      e.preventDefault();
      abrirRecuperacao();
    });
  }
  if (recuperacaoClose) recuperacaoClose.addEventListener('click', fecharRecuperacao);
  if (recuperacaoOverlay) {
    recuperacaoOverlay.addEventListener('click', e => {
      if (e.target === recuperacaoOverlay) fecharRecuperacao();
    });
  }

  if (recuperacaoContinuar) {
    recuperacaoContinuar.addEventListener('click', async function () {
      limparErrosRecuperacao();
      const identificador = String(recuperacaoIdentificador.value || '').trim();
      const nome = String(recuperacaoNome.value || '').trim();

      if (!identificador) {
        recuperacaoIdentificador.classList.add('invalid');
        setErroRecuperacao('erroRecuperacaoIdentificador', 'Informe seu e-mail, RA ou matrícula.');
        return;
      }
      if (nome.length < 3 || !nome.includes(' ')) {
        recuperacaoNome.classList.add('invalid');
        setErroRecuperacao('erroRecuperacaoNome', 'Informe seu nome completo.');
        return;
      }

      recuperacaoContinuar.disabled = true;
      recuperacaoContinuar.classList.add('is-loading');

      try {
        const resposta = await fetch(API_URL + '/auth/esqueci-senha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identificador, nome })
        });
        const dados = await resposta.json();
        if (!resposta.ok) {
          setErroRecuperacao('erroRecuperacaoIdentificador', dados.erro || 'Não foi possível iniciar a recuperação.');
          return;
        }

        recuperacaoDados.identificador = identificador;
        recuperacaoDados.codigo = '';
        recuperacaoCodigo.textContent = dados.email_destino
          ? 'Código enviado para ' + dados.email_destino
          : 'Código enviado para o e-mail cadastrado.';
        mostrarEtapaRecuperacao(2);
        setTimeout(() => recuperacaoCodigoInput.focus(), 30);
      } catch (err) {
        setErroRecuperacao('erroRecuperacaoIdentificador', 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
      } finally {
        recuperacaoContinuar.disabled = false;
        recuperacaoContinuar.classList.remove('is-loading');
      }
    });
  }

  if (recuperacaoCodigoInput) {
    recuperacaoCodigoInput.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 6);
      setErroRecuperacao('erroRecuperacaoCodigo', '');
      this.classList.remove('invalid');
    });
  }

  if (recuperacaoCopiar) {
    recuperacaoCopiar.addEventListener('click', function () {
      setErroRecuperacao('erroRecuperacaoCodigo', 'O código não é exibido no sistema. Consulte o e-mail cadastrado.');
    });
  }

  if (recuperacaoValidarCodigo) {
    recuperacaoValidarCodigo.addEventListener('click', function () {
      limparErrosRecuperacao();
      const codigo = String(recuperacaoCodigoInput.value || '').trim();
      if (!/^\d{6}$/.test(codigo)) {
        recuperacaoCodigoInput.classList.add('invalid');
        setErroRecuperacao('erroRecuperacaoCodigo', 'Informe exatamente 6 números.');
        return;
      }
      // Guarda o código digitado para enviá-lo ao servidor na etapa de troca da senha.
      // O código nunca é validado nem armazenado em texto puro no banco pelo frontend.
      recuperacaoDados.codigo = codigo;
      setErroRecuperacao('erroRecuperacaoCodigo', '');
      mostrarEtapaRecuperacao(3);
      setTimeout(() => recuperacaoNovaSenha.focus(), 30);
    });
  }

  if (recuperacaoSalvarSenha) {
    recuperacaoSalvarSenha.addEventListener('click', async function () {
      limparErrosRecuperacao();
      const novaSenha = String(recuperacaoNovaSenha.value || '');
      const confirmar = String(recuperacaoConfirmarSenha.value || '');

      if (!validarSenha(novaSenha)) {
        recuperacaoNovaSenha.classList.add('invalid');
        setErroRecuperacao('erroRecuperacaoNovaSenha', 'Use 8+ caracteres, com maiúscula, minúscula, número e símbolo.');
        return;
      }
      if (novaSenha !== confirmar) {
        recuperacaoConfirmarSenha.classList.add('invalid');
        setErroRecuperacao('erroRecuperacaoConfirmarSenha', 'As senhas não coincidem.');
        return;
      }

      recuperacaoSalvarSenha.disabled = true;
      recuperacaoSalvarSenha.classList.add('is-loading');
      try {
        const resposta = await fetch(API_URL + '/auth/resetar-senha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identificador: recuperacaoDados.identificador,
            codigo: recuperacaoDados.codigo,
            nova_senha: novaSenha
          })
        });
        const dados = await resposta.json();
        if (!resposta.ok) {
          setErroRecuperacao('erroRecuperacaoNovaSenha', dados.erro || 'Não foi possível redefinir a senha.');
          return;
        }
        loginEmail.value = recuperacaoDados.identificador;
        loginSenha.value = '';
        mostrarEtapaRecuperacao(4);
      } catch (err) {
        setErroRecuperacao('erroRecuperacaoNovaSenha', 'Não foi possível conectar ao servidor.');
      } finally {
        recuperacaoSalvarSenha.disabled = false;
        recuperacaoSalvarSenha.classList.remove('is-loading');
      }
    });
  }

  if (recuperacaoConcluir) {
    recuperacaoConcluir.addEventListener('click', function () {
      fecharRecuperacao();
      loginSenha.focus();
    });
  }


  // Delegação: funciona tanto no botão fixo do login quanto nos
  // botões de olho criados dinamicamente pelo renderCampos()
  overlay.addEventListener('click', function (e) {
    const btn = e.target.closest('.login-eye');
    if (!btn) return;
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    if (input.dataset.oculta !== undefined) {
      const mostrando = input.dataset.oculta === '0';
      input.dataset.oculta = mostrando ? '1' : '0';
      input.classList.toggle('senha-oculta', mostrando);
      btn.classList.toggle('mostrando', !mostrando);
      btn.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
      return;
    }
    const mostrando = input.type === 'text';
    input.type = mostrando ? 'password' : 'text';
    btn.classList.toggle('mostrando', !mostrando);
    btn.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
  });

  // Login e recuperação de senha: sem sugestões de e-mail/senha salvos.
  [entrarForm, cadastroForm].forEach(function (f) { if (f) f.setAttribute('autocomplete', 'off'); });
  blindarAutofill(document.getElementById('loginEmail'), false);
  blindarAutofill(document.getElementById('loginSenha'), true);
  blindarAutofill(document.getElementById('recuperacaoIdentificador'), false);
  blindarAutofill(document.getElementById('recuperacaoNome'), false);
  blindarAutofill(document.getElementById('recuperacaoNovaSenha'), true);
  // Formulário de contato (nome, e-mail, mensagem): sem sugestões de e-mails salvos.
  document.querySelectorAll('#contatoForm input, #contatoForm textarea').forEach(function (el) { blindarAutofill(el, false); });
  const contatoFormEl = document.getElementById('contatoForm');
  if (contatoFormEl) contatoFormEl.setAttribute('autocomplete', 'off');
  blindarAutofill(document.getElementById('recuperacaoConfirmarSenha'), true);

  const btnAcessar = entrarForm.querySelector('button[type="submit"], .login-btn');

  entrarForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validarLogin()) return;

    if (btnAcessar) {
      btnAcessar.classList.add('is-loading');
      btnAcessar.disabled = true;
    }

    try {
      const resposta = await fetch(API_URL + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizarIdentificadorLogin(loginEmail.value),
          senha: loginSenha.value
          // Sem "tipo": o login é genérico — o backend identifica a conta
          // só por e-mail/senha e devolve o tipo dela na resposta.
        })
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        if (dados.codigo === 'CONTA_DESATIVADA' && window.BiblioBetaAPI?.mostrarTelaContaDesativada) {
          erroLoginSenha.textContent = '';
          window.BiblioBetaAPI.mostrarTelaContaDesativada(false);
          return;
        }
        erroLoginSenha.textContent = dados.erro || 'Não foi possível entrar.';
        return;
      }

      // Guarda o token e os dados do usuário para uso nas páginas do painel
      localStorage.setItem('bibliobeta_token', dados.token);
      localStorage.setItem('bibliobeta_usuario', JSON.stringify(dados.usuario));

      const tipoLogado = (dados.usuario && dados.usuario.tipo) || 'aluno';

      // Tela "Bem-vindo de volta": o painel de aluno/professor mostra a tela
      // de boas-vindas uma única vez por login. A Gestão já tem a própria saudação.
      if (tipoLogado === 'aluno' || tipoLogado === 'professor') {
        try {
          sessionStorage.setItem('bibliobeta_boasvindas', JSON.stringify({
            modo: 'retorno',
            ultimoAcesso: dados.ultimo_acesso_anterior || null
          }));
        } catch (_) { /* sessionStorage indisponível: apenas não mostra a tela */ }
      }

      fecharLogin();
      window.location.href = PAINEIS[tipoLogado] || PAINEIS.aluno;
    } catch (err) {
      erroLoginSenha.textContent = 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.';
    } finally {
      if (btnAcessar) {
        btnAcessar.classList.remove('is-loading');
        btnAcessar.disabled = false;
      }
    }
  });

  cadastroForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const config = CONFIGS[tipoAtual];
    const ultimaEtapa = config.steps.length - 1;

    // Ainda não chegou na última etapa: só valida os campos visíveis
    // e avança, sem chamar a API.
    if (etapaAtual < ultimaEtapa) {
      if (!validarEtapaAtual()) return;
      irParaEtapa(config, etapaAtual + 1);
      return;
    }

    // Última etapa: valida tudo (todas as etapas) antes de enviar.
    if (!validarCadastro()) return;

    if (tipoAtual === 'aluno') {
      const ra = String(document.getElementById('cad_ra')?.value || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '') || '0';
      const dig = String(document.getElementById('cad_ra_digito')?.value || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
      const em = String(document.getElementById('cad_email')?.value || '').trim().toLowerCase();
      const m = em.match(/^([0-9a-z]+)sp@al\.educacao\.sp\.gov\.br$/i);
      const emailRa = m ? (m[1].toLowerCase().replace(/^0+(?=[0-9a-z])/, '') || '0') : '';
      if (!m || emailRa !== ((ra + dig).replace(/^0+(?=[0-9a-z])/, '') || '0')) {
        alert('O e-mail do aluno deve conter o RA + dígito correto, seguido de sp@al.educacao.sp.gov.br.');
        return;
      }
    }

    if (cadastroBotao) {
      cadastroBotao.classList.add('is-loading');
      cadastroBotao.disabled = true;
    }

    // Monta o corpo da requisição com os campos preenchidos no formulário
    // (percorre todas as etapas, já que os campos ficam agrupados nelas)
    const corpo = { tipo: tipoAtual };
    config.steps.forEach(function (step) {
      step.campos.forEach(function (campo) {
        const input = document.getElementById('cad_' + campo.id);
        if (input) corpo[campo.id] = (campo.id === 'senha' || campo.id === 'confirmar_senha') ? input.value : input.value.trim();
      });
    });

    // RA é enviado como texto para preservar os zeros à esquerda.
    // Formatos válidos: exatamente 9, 12 ou 13 dígitos. O dígito continua separado.
    if (corpo.ra) {
      corpo.ra_digito = (corpo.ra_digito || '').trim().replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
      corpo.ra = String(corpo.ra || '').replace(/\D/g, '');
    }

    try {
      const resposta = await fetch(API_URL + '/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo)
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(dados.erro || 'Não foi possível concluir o cadastro.');
        return;
      }

      // Cadastro da Gestão: fica aguardando aprovação de um administrador (sem login automático).
      if (dados.pendente) {
        alert(dados.mensagem || 'Cadastro enviado! Aguarde a aprovação de um administrador da Gestão.');
        cadastroForm.reset();
        irParaEtapa(config, 0);
        container.classList.remove('active');
        return;
      }

      // O backend já devolve token + usuario no cadastro: entra direto.
      if (dados.token && dados.usuario) {
        localStorage.setItem('bibliobeta_token', dados.token);
        localStorage.setItem('bibliobeta_usuario', JSON.stringify(dados.usuario));

        // Tela "Bem-vindo(a) ao BiblioBeta" para quem acabou de se cadastrar.
        try {
          if (dados.usuario.tipo !== 'gestao') sessionStorage.setItem('bibliobeta_boasvindas', JSON.stringify({ modo: 'novo' }));
        } catch (_) { /* sessionStorage indisponível: apenas não mostra a tela */ }

        const tipoCadastrado = dados.usuario.tipo || tipoAtual;
        cadastroForm.reset();
        irParaEtapa(config, 0);
        fecharLogin();
        window.location.href = PAINEIS[tipoCadastrado] || PAINEIS.aluno;
        return;
      }

      // Sem token na resposta: volta para a tela de login.
      alert(config.botao + ' realizado com sucesso! Faça login para continuar.');
      cadastroForm.reset();
      irParaEtapa(config, 0); // reseta o wizard pra Etapa 1
      container.classList.remove('active'); // volta para a tela de login
    } catch (err) {
      alert('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
    } finally {
      if (cadastroBotao) {
        cadastroBotao.classList.remove('is-loading');
        cadastroBotao.disabled = false;
      }
    }
  });

})();