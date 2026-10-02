# 🧠 agent-brain — Your Local Developer Knowledge Base

**agent-brain** es un "Segundo Cerebro" e instrumento de gestión del conocimiento diseñado para desarrolladores de software. Funciona 100% de manera local en Node.js mediante una interfaz interactiva de terminal (CLI), permitiéndote registrar, buscar, actualizar y eliminar fragmentos de código, errores solucionados, configuraciones de infraestructura, prompts de LLM y decisiones de arquitectura (ADR) aplicando principios como *Clean Code, KISS, DRY y YAGNI*.

---

## ✨ Características Principales

* **Búsqueda Híbrida Inteligente (RAG + Relacional):**
  * **Búsqueda Vectorial:** Utiliza embeddings locales para encontrar respuestas por similitud semántica.
  * **Filtro de Umbral de Distancia (1.15):** Evita devolver resultados irrelevantes o no relacionados.
* **Procesamiento de Código con AST:** Analiza automáticamente scripts JavaScript extrayendo importaciones, exportaciones y firmas de funciones con `Acorn`.
* **100% Local y Privado:** No requiere claves de API externas ni envío de datos a la nube. Los modelos de embeddings corren en local vía ejecuciones ONNX (`@xenova/transformers`).
* **Cero Compiladores C++:** Aprovecha el motor nativo `node:sqlite` de Node.js 22+, garantizando instalación limpia e instantánea sin errores de `node-gyp` o Visual Studio en Windows, Linux y macOS.
* **Gestión CRUD Completa en CLI:** Crea (`/ingest`), actualiza (`/update`) y elimina (`/delete`) notas de manera interactiva manteniendo la base relacional y la base vectorial sincronizadas de forma atómica.
* **Acceso Global via `npm link`:** Ejecutable desde cualquier directorio de tu terminal manteniendo la persistencia centralizada en el proyecto.

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología | Rol en la Arquitectura |
| :--- | :--- | :--- |
| **Entorno de Ejecución** | Node.js (v22+) | Motor principal en JavaScript puro (ES Modules). |
| **Base de Datos Relacional** | `node:sqlite` (Nativo) | Almacena notas, tags, metadatos y el grafo de relaciones. |
| **Base Vectorial** | `@lancedb/lancedb` | Base de datos vectorial embebida de alto rendimiento. |
| **Generador de Embeddings** | `@xenova/transformers` | Modelo local ONNX (`all-MiniLM-L6-v2`) para vectorizar texto. |
| **Parser AST** | `acorn` | Extrae metadatos estructurales de snippets de código. |
| **Interfaz CLI** | `@inquirer/prompts` | Menús flotantes, selecciones e ingreso de texto multilínea. |

---

## 🏗️ Arquitectura de Persistencia (`.agent_data/`)

Toda la información del sistema se guarda aislada en el directorio `.agent_data/` en la raíz del proyecto (resuelto dinámicamente mediante `import.meta.url`):

```text
.agent_data/
├── brain.db              # Base de datos relacional y grafo (SQLite)
├── lancedb_data/         # Tablas e índices vectoriales de LanceDB
└── models_cache/         # Caché local del modelo de embeddings ONNX (~90 MB)

```

> **Nota:** La carpeta `.agent_data/` está ignorada en `.gitignore` por defecto para proteger tu información privada. Si deseas migrar tu conocimiento a otra computadora, simplemente copia la carpeta `.agent_data/` completa a tu nuevo equipo.

---

## 🚀 Requisitos e Instalación

### Requisitos Previos

* **Node.js:** Versión `22.0.0` o superior.

### Pasos de Instalación y Configuración Global

1. Clona este repositorio o ubícate en la carpeta del proyecto:
```bash
git clone [https://github.com/josmejia2401dev/agent-brain.git](https://github.com/josmejia2401dev/agent-brain.git)
cd agent-brain

```


2. Instala las dependencias de Node.js:
```bash
npm install

```


3. Vincula el binario globalmente para ejecutarlo desde cualquier directorio:
```bash
npm link

```



*(En la primera ejecución, el sistema descargará el modelo de embeddings local a la carpeta de caché y creará automáticamente la estructura de datos).*

---

## 💻 Guía de Uso

Una vez ejecutado `npm link`, puedes abrir una nueva ventana de terminal en **cualquier carpeta de tu sistema** y lanzar la herramienta escribiendo:

```bash
agent-brain

```

*(O de forma local en el proyecto con `npm start`).*

### Interfaz interactiva

```text
======================================================
  🧠 AGENTE SEGUNDO CEREBRO - CONOCIMIENTO LOCAL (JS) 
  Toda la información reside en: .agent_data/*
  Escribe `/help` para ver los comandos disponibles.
======================================================

Agente> 

```

### Comandos Disponibles

| Comando | Descripción |
| --- | --- |
| `<texto libre>` | Realiza una consulta semántica en la base de datos (Ej: `error docker compose` o `JAXB IntelliJ`). |
| `/ingest` | Abre el formulario interactivo para registrar un nuevo conocimiento (Abre tu editor por defecto para textos o código multilínea). |
| `/update` | Permite buscar una nota existente, cargar sus datos previos en tu editor y actualizarla en SQLite y LanceDB. |
| `/delete` | Busca y elimina una nota de forma permanente de todas las bases de datos. |
| `/help` | Muestra la lista de comandos disponibles. |
| `/exit` o `exit` | Cierra la aplicación de forma limpia (también soportado con `Ctrl + C`). |

---

## 📋 Categorías de Conocimiento Soportadas (`item_type`)

Al registrar conocimiento mediante `/ingest`, puedes seleccionar entre las siguientes categorías:

* 🐛 **Bug / Error conocido:** Causa raíz, stacktrace y solución.
* 💻 **Código / Snippet Reutilizable:** Scripts con análisis AST automático.
* 📐 **Buena Práctica / Principio:** Clean Code, KISS, DRY, YAGNI, SOLID.
* 🚫 **Anti-Patrón:** Malas prácticas documentadas y sus consecuencias.
* 🤖 **Prompt de LLM Efectivo:** Prompts probados con modelos recomendados.
* 🏗️ **Decisión de Arquitectura (ADR):** Razones y contexto de decisiones técnicas.
* ⚙️ **Script / Config:** Archivos Docker, CI/CD, Nginx, Bash scripts.
* 🔥 **Post-Mortem de Incidente:** Análisis detallado de fallos en producción.

---

## ☁️ Respaldo y Migración (Drive)

Para respaldar tu base de conocimiento sin incluir los archivos pesados del modelo de IA (`models_cache`), puedes comprimir `.agent_data` excluyendo esa subcarpeta automáticamente:

### 1. Comprimir la carpeta `.agent_data` (Ignorando `models_cache`)

* **Windows (PowerShell):**
  ```powershell
  Get-ChildItem -Path .agent_data -Recurse | Where-Object { $_.FullName -notmatch 'models_cache' } | Compress-Archive -DestinationPath agent_data_backup.zip -Force
```

* **Linux / macOS:**
```bash
zip -r agent_data_backup.zip .agent_data -x "*.agent_data/models_cache*"
```

---

### 2. Restaurar en otro equipo

1. Sube el archivo `agent_data_backup.zip` a tu Google Drive.
2. En la nueva máquina, descarga y descomprime el archivo en la raíz del proyecto.
3. Asegúrate de que la carpeta descomprimida se llame `.agent_data`.
4. Ejecuta el agente:
```bash
agent-brain
```

*(El agente detectará que falta la carpeta `models_cache` y la descargará automáticamente en el primer arranque).*

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**.