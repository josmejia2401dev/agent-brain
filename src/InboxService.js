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

        // Buscamos la posición exacta donde inicia la propiedad "content:"
        const contentIdx = contentStr.indexOf('content:');

        let headerText = contentStr;
        let rawContent = '';

        if (contentIdx !== -1) {
            headerText = contentStr.slice(0, contentIdx);
            // Extraemos todo lo que esté después de "content:"
            rawContent = contentStr.slice(contentIdx + 'content:'.length).trim();
        }

        // Parsear los metadatos (todo lo que está antes de content:)
        const data = {};
        headerText.split('\n').forEach(line => {
            const separatorIdx = line.indexOf(':');
            if (separatorIdx > 0) {
                const key = line.slice(0, separatorIdx).trim().toLowerCase();
                const value = line.slice(separatorIdx + 1).trim();
                if (key) {
                    data[key] = value;
                }
            }
        });

        // Limpieza del contenido: remover comillas invertidas únicamente si envuelven el texto
        let contentValue = rawContent;
        if (contentValue.startsWith('```') && contentValue.endsWith('```')) {
            contentValue = contentValue.slice(3, -3).trim();
        } else if (contentValue.startsWith('`') && contentValue.endsWith('`')) {
            contentValue = contentValue.slice(1, -1).trim();
        }

        // Validar si logró extraer datos útiles
        if (Object.keys(data).length === 0) return null;

        const standardKeys = ['operation', 'title', 'summary', 'item_type', 'tech', 'tags'];
        const metadata = {};

        // Todo lo adicional va a metadatos dinámicos
        Object.keys(data).forEach(key => {
            if (!standardKeys.includes(key)) {
                metadata[key] = data[key];
            }
        });

        return {
            operation: (data.operation || 'insert').toLowerCase(),
            title: data.title || 'Sin título',
            summary: data.summary || '',
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