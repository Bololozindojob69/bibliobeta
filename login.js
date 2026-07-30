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
        { id: 'cargo', label: 'Cargo', type: 'text', validacao: 'obrigatorio' },
        { id: 'rg', label: 'RG', type: 'text', validacao: 'rg' },
        { id: 'nascimento', label: 'Data de nascimento', type: 'date', validacao: 'obrigatorio' },
        { id: 'email', label: 'E-mail', type: 'email', validacao: 'email' },
        { id: 'senha', label: 'Senha', type: 'password', validacao: 'senha' }
      ]
    }
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
  function validarRG(v) {
    const digitos = v.replace(/\D/g, '');
    return digitos.length >= 5 && digitos.length <= 12;
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
    rg: { fn: validarRG, msg: 'Informe um RG válido.' },
    senha: { fn: validarSenha, msg: 'A senha deve ter ao menos 6 caracteres.' },
    nome: { fn: validarNome, msg: 'Informe o nome completo.' },
    obrigatorio: { fn: validarObrigatorio, msg: 'Este campo é obrigatório.' }
  };

  // ---------- Renderização dos campos de cadastro ----------
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

      wrapper.appendChild(input);
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
  }

  function fecharLogin() {
    overlay.classList.remove('show');
    document.body.style.overflow = '';
    limparFormularios();
    container.classList.remove('active');
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

  entrarForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validarLogin()) return;
    alert('Login realizado com sucesso!');
    fecharLogin();
  });

  cadastroForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validarCadastro()) return;
    const config = CONFIGS[tipoAtual];
    alert(config.botao + ' realizado com sucesso!');
    fecharLogin();
  });

})();