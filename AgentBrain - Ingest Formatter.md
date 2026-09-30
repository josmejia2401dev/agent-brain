### 📋 Plantilla de Prompt (Copia y pega esto en la IA)

```text
Actúa como un arquitecto de software y redactor técnico experto especializado en estructurar conocimiento para el sistema "agent-brain".

Tu tarea es analizar la información en bruto que te proporcionaré al final (que puede ser un log de error, un código, una explicación, una guía o un prompt) y convertirla en una nota de documentación optimizada para el comando `/ingest`.

Debes catalogar el contenido y entregar la respuesta con la siguiente estructura exacta para que pueda copiar y pegar fácilmente en la terminal:

1. **Tipo de información:** [Elige una opción exacta entre:
   - 🐛 Bug / Error conocido
   - 💻 Código / Snippet Reutilizable
   - 📐 Buena Práctica / Principio (Clean Code, KISS, DRY)
   - 🚫 Anti-Patrón (Lo que NO debes hacer)
   - 🤖 Prompt de LLM Efectivo
   - 🏗️ Decisión de Arquitectura (ADR)
   - ⚙️ Script / Config (Docker, Bash, CI/CD)
   - 🔥 Post-Mortem de Incidente]

2. **Título descriptivo:** [Título claro, específico y optimizado para búsqueda semántica]

3. **Resumen corto:** [Máximo 2 oraciones resumiendo qué resuelve o abarca esta nota]

4. **Tecnología/Lenguaje:** [Ejemplo: docker, java, javascript, bash, spring-boot]

5. **Contenido principal (Markdown para el editor):**
```markdown
[Escribe aquí todo el contenido estructurado en Markdown limpio. Usa títulos ##, listas, notas y bloques de código con su respectivo lenguaje (```bash, ```java, etc.). Incluye secciones como: Problema, Solución, Pasos o Código].

```

6. **Campos adicionales según el tipo:**
* Si es Bug/Error -> **Causa raíz identificada:** [Explicación breve]
* Si es Bug/Error -> **Stacktrace o mensaje exacto:** [Mensaje de error limpio]
* Si es Anti-Patrón -> **Consecuencia:** [Problema que genera]
* Si es Prompt de LLM -> **Modelo recomendado:** [Ej: GPT-4o, Claude 3.5]


7. **Etiquetas/Tags:** [Entre 3 y 6 tags relevantes separadas por comas. Ej: Docker, CLI, Syntax, Java]

---

INFORMACIÓN EN BRUTO PARA CLASIFICAR Y FORMATO:
[PEGA AQUÍ TU TEXTO, LOG DE ERROR, CÓDIGO O GUÍA]

