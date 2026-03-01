# AI PR Reviewer

Acción de GitHub para revisar pull requests en proyectos con Astro / React / TypeScript usando la API de OpenAI.

**Qué hace**
- **Analiza** los diffs de archivos frontend (`.ts`, `.tsx`, `.js`, `.jsx`, `.astro`).
- **Publica comentarios** en la PR vinculados al commit actual (comentarios por línea).
- **Revisa comentarios previos**: marca threads como resueltos si la IA ya no detecta el problema, o añade un comentario si sigue presente.
- **Instala dependencias** de la acción en tiempo de ejecución (no requiere `dist/` ni `node_modules` versionado).

**Uso mínimo**
1. Publica esta acción en un repositorio (por ejemplo `OWNER/REPO`).
2. En cada repositorio consumidor añade un workflow que invoque la action en eventos `pull_request`.

Ejemplo de workflow (`.github/workflows/ai-review.yml`):

```yaml
name: AI PR Review
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  pull-requests: write
  contents: read

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run AI PR Reviewer
        uses: OWNER/REPO@main # reemplaza por tu repo/versión
        with:
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Inputs**
- `openai_api_key` (requerido): clave de OpenAI (usualmente desde `secrets.OPENAI_API_KEY`).
- `mode` (opcional): `frontend` (por defecto) o `fullstack`.

**Requisitos de permisos y tokens**
- `GITHUB_TOKEN` con permisos por defecto permite publicar comentarios y ejecutar consultas GraphQL para resolver threads. Asegúrate de que el workflow tiene `pull-requests: write` y `contents: read` en `permissions`.
- Añade `secrets.OPENAI_API_KEY` en cada repo consumidor.

**Comportamiento relevante**
- La acción crea comentarios con `commit_id` (SHA del head de la PR) para que queden asociados al commit actual.
- Para evitar duplicados, la acción comprueba comentarios existentes antes de publicar uno nuevo.
- Para resolver threads previos la acción usa la mutación GraphQL `markPullRequestReviewThreadResolved` usando `node_id` del comentario. Si por alguna razón no hay `node_id`, se deja un mensaje en logs.

**Archivo principal**
- El handler principal está en [index.js](index.js).

**Mejoras posibles**
- Afinar la heurística de "resuelto" realizando una comprobación del contenido del archivo en vez de sólo `file:line`.
- Añadir opción para reagrupar comentarios por hilo en lugar de comentar por línea.
- Registrar métricas o histograma de falsos positivos para ajustar prompts.

**Debug / ejecución local**
- Puedes ejecutar linters o tests locales, pero la action se valida mejor dentro de GitHub Actions en una PR de prueba.

Si quieres, actualizo este README con más ejemplos (p. ej. pinning de versión, CI matrix) o añado un script de prueba local.
