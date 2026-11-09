// Gêneros literários do BiblioBeta.
// - lista padrão (nome, ícone e cor usados no catálogo)
// - classificação dos livros que já existiam no banco
// - tradução das categorias/assuntos que as APIs de ISBN devolvem (Google Books,
//   Open Library, BrasilAPI) para os gêneros do BiblioBeta
'use strict';

const GENEROS_PADRAO = [
  { nome: 'Ficção',                  icone: '✨', cor: '#7c3aed', descricao: 'Histórias inventadas, de qualquer estilo.' },
  { nome: 'Romance',                 icone: '💌', cor: '#e11d63', descricao: 'Amor, amizade e relações.' },
  { nome: 'Fantasia',                icone: '🐉', cor: '#6d28d9', descricao: 'Magia, mundos e criaturas.' },
  { nome: 'Ficção Científica',      icone: '🚀', cor: '#0369a1', descricao: 'Futuro, espaço e tecnologia imaginada.' },
  { nome: 'Aventura',                icone: '🧭', cor: '#d97706', descricao: 'Ação, viagens e descobertas.' },
  { nome: 'Mistério e Suspense',     icone: '🕵️', cor: '#334155', descricao: 'Enigmas, crimes e tensão.' },
  { nome: 'Terror',                  icone: '🦇', cor: '#7f1d1d', descricao: 'Para quem gosta de um arrepio.' },
  { nome: 'Infantil',                icone: '🧸', cor: '#f59e0b', descricao: 'Histórias para os pequenos leitores.' },
  { nome: 'Juvenil',                 icone: '🎒', cor: '#0ea5e9', descricao: 'Para adolescentes e jovens leitores.' },
  { nome: 'Poesia',                  icone: '🪶', cor: '#db2777', descricao: 'Versos, letras e poemas.' },
  { nome: 'Contos e Crônicas',       icone: '📖', cor: '#0d9488', descricao: 'Histórias curtas para ler de uma vez.' },
  { nome: 'Quadrinhos e Mangás',     icone: '💥', cor: '#ea580c', descricao: 'HQs, mangás e graphic novels.' },
  { nome: 'História',                icone: '🏛️', cor: '#b45309', descricao: 'Fatos e personagens que moldaram o mundo.' },
  { nome: 'Biografia',               icone: '🪪', cor: '#4f46e5', descricao: 'Vidas reais e memórias.' },
  { nome: 'Ciências',                icone: '🔬', cor: '#059669', descricao: 'Natureza, saúde, tecnologia e matemática.' },
  { nome: 'Sociedade e Política',    icone: '🌍', cor: '#2563eb', descricao: 'Para entender o mundo em que vivemos.' },
  { nome: 'Feminismo',               icone: '♀️', cor: '#c026d3', descricao: 'Mulheres, direitos e igualdade.' },
  { nome: 'Cultura Afro-brasileira', icone: '✊🏾', cor: '#a16207', descricao: 'Autoras e autores negros, história e identidade.' },
  { nome: 'Autoajuda',               icone: '🌱', cor: '#16a34a', descricao: 'Desenvolvimento pessoal e bem-estar.' },
  { nome: 'Didático',                icone: '📚', cor: '#0891b2', descricao: 'Livros de estudo e apoio escolar.' }
];

// Livros que já estavam cadastrados (comparação pelo título, sem acento/maiúscula).
const GENEROS_LIVROS_INICIAIS = {
  'sobrevivendo no inferno':                              ['Poesia', 'Cultura Afro-brasileira', 'Sociedade e Política'],
  'pequeno manual antirracista':                          ['Sociedade e Política', 'Cultura Afro-brasileira'],
  'academia arcana':                                      ['Fantasia', 'Romance', 'Juvenil'],
  'racismo estrutural':                                   ['Sociedade e Política', 'Cultura Afro-brasileira'],
  'quem tem medo do feminismo negro?':                    ['Feminismo', 'Cultura Afro-brasileira', 'Sociedade e Política'],
  'memorias da plantacao: episodios de racismo cotidiano':['Sociedade e Política', 'Cultura Afro-brasileira', 'Biografia'],
  'feminismo e para todo mundo':                          ['Feminismo', 'Sociedade e Política'],
  'a culpa e das estrelas':                               ['Romance', 'Juvenil', 'Ficção'],
  'o pequeno principe preto':                             ['Infantil', 'Ficção', 'Cultura Afro-brasileira'],
  'as lendas de dandara':                                 ['Juvenil', 'Contos e Crônicas', 'História', 'Cultura Afro-brasileira']
};

function semAcento(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Palavras-chave (já sem acento) -> gênero. Cobre português e inglês, que é como as APIs respondem.
const REGRAS = [
  ['Fantasia',               /fantasy|fantasia|magic|magia|dragon|dragao|wizard|bruxo/],
  ['Romance',                /romance|love stor|amor\b|young adult fiction.*romance/],
  ['Mistério e Suspense',    /mystery|misterio|suspense|thriller|detective|detetive|crime|policial/],
  ['Terror',                 /horror|terror|gothic|gotico/],
  ['Aventura',               /adventure|aventura/],
  ['Infantil',               /juvenile fiction|children|infantil|infanto|kids|picture book|fairy tale|conto de fadas/],
  ['Juvenil',                /young adult|juvenil|teen|adolescen|infantojuvenil/],
  ['Poesia',                 /poetry|poesia|poem|poemas|verse|lyric|letras/],
  ['Contos e Crônicas',      /short stories|contos|cronica|chronicle|essays? and stories/],
  ['Quadrinhos e Mangás',    /comic|graphic novel|quadrinho|manga|\bhq\b/],
  ['História',               /history|historia|histor(y|ical)|historic|colonial|escravid|slavery/],
  ['Biografia',              /biograph|biografia|autobiograph|memoir|memoria|diary|diario/],
  ['Ciências',               /science|ciencia|biology|biologia|physics|fisica|chemistry|quimica|mathematic|matematica|technology|tecnologia|computer|health|saude|medicine|medicina|nature|natureza|astronom/],
  ['Feminismo',              /feminis|women|mulher|gender studies|genero/],
  ['Cultura Afro-brasileira',/african|afro|black|negr|racis|antirracis|racial|quilomb/],
  ['Sociedade e Política',   /social|sociolog|politic|politica|philosophy|filosofia|democracy|democracia|human rights|direitos|economics|economia|culture|cultura/],
  ['Autoajuda',              /self-help|autoajuda|self help|personal development|desenvolvimento pessoal|motivation|motivacional|psychology|psicologia/],
  ['Didático',               /education|educacao|textbook|didatic|study|estudo|dictionary|dicionario|language arts|reference/],
  ['Ficção',                 /fiction|ficcao|novel\b|romance brasileiro|literatura|literature|stories/]
];

// textos: lista de categorias/assuntos vindos das APIs (podem vir "Fiction / Fantasy / Epic").
function mapearGeneros(textos, extra) {
  const bruto = []
    .concat(textos || [], extra || [])
    .flatMap(t => String(t || '').split(/[\/,;>]|\s-\s/))
    .map(semAcento)
    .filter(Boolean);
  const achados = [];
  for (const t0 of bruto) {
    if (/science fiction|ficcao cientifica|sci-?fi/.test(t0)) { if (!achados.includes('Ficção Científica')) achados.push('Ficção Científica'); continue; }
    const t = t0.replace(/social sciences?/g, 'social');
    for (const [nome, re] of REGRAS) {
      if (re.test(t) && !achados.includes(nome)) achados.push(nome);
    }
  }
  return achados.slice(0, 4);
}

// Garante as tabelas e os gêneros padrão. Só dá gênero aos livros que ainda não têm nenhum,
// então rodar várias vezes (a cada início do servidor) não apaga escolhas feitas pela Gestão.
async function garantirGeneros({ run, all, get }) {
  await run(`CREATE TABLE IF NOT EXISTS generos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    icone TEXT,
    cor TEXT,
    descricao TEXT,
    ordem INTEGER NOT NULL DEFAULT 0
  )`);
  await run(`CREATE TABLE IF NOT EXISTS livro_generos (
    livro_id INTEGER NOT NULL,
    genero_id INTEGER NOT NULL,
    PRIMARY KEY (livro_id, genero_id),
    FOREIGN KEY (livro_id) REFERENCES livros(id) ON DELETE CASCADE,
    FOREIGN KEY (genero_id) REFERENCES generos(id) ON DELETE CASCADE
  )`);
  await run('CREATE INDEX IF NOT EXISTS idx_livro_generos_genero ON livro_generos(genero_id)');

  for (let i = 0; i < GENEROS_PADRAO.length; i++) {
    const g = GENEROS_PADRAO[i];
    await run('INSERT OR IGNORE INTO generos(nome,icone,cor,descricao,ordem) VALUES(?,?,?,?,?)', [g.nome, g.icone, g.cor, g.descricao, i + 1]);
  }

  const livros = await all('SELECT id,titulo FROM livros WHERE id NOT IN (SELECT livro_id FROM livro_generos)');
  const generos = await all('SELECT id,nome FROM generos');
  const idPorNome = new Map(generos.map(g => [g.nome, g.id]));
  let atribuidos = 0;
  for (const l of livros) {
    const nomes = GENEROS_LIVROS_INICIAIS[semAcento(l.titulo)];
    if (!nomes) continue;
    for (const n of nomes) {
      const gid = idPorNome.get(n);
      if (gid) { await run('INSERT OR IGNORE INTO livro_generos(livro_id,genero_id) VALUES(?,?)', [l.id, gid]); atribuidos++; }
    }
  }
  return { generos: generos.length, atribuidos };
}

module.exports = { GENEROS_PADRAO, GENEROS_LIVROS_INICIAIS, mapearGeneros, garantirGeneros, semAcento };
