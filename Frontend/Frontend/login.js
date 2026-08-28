/* =====================================================
   LOGIN / CADASTRO - Lógica do modal
   Sistema BiblioBeta
   ===================================================== */
(function () {

  // ---------- Conexão com a API ----------
  // Endereço do backend (server.js). Ajuste aqui se o backend rodar em outra porta/host.
  const API_URL = 'http://localhost:3000';

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
            { id: 'nome', label: 'Nome completo', type: 'text', validacao: 'nome' },
            { id: 'telefone', label: 'Número de telefone', type: 'tel', validacao: 'telefone' }
          ]
        },
        {
          titulo: 'Informações escolares',
          campos: [
            { id: 'ra', label: 'RA + Dígito', type: 'text', validacao: 'ra' },
            { id: 'turma', label: 'Série / Turma', type: 'text', validacao: 'obrigatorio' }
          ]
        },
        {
          titulo: 'Contato e senha',
          campos: [
            { id: 'email', label: 'E-mail', type: 'email', validacao: 'email' },
            { id: 'senha', label: 'Senha', type: 'password', validacao: 'senha' }
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
            { id: 'nome', label: 'Nome completo', type: 'text', validacao: 'nome' },
            { id: 'telefone', label: 'Número de telefone', type: 'tel', validacao: 'telefone' }
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
            { id: 'senha', label: 'Senha', type: 'password', validacao: 'senha' }
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
            { id: 'nome', label: 'Nome completo', type: 'text', validacao: 'nome' },
            { id: 'telefone', label: 'Número de telefone', type: 'tel', validacao: 'telefone' }
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
            { id: 'senha', label: 'Senha', type: 'password', validacao: 'senha' }
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
  let contextoAtual = 'padrao'; // 'padrao' (Aluno/Professor, com seletor) ou 'gestao' (isolado, sem seletor)
  let etapaAtual = 0; // índice da etapa de cadastro visível (0-based)

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

  // Monta um grupo (div.cadastro-step-group) por etapa do config atual.
  // Todos os campos de todas as etapas ficam no DOM (só o grupo da etapa
  // ativa fica visível), então a validação final do envio continua vendo
  // todos os inputs, exatamente como antes.
  function renderEtapas(config) {
    cadastroCampos.innerHTML = '';
    config.steps.forEach(function (step, indice) {
      const grupo = document.createElement('div');
      grupo.className = 'cadastro-step-group';
      grupo.dataset.stepIndex = String(indice);

      step.campos.forEach(function (campo) {
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
        grupo.appendChild(wrapper);
      });

      cadastroCampos.appendChild(grupo);
    });
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
      '.cadastro-step-group[data-step-index="' + indice + '"] input'
    );
    if (primeiroInput) primeiroInput.focus({ preventScroll: true });
  }

  // Valida só os campos da etapa visível no momento.
  function validarEtapaAtual() {
    let tudoValido = true;
    const grupoAtivo = cadastroCampos.querySelector('.cadastro-step-group.active');
    if (!grupoAtivo) return true;
    grupoAtivo.querySelectorAll('input').forEach(function (input) {
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
    contextoAtual = (tipoUsuario === 'gestao') ? 'gestao' : 'padrao';
    if (roleSwitch) roleSwitch.hidden = (contextoAtual === 'gestao');

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
    if (contextoAtual !== 'padrao' || tipoUsuario === tipoAtual) return;
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

  entrarForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validarLogin()) return;

    if (btnAcessar) {
      btnAcessar.classList.add('is-loading');
      btnAcessar.disabled = true;
    }

    try {
      const resposta = await fetch(API_URL + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.value.trim(),
          senha: loginSenha.value
          // Sem "tipo": o login é genérico — o backend identifica a conta
          // só por e-mail/senha e devolve o tipo dela na resposta.
        })
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        erroLoginSenha.textContent = dados.erro || 'Não foi possível entrar.';
        return;
      }

      // Guarda o token e os dados do usuário para uso nas páginas do painel
      localStorage.setItem('bibliobeta_token', dados.token);
      localStorage.setItem('bibliobeta_usuario', JSON.stringify(dados.usuario));

      const tipoLogado = (dados.usuario && dados.usuario.tipo) || 'aluno';
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
        if (input) corpo[campo.id] = input.value.trim();
      });
    });

    try {
      const resposta = await fetch(API_URL + '/api/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo)
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(dados.erro || 'Não foi possível concluir o cadastro.');
        return;
      }

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