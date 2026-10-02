import * as acorn from 'acorn';

export function parseJsAst(codeContent) {
  const metadata = { exports: [], imports: [], functions: [], classes: [], dependencies: [] };
  try {
    const ast = acorn.parse(codeContent, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowHashBang: true
    });
    for (const node of ast.body) {
      if (node.type === 'ImportDeclaration') {
        const dep = node.source.value;
        metadata.imports.push(dep);
        if (!dep.startsWith('.') && !dep.startsWith('/')) {
          metadata.dependencies.push(dep);
        }
      }
      if (node.type === 'ExportNamedDeclaration' && node.declaration?.id) {
        metadata.exports.push(node.declaration.id.name);
      }
      if (node.type === 'FunctionDeclaration' && node.id) {
        metadata.functions.push(node.id.name);
      }
      if (node.type === 'ClassDeclaration' && node.id) {
        metadata.classes.push(node.id.name);
      }
    }
  } catch {
    // Si no es un módulo válido JS, retorna estructuras vacías de forma segura
  }
  return metadata;
}