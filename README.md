# Generador de copies para @barescopados — sistema agéntico (trabajo final)

**Materia:** Programación de y con Agentes de IA — MBA UCEMA.
**Es la versión final de la [Entrega 1](DECISIONES.md#capítulo-1--entrega-1-gemini-sin-backend)**
(mismo repo, renombrado): un agente real con contrato, herramienta, salida estructurada,
supervisión y backend — no un HTML que llama a una API desde el navegador.

Estructura del repo:
- `README.md` — este archivo.
- `prompts/` — [`system_prompt.md`](prompts/system_prompt.md) (contrato, 6 piezas) y
  [`user_prompt.md`](prompts/user_prompt.md) (plantilla del pedido).
- `api/generar-copy.js` — backend serverless (Vercel), el único lugar con la API key.
- `corridas/` — evidencia de las corridas reales.
- `DECISIONES.md` — la historia completa del proceso, incluida la Entrega 1 y el feedback
  del profesor en clase que motivó este rediseño.

## Qué construí

Un sistema que genera el copy de Instagram de @barescopados a partir de datos reales de una
visita (nombre del lugar, speech grabado, menú por link/foto/texto), con:

- **Contrato explícito** (`prompts/system_prompt.md`): rol, objetivo, contexto, restricciones,
  ejemplos y formato de salida, separado del pedido puntual (`user_prompt.md`).
- **Backend propio** (`api/generar-copy.js`, función serverless en Vercel) que es el único
  lugar donde vive la clave de la API de Claude — el navegador nunca la ve.
- **Herramienta real**: `web_fetch` para leer el menú cuando se carga por link, y visión
  nativa de Claude para leerlo cuando se carga por foto.
- **Salida estructurada**: el modelo devuelve JSON (schema fijo), y el backend arma el texto
  final del copy de forma determinística (incluida la negrita unicode del título) — no depende
  de que el modelo escriba bien el formato cada vez.

## Cómo se lo pedí

Instrucciones principales, en orden, dadas a Claude Code:

1. Retomar la Entrega 1 (generador de copies para @barescopados) y convertirla en el trabajo
   final, aplicando el feedback del profesor: *"Validá nuevamente el modo con foto y la
   repetición del flujo completo, y evitá exponer claves o credenciales desde el navegador."*
2. Decisión de costo: esta vez sí pagar la API de Claude (en la Entrega 1 se había descartado
   por costo y se usó Gemini gratis).
3. Seguir en el mismo repo (renombrado a `Repo-Yanina-Navarro-ExamenFinal`) en vez de empezar
   uno nuevo, para conservar la historia real de commits.
4. Reescribir el contrato con las seis piezas de prompt engineering vistas en la materia
   (rol, objetivo, contexto, restricciones, ejemplos, formato de salida).
5. Pedido puntual de ajuste al contrato: si el menú no tiene la bebida exacta que se tomó en
   la visita, no inventarla ni omitirla — usar el nombre genérico de la categoría + "desde $X"
   con el precio más bajo real de esa categoría (ver `DECISIONES.md`, capítulo 4).
6. Diseñar la arquitectura para sacar la clave del navegador: backend serverless en Vercel,
   con `ANTHROPIC_API_KEY` como variable de entorno del servidor.

*(El detalle completo de cada iteración y por qué se tomó cada decisión está en
[`DECISIONES.md`](DECISIONES.md), no repetido acá.)*

## Qué funciona

- Contrato completo y versionado en `prompts/`.
- Backend (`api/generar-copy.js`) que arma la llamada a Claude con `web_fetch` (modo link),
  visión (modo foto) o texto plano (modo texto pegado), fuerza salida JSON estructurada vía
  `output_config.format`, y devuelve el copy ya renderizado más el costo real de la corrida
  (tokens de entrada/salida y USD estimado) para poder auditar el gasto corrida por corrida.
- Frontend (`index.html` / `script.js`) actualizado para llamar a `/api/generar-copy` en vez
  de a Gemini directo — ya no pide ni guarda ninguna clave en el navegador.
- Botón "Guardar esta corrida": descarga automáticamente entrada + salida + fecha en el
  formato que exige `corridas/`, sin copiar/pegar a mano.

## Qué falta o qué falló

*(Se actualiza a medida que se completan los puntos pendientes de `DECISIONES.md`.)*

- Todavía no se corrieron las 3 corridas reales exigidas por la consigna, ni se probó el modo
  Foto con un caso real (el pendiente que dejó abierto la Entrega 1).
- Todavía no se decidió el modelo con evidencia real (Haiku 4.5 vs. Sonnet 4.6) — el backend
  usa Haiku 4.5 por defecto, a confirmar o corregir tras la primera corrida real.
- Todavía no está desplegado en Vercel ni verificado con la clave real de Anthropic.
- Faltan las secciones de análisis económico (proyección semanal/anual) y de gobierno y riesgo.

## Qué aprendí

*(Se completa al cierre, con las 5 líneas honestas que pide el formato — después de correr las
corridas reales y ver qué de todo esto sostiene y qué no.)*
