import { select, input, editor, confirm } from '@inquirer/prompts';

export class CliApp {
  constructor(ingestService, searchService, inboxService) {
    this.ingestService = ingestService;
    this.searchService = searchService;
    this.inboxService = inboxService;
  }

  printHelp() {
    console.log('\n======================================================');
    console.log('  📖 COMANDOS DISPONIBLES EN EL AGENTE');
    console.log('======================================================');
    console.log('  • <texto>      -> Realizar búsqueda semántica/relacional');
    console.log('  • `/ingest`    -> Registrar nueva nota de conocimiento');
    console.log('  • `/update`    -> Buscar y modificar una nota existente');
    console.log('  • `/delete`    -> Buscar y eliminar una nota de la BD');
    console.log('  • `/index`     -> Re-indexa todas las notas de SQLite hacia la base vectorial (LanceDB)');
    console.log('  • `/delete`    -> Buscar y eliminar una nota de la BD');
    console.log('  • `/sync`      -> Sincroniza archivos .md desde .agent_data/inbox/'); // <-- AGREGAR ESTA LÍNEA
    console.log('  • `/help`      -> Mostrar esta ayuda de comandos');
    console.log('  • `/exit`      -> Salir de la aplicación (o escribe `exit`)');
    console.log('======================================================\n');
  }

  async runIngestFlow() {
    console.log('\n--- 📥 NUEVO REGISTRO DE CONOCIMIENTO ---');

    const item_type = await select({
      message: '¿Qué tipo de información vas a documentar?',
      choices: [
        { name: '🐛 Bug / Error conocido', value: 'bug_error' },
        { name: '💻 Código / Snippet Reutilizable', value: 'code_snippet' },
        { name: '📐 Buena Práctica / Principio (Clean Code, KISS, DRY)', value: 'best_practice' },
        { name: '🚫 Anti-Patrón (Lo que NO debes hacer)', value: 'anti_pattern' },
        { name: '🤖 Prompt de LLM Efectivo', value: 'prompt_template' },
        { name: '🏗️ Decisión de Arquitectura (ADR)', value: 'architecture_adr' },
        { name: '⚙️ Script / Config (Docker, Bash, CI/CD)', value: 'config_script' },
        { name: '🔥 Post-Mortem de Incidente', value: 'post_mortem' }
      ]
    });

    const title = await input({ message: 'Título descriptivo:' });
    const summary = await input({ message: 'Resumen corto:' });
    const language_tech = await input({ message: 'Tecnología/Lenguaje (ej: javascript, bash, docker):', default: 'javascript' });

    const content = await editor({
      message: 'Se abrirá tu editor. Pega todo el contenido, guarda (Ctrl+S) y cierra la ventana:'
    });

    const metadata = {};
    if (item_type === 'bug_error') {
      metadata.stack_trace = await input({ message: 'Stacktrace o mensaje de error exacto (opcional):' });
      metadata.root_cause = await input({ message: 'Causa raíz identificada:' });
    } else if (item_type === 'anti_pattern') {
      metadata.consequence = await input({ message: '¿Qué problema causa este anti-patrón?:' });
    } else if (item_type === 'prompt_template') {
      metadata.target_model = await input({ message: 'Modelo recomendado (ej: GPT-4o, Claude 3.5):' });
    }

    const tagsInput = await input({ message: 'Etiquetas/Tags separadas por coma (ej: Docker, CLI, Syntax):' });
    const tags = tagsInput.split(',').map(t => ({ name: t.trim(), category: 'topic' })).filter(t => t.name);

    console.log('\n⏳ Generando vectores y guardando en SQLite + LanceDB...');
    const id = await this.ingestService.ingest({
      item_type,
      title,
      summary,
      content,
      language_tech,
      metadata,
      tags
    });

    console.log(`\n✅ ¡Conocimiento guardado con éxito! [ID: ${id}]\n`);
  }

  async runDeleteFlow() {
    console.log('\n--- 🗑️ ELIMINAR REGISTRO ---');
    const query = await input({ message: 'Busca la nota que deseas eliminar:' });
    const searchResult = await this.searchService.search(query, 5);

    if (!searchResult.found) {
      console.log('❌ No se encontraron notas con esa búsqueda.\n');
      return;
    }

    const targetId = await select({
      message: 'Selecciona la nota que deseas ELIMINAR permanentemente:',
      choices: searchResult.matches.map(item => ({
        name: `[${item.item_type}] ${item.title}`,
        value: item.id
      }))
    });

    const sure = await confirm({ message: '¿Estás seguro de eliminar este registro?', default: false });
    if (sure) {
      console.log('⏳ Eliminando registro de SQLite y LanceDB...');
      await this.ingestService.delete(targetId);
      console.log('✅ Registro eliminado correctamente.\n');
    } else {
      console.log('🚫 Operación cancelada.\n');
    }
  }

  async runUpdateFlow() {
    console.log('\n--- ✏️ ACTUALIZAR REGISTRO ---');
    const query = await input({ message: 'Busca la nota que deseas actualizar:' });
    const searchResult = await this.searchService.search(query, 5);

    if (!searchResult.found) {
      console.log('❌ No se encontraron notas con esa búsqueda.\n');
      return;
    }

    const selectedItem = await select({
      message: 'Selecciona la nota a actualizar:',
      choices: searchResult.matches.map(item => ({
        name: `[${item.item_type}] ${item.title}`,
        value: item
      }))
    });

    console.log(`\nModificando: ${selectedItem.title}`);
    const title = await input({ message: 'Nuevo Título:', default: selectedItem.title });
    const summary = await input({ message: 'Nuevo Resumen:', default: selectedItem.summary || '' });
    const language_tech = await input({ message: 'Tecnología/Lenguaje:', default: selectedItem.language_tech || 'markdown' });

    const content = await editor({
      message: 'Edita el contenido en tu editor, guarda (Ctrl+S) y cierra:',
      default: selectedItem.content
    });

    const currentTags = selectedItem.tags ? selectedItem.tags.map(t => t.name).join(', ') : '';
    const tagsInput = await input({ message: 'Etiquetas/Tags:', default: currentTags });
    const tags = tagsInput.split(',').map(t => ({ name: t.trim(), category: 'topic' })).filter(t => t.name);

    console.log('⏳ Sincronizando cambios en SQLite y re-vectorizando en LanceDB...');
    await this.ingestService.update(selectedItem.id, {
      item_type: selectedItem.item_type,
      title,
      summary,
      content,
      language_tech,
      metadata: selectedItem.metadata,
      tags
    });

    console.log('✅ Nota actualizada y re-indexada con éxito.\n');
  }

  async handleQuery(query) {
    console.log(`\n🔍 Buscando en tu base de datos local...`);
    const result = await this.searchService.search(query);

    if (!result.found) {
      console.log('\n⚠️ No se encontró solución o patrón exacto en tu base de datos.');
      console.log('💡 Tip: Puedes ejecutar `/ingest` para registrar este problema una vez lo resuelvas.\n');
      return;
    }

    console.log(`\n🎉 Se encontraron ${result.matches.length} coincidencia(s) relevante(s):\n`);

    // En src/Cli.js dentro de handleQuery(query)

    result.matches.forEach((item, idx) => {
      const rerankScore = item._rerankScore != null
        ? ` | Relevancia Reranker: ${(item._rerankScore * 100).toFixed(1)}%`
        : '';

      const vectorDist = item._distance != null
        ? ` | Distancia Vectorial: ${item._distance.toFixed(3)}`
        : '';

      console.log(`--------------------------------------------------`);
      console.log(`[${idx + 1}] ${item.title.toUpperCase()} (${item.item_type})`);
      console.log(`🔍 Motor/Origen: ${item._source}${rerankScore}${vectorDist}`);
      console.log(`📌 Resumen: ${item.summary || 'Sin resumen'}`);
      console.log(`🛠️ Tech: ${item.language_tech}`);

      if (item.tags?.length) {
        console.log(`🏷️ Tags: ${item.tags.map(t => t.name).join(', ')}`);
      }

      console.log(`\n📄 Contenido:\n${item.content}\n`);
    });

    console.log(`--------------------------------------------------\n`);
  }

  async handleReindexFlow() {
    console.log('\n🔄 Iniciando re-indexación vectorial completa desde SQLite...');
    const startTime = Date.now();

    try {
      const result = await this.ingestService.reindexAll();
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      if (result.count === 0) {
        console.log('⚠️ No hay notas en la base de datos relacional para indexar.');
      } else {
        console.log(`✅ ¡Re-indexación completada exitosamente!`);
        console.log(`📊 Total de notas procesadas: ${result.count}`);
        console.log(`⏱️ Tiempo transcurrido: ${duration}s\n`);
      }
    } catch (error) {
      console.error('❌ Error durante la re-indexación:', error.message);
    }
  }

  async runSyncFlow() {
    console.log('\n---   SINCRONIZACIÓN POR LOTES (INBOX) ---');

    const files = this.inboxService.getPendingFiles();

    if (files.length === 0) {
      console.log(`  No hay archivos .md pendientes.\n`);
      return;
    }

    console.log(`  Se encontraron ${files.length} archivo(s) para procesar.\n`);

    for (const filePath of files) {
      const parsedData = this.inboxService.parseFile(filePath);

      if (!parsedData) {
        // Solo extraemos el nombre para mostrar el error más limpio
        const fileName = filePath.split(/[\\/]/).pop();
        console.log(`  [Advertencia] El archivo ${fileName} no tiene un formato válido. Omitiendo.\n`);
        continue;
      }

      console.log(`  Procesando: ${parsedData.fileName}...`);
      // EXTRAEMOS 'metadata' de parsedData
      const { operation, title, item_type, content, tech, tags, metadata } = parsedData;

      let success = false;

      if (operation === 'insert') {
        // INYECTAMOS la variable metadata
        await this.ingestService.ingest({ item_type, title, summary: '', content, language_tech: tech, metadata, tags });
        console.log(`    Insertado correctamente.`);
        success = true;
      } else if (operation === 'update' || operation === 'delete') {
        const searchResult = await this.searchService.search(title, 10);
        const matches = searchResult.matches.filter(m => m.title.toLowerCase() === title.toLowerCase());

        if (matches.length === 0) {
          if (operation === 'delete') {
            console.log(`    La nota "${title}" ya no existe en BD. Archivo limpiado.`);
            this.inboxService.deleteFile(filePath);
          } else {
            console.log(`    [Advertencia] No se encontró nota con título exacto "${title}" para actualizar. Omitiendo.`);
          }
          continue;
        }

        let targetId = matches[0].id;
        let selectedItem = matches[0];

        if (matches.length > 1) {
          console.log(`    Se encontraron múltiples notas con el título "${title}".`);
          const choice = await select({
            message: `Selecciona la nota que deseas ${operation.toUpperCase()}:`,
            choices: matches.map(item => ({ name: `[${item.item_type}] ${item.title} (ID: ${item.id})`, value: item }))
          });
          targetId = choice.id;
          selectedItem = choice;
        }

        if (operation === 'update') {
          await this.ingestService.update(targetId, {
            item_type: item_type || selectedItem.item_type,
            title: title || selectedItem.title,
            summary: selectedItem.summary,
            content: content,
            language_tech: tech || selectedItem.language_tech,
            // MEZCLAMOS los metadatos nuevos con los preexistentes
            metadata: { ...selectedItem.metadata, ...metadata },
            tags: tags.length > 0 ? tags : selectedItem.tags
          });
          console.log(`    Actualizado correctamente.`);
          success = true;
        } else if (operation === 'delete') {
          await this.ingestService.delete(targetId);
          console.log(`    Eliminado correctamente.`);
          success = true;
        }
      }

      // ELIMINAR el archivo solo si se procesó de forma exitosa
      if (success) {
        this.inboxService.deleteFile(filePath);
      }
    }

    console.log(`\n  Sincronización completada.\n`);
  }

  async start() {
    // Escuchar evento SIGINT global (Ctrl + C)
    process.on('SIGINT', () => {
      console.log('\n\n¡Hasta luego!');
      process.exit(0);
    });

    console.log('\n======================================================');
    console.log('  🧠 AGENTE SEGUNDO CEREBRO - CONOCIMIENTO LOCAL (JS) ');
    console.log('  Toda la información reside en: .agent_data/*');
    console.log('  Escribe `/help` para ver los comandos disponibles.');
    console.log('======================================================\n');

    while (true) {
      try {
        const inputStr = await input({ message: 'Agente>' });
        const trimmed = inputStr.trim();

        if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === '/exit') {
          console.log('¡Hasta luego!');
          process.exit(0);
        } else if (trimmed.toLowerCase() === 'clear' || trimmed.toLowerCase() === 'cls') {
          // \x1B[2J borra la pantalla completa
          // \x1B[3J borra el buffer de scrollback (el historial hacia arriba)
          // \x1B[H mueve el cursor a la posición inicial (arriba a la izquierda)
          process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
          console.clear();
        } else if (trimmed === '/index') {
          await this.handleReindexFlow();
        } else if (trimmed === '/sync') {
          await this.runSyncFlow();
        } else if (trimmed === '/ingest') {
          await this.runIngestFlow();
        } else if (trimmed === '/update') {
          await this.runUpdateFlow();
        } else if (trimmed === '/delete') {
          await this.runDeleteFlow();
        } else if (trimmed === '/help') {
          this.printHelp();
        } else if (trimmed.length > 0) {
          await this.handleQuery(trimmed);
        }
      } catch (error) {
        // Capturar cancelación forzada con Ctrl + C lanzada por @inquirer/prompts
        if (
          error.name === 'ExitPromptError' ||
          error.name === 'UserForceClosedError' ||
          error.message?.includes('User force closed')
        ) {
          console.log('\n\n¡Hasta luego!');
          process.exit(0);
        }
        console.error('❌ Error no esperado en la consola:', error.message);
      }
    }
  }
}