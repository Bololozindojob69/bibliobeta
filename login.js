/* =====================================================
   LOGIN / CADASTRO - Lógica do modal
   Sistema BiblioBeta
   ===================================================== */
(function () {

  // ---------- Configuração de cada tipo de usuário ----------
  const CONFIGS = {
    aluno: {
      titulo: 'Cadastro de Aluno',
      descricao: 'Crie sua conta para utilizar todos os serviços da Biblioteca Escolar.',
      botao: 'Cadastrar Aluno',
      campos: [
        { id: 'nome', label: 'Nome completo', type: 'text', validacao: 'nome' },
        { id: 'telefone', label: 'Número de telefone', type: 'tel', validacao: 'telefone' },
        { id: 'ra', label: 'RA + Dígito', type: 'text', validacao: 'ra' },
        { id: 'turma', label: 'Série / Turma', type: 'text', validacao: 'obrigatorio' },
        { id: 'email', label: 'E-mail', type: 'email', validacao: 'email' },
        { id: 'senha', label: 'Senha', type: 'password', validacao: 'senha' }
      ]
    },
    professor: {
      titulo: 'Cadastro de Professor',
      descricao: 'Cadastre-se para acessar o sistema da biblioteca.',
      botao: 'Cadastrar Professor',
      campos: [
        { id: 'nome', label: 'Nome completo', type: 'text', validacao: 'nome' },
        { id: 'telefone', label: 'Número de telefone', type: 'tel', validacao: 'telefone' },
        { id: 'email', label: 'E-mail', type: 'email', validacao: 'email' },
        { id: 'senha', label: 'Senha', type: 'password', validacao: 'senha' }
      ]
    },
    gestao: {
      titulo: 'Cadastro da Gestão',
      descricao: 'Cadastre-se para administrar o Sistema da Biblioteca.',
      botao: 'Cadastrar Gestão',
      campos: [
        { id: 'nome', label: 'Nome completo', type: 'text', validacao: 'nome' },
        { id: 'telefone', label: 'Número de telefone', type: 'tel', validacao: 'telefone' },
        { id: 'email', label: 'E-mail', type: 'email', validacao: 'email' },
        { id: 'senha', label: 'Senha', type: 'password', validacao: 'senha' }
      ]
    }
  };

  // ---------- Painel de destino de cada tipo de usuário ----------
  const PAINEIS = {
    aluno: 'aluno.html',
    professor: 'professor.html',
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
  const loginSenha = document.getElementById('loginSenha');
  const erroLoginEmail = document.getElementById('erroLoginEmail');
  const erroLoginSenha = document.getElementById('erroLoginSenha');
  const esqueciSenha = document.getElementById('esqueciSenha');

  const btnIrParaCadastro = document.getElementById('btnIrParaCadastro');
  const btnIrParaLogin = document.getElementById('btnIrParaLogin');

  let tipoAtual = 'aluno';

  // ---------- Validações ----------
  function validarEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  }
  function validarTelefone(v) {
    const digitos = v.replace(/\D/g, '');
    return digitos.length >= 10 && digitos.length <= 11;
  }
  function validarRA(v) {
    return /^\d{4,8}-?\d$/.test(v.trim());
  }
  function validarSenha(v) {
    return v.length >= 6;
  }
  function validarNome(v) {
    return v.trim().length >= 3 && v.trim().includes(' ');
  }
  function validarObrigatorio(v) {
    return v.trim().length > 0;
  }

  const VALIDADORES = {
    email: { fn: validarEmail, msg: 'Informe um e-mail válido.' },
    telefone: { fn: validarTelefone, msg: 'Informe um telefone válido (DDD + número).' },
    ra: { fn: validarRA, msg: 'Informe o RA seguido do dígito (ex.: 123456-7).' },
    senha: { fn: validarSenha, msg: 'A senha deve ter ao menos 6 caracteres.' },
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

  function renderCampos(config) {
    cadastroCampos.innerHTML = '';
    config.campos.forEach(function (campo) {
      const wrapper = document.createElement('div');
      wrapper.className = 'login-field';

      const input = document.createElement('input');
      input.type = campo.type;
      input.id = 'cad_' + campo.id;
      input.placeholder = campo.label;
      input.dataset.validacao = campo.validacao;
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

      wrapper.appendChild(erro);
      cadastroCampos.appendChild(wrapper);
    });
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
    cadastroCampos.querySelectorAll('input').forEach(function (input) {
      const erroEl = document.getElementById('erro_' + input.id);
      const valido = validarCampo(input, erroEl);
      if (!valido) tudoValido = false;
    });
    return tudoValido;
  }

  function validarLogin() {
    const emailOk = validarCampo(loginEmail, erroLoginEmail);
    const senhaValida = (loginSenha.value || '').length > 0;
    if (!senhaValida) {
      loginSenha.classList.add('invalid');
      erroLoginSenha.textContent = 'Informe sua senha.';
    } else {
      loginSenha.classList.remove('invalid');
      erroLoginSenha.textContent = '';
    }
    return emailOk && senhaValida;
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

  // ---------- Abrir / Fechar modal ----------
  function abrirLogin(tipoUsuario) {
    const config = CONFIGS[tipoUsuario] || CONFIGS.aluno;
    tipoAtual = CONFIGS[tipoUsuario] ? tipoUsuario : 'aluno';

    cadastroTitulo.textContent = config.titulo;
    cadastroDescricao.textContent = config.descricao;
    cadastroBotao.textContent = config.botao;
    renderCampos(config);

    limparFormularios();
    container.classList.remove('active', 'tipo-aluno', 'tipo-professor', 'tipo-gestao');
    container.classList.add('tipo-' + tipoAtual);

    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
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
      fecharLogin();
    }
  });

  btnIrParaCadastro.addEventListener('click', function () {
    container.classList.add('active');
  });

  btnIrParaLogin.addEventListener('click', function () {
    container.classList.remove('active');
  });

  esqueciSenha.addEventListener('click', function (e) {
    e.preventDefault();
    alert('Um link de redefinição de senha será enviado para o seu e-mail cadastrado.');
  });

  // Delegação: funciona tanto no botão fixo do login quanto nos
  // botões de olho criados dinamicamente pelo renderCampos()
  overlay.addEventListener('click', function (e) {
    const btn = e.target.closest('.login-eye');
    if (!btn) return;
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const mostrando = input.type === 'text';
    input.type = mostrando ? 'password' : 'text';
    btn.classList.toggle('mostrando', !mostrando);
    btn.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
  });

  const btnAcessar = entrarForm.querySelector('button[type="submit"], .login-btn');

  entrarForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validarLogin()) return;

    if (btnAcessar) {
      btnAcessar.classList.add('is-loading');
      btnAcessar.disabled = true;
    }

    // Simula a chamada de autenticação; troque por uma requisição real quando houver backend
    setTimeout(function () {
      if (btnAcessar) {
        btnAcessar.classList.remove('is-loading');
        btnAcessar.disabled = false;
      }
      fecharLogin();
      window.location.href = PAINEIS[tipoAtual] || PAINEIS.aluno;
    }, 1200);
  });

  cadastroForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validarCadastro()) return;
    const config = CONFIGS[tipoAtual];

    if (cadastroBotao) {
      cadastroBotao.classList.add('is-loading');
      cadastroBotao.disabled = true;
    }

    setTimeout(function () {
      if (cadastroBotao) {
        cadastroBotao.classList.remove('is-loading');
        cadastroBotao.disabled = false;
      }
      alert(config.botao + ' realizado com sucesso!');
      fecharLogin();
      window.location.href = PAINEIS[tipoAtual] || PAINEIS.aluno;
    }, 1200);
  });

})();