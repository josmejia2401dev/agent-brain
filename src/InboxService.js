import fs from 'node:fs';
import path from 'node:path';

export class InboxService {
    constructor(inboxDir) {
        this.inboxDir = inboxDir;
        if (!fs.existsSync(this.inboxDir)) {
            fs.mkdirSync(this.inboxDir, { recursive: true });
        }
    }

    // Ahora soporta múltiples extensiones (.md, .txt, .agent)
    getPendingFiles() {
        return fs.readdirSync(this.inboxDir)
            .filter(file => file.endsWith('.md') || file.endsWith('.txt') || file.endsWith('.agent'))
            .map(file => path.join(this.inboxDir, file));
    }

    parseFile(filePath) {
        const contentStr = fs.readFileSync(filePath, 'utf-8');
        
        // 1. Capturamos todo lo que esté dentro de los backticks de la variable "content:"
        // [\s\S]*? captura cualquier caracter incluyendo saltos de línea hasta el cierre del backtick
        const contentMatch = contentStr.match(/content:\s*`([\s\S]*?)`/);
        const contentValue = contentMatch ? contentMatch[1].trim() : '';

        // 2. Retiramos temporalmente el bloque del content para parsear las llaves simples
        // de forma segura, evitando que un ':' dentro de tu código rompa la lectura.
        const textWithoutContent = contentStr.replace(/content:\s*`[\s\S]*?`/, '');

        const data = {};
        textWithoutContent.split('\n').forEach(line => {
            const separatorIdx = line.indexOf(':');
            if (separatorIdx > 0) {
                const key = line.slice(0, separatorIdx).trim().toLowerCase();
                const value = line.slice(separatorIdx + 1).trim();
                if (key && key !== 'content') {
                    data[key] = value;
                }
            }
        });

        // Validar si logró extraer datos útiles
        if (Object.keys(data).length === 0) return null;

        const standardKeys = ['operation', 'title', 'item_type', 'tech', 'tags'];
        const metadata = {};

        // Todo lo adicional va a los metadatos dinámicos
        Object.keys(data).forEach(key => {
            if (!standardKeys.includes(key)) {
                metadata[key] = data[key];
            }
        });

        return {
            operation: (data.operation || 'insert').toLowerCase(),
            title: data.title || 'Sin título',
            item_type: data.item_type || 'code_snippet',
            tech: data.tech || 'markdown',
            tags: (data.tags || '').split(',').map(t => ({ name: t.trim(), category: 'topic' })).filter(t => t.name),
            metadata: metadata,
            content: contentValue,
            originalPath: filePath,
            fileName: path.basename(filePath)
        };
    }

    deleteFile(filePath) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}