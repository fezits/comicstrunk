// Fix Portuguese accents in pt-BR.json translation file
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'apps', 'web', 'src', 'messages', 'pt-BR.json');
let content = fs.readFileSync(filePath, 'utf8');
const original = content;

// Ordered: longer patterns first to avoid partial matches
const fixes = [
  // ção / ções
  ['Configuracoes', 'Configurações'],
  ['configuracoes', 'configurações'],
  ['Notificacoes', 'Notificações'],
  ['notificacoes', 'notificações'],
  ['Avaliacoes', 'Avaliações'],
  ['avaliacoes', 'avaliações'],
  ['Informacoes', 'Informações'],
  ['informacoes', 'informações'],
  ['Transacoes', 'Transações'],
  ['transacoes', 'transações'],
  ['Comissoes', 'Comissões'],
  ['comissoes', 'comissões'],
  ['Administracao', 'Administração'],
  ['administracao', 'administração'],
  ['Contestacao', 'Contestação'],
  ['contestacao', 'contestação'],
  ['Movimentacao', 'Movimentação'],
  ['movimentacao', 'movimentação'],
  ['Organizacao', 'Organização'],
  ['organizacao', 'organização'],
  ['Atualizacao', 'Atualização'],
  ['atualizacao', 'atualização'],
  ['Solicitacao', 'Solicitação'],
  ['solicitacao', 'solicitação'],
  ['Confirmacao', 'Confirmação'],
  ['confirmacao', 'confirmação'],
  ['Classificacao', 'Classificação'],
  ['classificacao', 'classificação'],
  ['Publicacao', 'Publicação'],
  ['publicacao', 'publicação'],
  ['Informacao', 'Informação'],
  ['informacao', 'informação'],
  ['Avaliacao', 'Avaliação'],
  ['avaliacao', 'avaliação'],
  ['Descricao', 'Descrição'],
  ['descricao', 'descrição'],
  ['Transacao', 'Transação'],
  ['transacao', 'transação'],
  ['Operacao', 'Operação'],
  ['operacao', 'operação'],
  ['Aplicacao', 'Aplicação'],
  ['aplicacao', 'aplicação'],
  ['Alteracao', 'Alteração'],
  ['alteracao', 'alteração'],
  ['Exclusao', 'Exclusão'],
  ['exclusao', 'exclusão'],
  ['Solucao', 'Solução'],
  ['solucao', 'solução'],
  ['Mediacao', 'Mediação'],
  ['mediacao', 'mediação'],
  ['Condicao', 'Condição'],
  ['condicao', 'condição'],
  ['Colecao', 'Coleção'],
  ['colecao', 'coleção'],
  ['Edicoes', 'Edições'],
  ['edicoes', 'edições'],
  ['Edicao', 'Edição'],
  ['edicao', 'edição'],

  // ç
  ['Endereco', 'Endereço'],
  ['endereco', 'endereço'],
  ['Enderecos', 'Endereços'],
  ['enderecos', 'endereços'],
  ['Servicos', 'Serviços'],
  ['servicos', 'serviços'],
  ['Servico', 'Serviço'],
  ['servico', 'serviço'],
  ['Precos', 'Preços'],
  ['precos', 'preços'],
  ['Preco', 'Preço'],
  ['preco', 'preço'],

  // í
  ['Disponivel', 'Disponível'],
  ['disponivel', 'disponível'],
  ['Disponiveis', 'Disponíveis'],
  ['disponiveis', 'disponíveis'],
  ['Obrigatorio', 'Obrigatório'],
  ['obrigatorio', 'obrigatório'],
  ['Necessario', 'Necessário'],
  ['necessario', 'necessário'],
  ['Historico', 'Histórico'],
  ['historico', 'histórico'],
  ['Politicas', 'Políticas'],
  ['politicas', 'políticas'],
  ['Politica', 'Política'],
  ['politica', 'política'],
  ['Deposito', 'Depósito'],
  ['deposito', 'depósito'],
  ['Codigo', 'Código'],
  ['codigo', 'código'],
  ['Numero', 'Número'],
  ['numero', 'número'],
  ['Pagina', 'Página'],
  ['pagina', 'página'],
  ['Paginas', 'Páginas'],
  ['paginas', 'páginas'],
  ['Periodo', 'Período'],
  ['periodo', 'período'],
  ['Inicio', 'Início'],
  ['inicio', 'início'],
  ['Minimo', 'Mínimo'],
  ['minimo', 'mínimo'],
  ['Maximo', 'Máximo'],
  ['maximo', 'máximo'],
  ['Invalido', 'Inválido'],
  ['invalido', 'inválido'],
  ['Valido', 'Válido'],
  ['valido', 'válido'],
  ['Unico', 'Único'],
  ['unico', 'único'],
  ['Ultimo', 'Último'],
  ['ultimo', 'último'],
  ['Proximo', 'Próximo'],
  ['proximo', 'próximo'],
  ['Proxima', 'Próxima'],
  ['proxima', 'próxima'],

  // é
  ['Usuarios', 'Usuários'],
  ['usuarios', 'usuários'],
  ['Catalogo', 'Catálogo'],
  ['catalogo', 'catálogo'],
  ['Credito', 'Crédito'],
  ['credito', 'crédito'],
  ['Debito', 'Débito'],
  ['debito', 'débito'],
  ['Relatorio', 'Relatório'],
  ['relatorio', 'relatório'],
  ['Analise', 'Análise'],
  ['analise', 'análise'],
  ['Basico', 'Básico'],
  ['basico', 'básico'],
  ['basica', 'básica'],

  // ê
  ['Preferencias', 'Preferências'],
  ['preferencias', 'preferências'],
  ['Preferencia', 'Preferência'],
  ['preferencia', 'preferência'],
  ['Referencia', 'Referência'],
  ['referencia', 'referência'],

  // ú
  ['Conteudo', 'Conteúdo'],
  ['conteudo', 'conteúdo'],
  ['Duvida', 'Dúvida'],
  ['duvida', 'dúvida'],

  // á
  ['Bancarias', 'Bancárias'],
  ['bancarias', 'bancárias'],
  ['Bancaria', 'Bancária'],
  ['bancaria', 'bancária'],

  // Séries
  ['de Series', 'de Séries'],
  ['"Series"', '"Séries"'],

  // ã
  ['Tambem', 'Também'],
  ['tambem', 'também'],
  ['nao ', 'não '],
  ['Nao ', 'Não '],

  // Short words (careful with context)
  ['voce', 'você'],
  ['Voce', 'Você'],
  ['apos ', 'após '],
  ['ja ', 'já '],
];

let changed = 0;
for (const [from, to] of fixes) {
  const before = content;
  content = content.split(from).join(to);
  if (content !== before) {
    const occurrences = (before.split(from).length - 1);
    console.log(`  ${from} → ${to} (${occurrences}x)`);
    changed += occurrences;
  }
}

// Verify JSON still valid
try {
  JSON.parse(content);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`\nDone: ${changed} replacements. JSON valid.`);
} catch(e) {
  console.error('ERROR: JSON broken after replacements!', e.message);
  fs.writeFileSync(filePath, original, 'utf8');
  console.error('Reverted to original.');
  process.exit(1);
}
