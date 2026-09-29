# 🧠 DevLore — Your Local Developer Knowledge Base

**AgentBrian** es un "Segundo Cerebro" e instrumento de gestión del conocimiento diseñado para desarrolladores de software. Funciona 100% de manera local en Node.js mediante una interfaz interactiva de terminal (CLI), permitiéndote registrar, buscar y reutilizar fragmentos de código, errores solucionados, soluciones de infraestructura, prompts de LLM y decisiones de arquitectura (ADR) aplicando principios como *Clean Code, KISS, DRY y YAGNI*.

---

## ✨ Características Principales

* **Búsqueda Híbrida Inteligente (RAG + Relacional):**
  * **Búsqueda Vectorial:** Utiliza embeddings locales para encontrar respuestas por similitud semántica.
  * **Filtro de Umbral de Distancia:** Evita devolver resultados irrelevantes o no relacionados.
* **Procesamiento de Código con AST:** Analiza automáticamente scripts JavaScript extrayendo importaciones, exportaciones y firmas de funciones con `Acorn`.
* **100% Local y Privado:** No requiere claves de API externas ni envío de datos a la nube. Los modelos de embeddings corren en local vía ejecuciones ONNX (`@xenova/transformers`).
* **Cero Compiladores C++:** Aprovecha el motor nativo `node:sqlite` de Node.js 22+, garantizando instalación limpia e instantánea sin errores de `node-gyp` o Visual Studio en Windows, Linux y macOS.
* **Gestión CRUD Completa en CLI:** Crea, actualiza y elimina notas de manera interactiva manteniendo la base relacional y la base vectorial sincronizadas de forma atómica.

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

Toda la información del sistema se guarda aislada en el directorio `.agent_data/` en la raíz del proyecto:

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

### Pasos de Instalación

1. Clona este repositorio o copia los archivos del proyecto:
```bash
git clone [https://github.com/josmejia2401dev/agent-brian.git](https://github.com/josmejia2401dev/agent-brian.git)
cd devlore

```


2. Instala las dependencias de Node.js:
```bash
npm install

```


3. Inicia la aplicación:
```bash
npm start

```



*(En la primera ejecución, el sistema descargará el modelo de embeddings local a la carpeta de caché y creará automáticamente la estructura de datos).*

---

## 💻 Guía de Uso

Una vez iniciada la aplicación, interactúas mediante la consola del agente:

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

## 📁 Estructura del Proyecto

```text
.
├── .gitignore
├── package.json
├── index.js                  # Punto de entrada y arranque de servicios
└── src/
    ├── config.js             # Configuración centralizada de rutas y modelos
    ├── Database.js           # Administrador SQLite nativo (node:sqlite)
    ├── Embeddings.js         # Servicio de generación de vectores (Xenova)
    ├── VectorStore.js        # Administrador de búsquedas en LanceDB
    ├── CodeParser.js         # Extractor AST para JavaScript (Acorn)
    ├── IngestService.js      # Orquestador CRUD (SQLite + LanceDB)
    ├── SearchService.js      # Servicio de búsqueda semántica con umbral de distancia
    └── Cli.js                # Interfaz de consola interactiva (@inquirer/prompts)

```

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Siéntete libre de modificarlo, extenderlo o adaptarlo a tus flujos de trabajo diarios.