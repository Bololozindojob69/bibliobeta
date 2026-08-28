(function(){
  const root = document.documentElement;

  const DEFAULT_THEME = {
    "--bg":"#FAF5EC","--card":"#F7E9D0","--navbar":"#4A2C1A","--menu":"#4A2C1A",
    "--banner":"#4A2C1A","--text":"#6B4226","--title":"#4A2C1A","--btn":"#E86A17",
    "--btn-hover":"#F28C28","--icon":"#D9A441","--detail":"#A67C52","--green":"#6AA84F",
    "--on-dark":"#FAF5EC"
  };

  const THEMES = {
    laranja: DEFAULT_THEME,
    claro: {
      "--bg":"#FFFFFF","--card":"#F4F1EC","--navbar":"#242220","--menu":"#242220",
      "--banner":"#242220","--text":"#524B44","--title":"#1C1917","--btn":"#E86A17",
      "--btn-hover":"#F28C28","--icon":"#8A7F73","--detail":"#D8D2C9","--green":"#6AA84F",
      "--on-dark":"#FFFFFF"
    },
    escuro: {
      "--bg":"#161110","--card":"#241C19","--navbar":"#0E0B0A","--menu":"#0E0B0A",
      "--banner":"#0E0B0A","--text":"#E4D6C8","--title":"#FBF0E3","--btn":"#E86A17",
      "--btn-hover":"#F28C28","--icon":"#E8B25C","--detail":"#5C4436","--green":"#7BC15E",
      "--on-dark":"#FBF0E3"
    },
    azul: {
      "--bg":"#F1F6FB","--card":"#E2EDF7","--navbar":"#16314D","--menu":"#16314D",
      "--banner":"#16314D","--text":"#2C4A6E","--title":"#102943","--btn":"#2D7DD2",
      "--btn-hover":"#4A95E0","--icon":"#5DA3D9","--detail":"#9CC3E4","--green":"#6AA84F",
      "--on-dark":"#F1F6FB"
    },
    verde: {
      "--bg":"#F2F8EF","--card":"#E3EFDD","--navbar":"#23391F","--menu":"#23391F",
      "--banner":"#23391F","--text":"#3D5A3E","--title":"#1D301E","--btn":"#4F8A3F",
      "--btn-hover":"#62A34E","--icon":"#7FB069","--detail":"#B3CBA3","--green":"#6AA84F",
      "--on-dark":"#F2F8EF"
    },
    roxo: {
      "--bg":"#F8F4FB","--card":"#ECE0F5","--navbar":"#2E1A47","--menu":"#2E1A47",
      "--banner":"#2E1A47","--text":"#4A3266","--title":"#241439","--btn":"#7B4FA0",
      "--btn-hover":"#9466BC","--icon":"#A87FC2","--detail":"#CDB8E0","--green":"#6AA84F",
      "--on-dark":"#F8F4FB"
    },
    rosa: {
      "--bg":"#FDF2F5","--card":"#FADCE4","--navbar":"#7A2438","--menu":"#7A2438",
      "--banner":"#7A2438","--text":"#8A3A4C","--title":"#5C1A28","--btn":"#D94F70",
      "--btn-hover":"#E8708C","--icon":"#E39AAA","--detail":"#F0C2CE","--green":"#6AA84F",
      "--on-dark":"#FDF2F5"
    },
    vermelho: {
      "--bg":"#FBF1EF","--card":"#F5DAD4","--navbar":"#5C1712","--menu":"#5C1712",
      "--banner":"#5C1712","--text":"#7A2A20","--title":"#3F0F0B","--btn":"#C2402C",
      "--btn-hover":"#D9634C","--icon":"#E08D7D","--detail":"#EFC4B9","--green":"#6AA84F",
      "--on-dark":"#FBF1EF"
    },
    amarelo: {
      "--bg":"#FDFAEE","--card":"#F7EEC4","--navbar":"#4A3B0E","--menu":"#4A3B0E",
      "--banner":"#4A3B0E","--text":"#6B5A1E","--title":"#332705","--btn":"#D9A61E",
      "--btn-hover":"#E8BE45","--icon":"#EBCB6E","--detail":"#F2E0A4","--green":"#6AA84F",
      "--on-dark":"#FDFAEE"
    },
    turquesa: {
      "--bg":"#EFFAF9","--card":"#D6F0EE","--navbar":"#0F3E3C","--menu":"#0F3E3C",
      "--banner":"#0F3E3C","--text":"#1F5A57","--title":"#0A2B29","--btn":"#1E9C93",
      "--btn-hover":"#33B7AD","--icon":"#6FCAC2","--detail":"#B3E4DF","--green":"#6AA84F",
      "--on-dark":"#EFFAF9"
    },
    grafite: {
      "--bg":"#F2F2F2","--card":"#E1E1E1","--navbar":"#232323","--menu":"#232323",
      "--banner":"#232323","--text":"#3D3D3D","--title":"#141414","--btn":"#5B5B5B",
      "--btn-hover":"#767676","--icon":"#9A9A9A","--detail":"#C7C7C7","--green":"#6AA84F",
      "--on-dark":"#F2F2F2"
    },
    contraste: {
      "--bg":"#000000","--card":"#0A0A0A","--navbar":"#000000","--menu":"#000000",
      "--banner":"#000000","--text":"#FFFFFF","--title":"#FFE600","--btn":"#FFE600",
      "--btn-hover":"#FFF35C","--icon":"#FFE600","--detail":"#FFFFFF","--green":"#00FF6A",
      "--on-dark":"#FFFFFF"
    },
    marrom: {
      "--bg":"#F6EFE6","--card":"#EAD9C2","--navbar":"#3B2A1E","--menu":"#3B2A1E",
      "--banner":"#3B2A1E","--text":"#5C4530","--title":"#28190F","--btn":"#8B5A2B",
      "--btn-hover":"#A6733D","--icon":"#C29768","--detail":"#DDC1A0","--green":"#6AA84F",
      "--on-dark":"#F6EFE6"
    }
  };

  const STORAGE_KEY = "bibliobeta-theme-v1";
  const STORAGE_SELECT_KEY = "bibliobeta-theme-select-v1";

  function applyVars(vars){
    Object.entries(vars).forEach(([k,v]) => root.style.setProperty(k, v));
  }

  function syncInputsFromVars(){
    document.querySelectorAll('.color-row input[type="color"]').forEach(input => {
      const v = getComputedStyle(root).getPropertyValue(input.dataset.var).trim();
      if(v) input.value = rgbToHex(v) || v;
    });
  }

  // helper in case computed value comes back as rgb()
  function rgbToHex(val){
    if(val.startsWith('#')) return val;
    const m = val.match(/\d+/g);
    if(!m) return null;
    return "#" + m.slice(0,3).map(n => (+n).toString(16).padStart(2,'0')).join('');
  }

  function saveState(themeName, vars){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vars));
    localStorage.setItem(STORAGE_SELECT_KEY, themeName);
  }

  function loadState(){
    const select = document.getElementById('themeSelect');
    const savedVars = localStorage.getItem(STORAGE_KEY);
    const savedSelect = localStorage.getItem(STORAGE_SELECT_KEY);
    if(savedVars){
      applyVars(JSON.parse(savedVars));
    } else {
      applyVars(DEFAULT_THEME);
    }
    select.value = savedSelect || 'laranja';
    syncInputsFromVars();
  }

  function setTheme(name){
    document.documentElement.classList.toggle('alto-contraste', name === 'contraste');
    if(THEMES[name]){
      applyVars(THEMES[name]);
      saveState(name, THEMES[name]);
    }
    syncInputsFromVars();
  }

  // theme select
  const themeSelect = document.getElementById('themeSelect');
  themeSelect.addEventListener('change', e => setTheme(e.target.value));

  // individual color pickers -> switches select to "Personalizado"
  document.querySelectorAll('.color-row input[type="color"]').forEach(input => {
    input.addEventListener('input', () => {
      root.style.setProperty(input.dataset.var, input.value);
      themeSelect.value = 'custom';
      const currentVars = {};
      document.querySelectorAll('.color-row input[type="color"]').forEach(i2 => {
        currentVars[i2.dataset.var] = getComputedStyle(root).getPropertyValue(i2.dataset.var).trim() || i2.value;
      });
      saveState('custom', currentVars);
    });
  });

  document.getElementById('restoreDefault').addEventListener('click', () => {
    applyVars(DEFAULT_THEME);
    themeSelect.value = 'laranja';
    saveState('laranja', DEFAULT_THEME);
    syncInputsFromVars();
  });

  loadState();
  document.documentElement.classList.toggle(
    'alto-contraste', localStorage.getItem(STORAGE_SELECT_KEY) === 'contraste'
  );
  window.BiblioBetaTema = { setTheme: setTheme };

  // ---------------- Dropdown ----------------
  const profileBtn = document.getElementById('profileBtn');
  const dropdownMenu = document.getElementById('dropdownMenu');
  const dropdownWrap = document.getElementById('dropdownWrap');

  function closeDropdown(){
    dropdownMenu.classList.remove('show');
    profileBtn.classList.remove('open');
  }

  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdownMenu.classList.contains('show');
    if(isOpen){ closeDropdown(); } else {
      dropdownMenu.classList.add('show');
      profileBtn.classList.add('open');
    }
  });

  document.addEventListener('click', (e) => {
    if(!dropdownWrap.contains(e.target)){ closeDropdown(); }
  });

  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){ closeDropdown(); closeSettingsPanel(); closeMobileNav(); }
  });

  // ---------------- Settings panel ----------------
  const settingsPanel = document.getElementById('settingsPanel');
  const overlay = document.getElementById('overlay');

  function openSettingsPanel(){
    settingsPanel.classList.add('show');
    overlay.classList.add('show');
    closeDropdown();
  }
  function closeSettingsPanel(){
    settingsPanel.classList.remove('show');
    overlay.classList.remove('show');
  }

  document.getElementById('openSettings').addEventListener('click', openSettingsPanel);
  document.getElementById('closeSettings').addEventListener('click', closeSettingsPanel);
  overlay.addEventListener('click', closeSettingsPanel);

  // other dropdown actions (placeholder behaviour)
  document.querySelectorAll('.dropdown [data-action]').forEach(btn => {
    btn.addEventListener('click', () => closeDropdown());
  });

  // ---------------- Mobile lateral nav ----------------
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  const navOverlay = document.getElementById('navOverlay');
  const navClose = document.getElementById('navClose');

  function openMobileNav(){
    navLinks.classList.add('show');
    navOverlay.classList.add('show');
  }
  function closeMobileNav(){
    navLinks.classList.remove('show');
    navOverlay.classList.remove('show');
  }

  hamburger.addEventListener('click', () => {
    if(navLinks.classList.contains('show')){ closeMobileNav(); }
    else { openMobileNav(); }
  });
  navClose.addEventListener('click', closeMobileNav);
  navOverlay.addEventListener('click', closeMobileNav);
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMobileNav));

  // ---------------- Contact form ----------------
  document.getElementById('contatoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const original = btn.textContent;
    btn.textContent = 'Mensagem enviada ✓';
    e.target.reset();
    setTimeout(() => { btn.textContent = original; }, 2400);
  });

  // ---------------- Page navigation (no scrolling) ----------------
  // Clicking a menu item swaps which "page" is visible instead of
  // scrolling the page to an anchor.
  const PAGE_IDS = ['sobre', 'regras', 'contato'];
  const homeEls = document.querySelectorAll('.home-page');
  const pageEls = {};
  PAGE_IDS.forEach(id => { pageEls[id] = document.getElementById(id); });

  function setActiveNavLinks(targetId){
    document.querySelectorAll('.nav-links a, .footer-links a, .ribbon a').forEach(a => {
      const href = a.getAttribute('href') || '';
      const isMatch = href === '#' + targetId;
      a.classList.toggle('is-current', isMatch);
    });
  }

  function showHome(){
    homeEls.forEach(el => el.classList.remove('is-hidden'));
    PAGE_IDS.forEach(id => pageEls[id] && pageEls[id].classList.remove('is-active'));
    setActiveNavLinks('topo');
    window.scrollTo(0, 0);
  }

  function showPage(id){
    if(!PAGE_IDS.includes(id) || !pageEls[id]) { showHome(); return; }
    homeEls.forEach(el => el.classList.add('is-hidden'));
    PAGE_IDS.forEach(pid => pageEls[pid] && pageEls[pid].classList.toggle('is-active', pid === id));
    setActiveNavLinks(id);
    window.scrollTo(0, 0);
  }

  function goTo(target){
    if(target === 'topo' || !target){ showHome(); }
    else { showPage(target); }
  }

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    const target = a.getAttribute('href').slice(1);
    if(target === 'topo' || PAGE_IDS.includes(target)){
      a.addEventListener('click', (e) => {
        e.preventDefault();
        goTo(target);
        closeMobileNav();
      });
    }
  });

  // ---------------- Back buttons (sobre/regras/contato) ----------------
  document.querySelectorAll('.back-btn[data-back]').forEach(btn => {
    btn.addEventListener('click', () => goTo('topo'));
  });

  // Start on the home page
  showHome();

  // ---------------- Scroll reveal ----------------
  const revealEls = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('in');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold:.15 });
  revealEls.forEach(el => obs.observe(el));
})();