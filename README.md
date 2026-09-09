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
- **Desplegado y verificado en Vercel** con la clave real de Anthropic: `web_fetch` lee de
  verdad el menú de un link externo (ver [`corridas/corrida-1-mision.json`](corridas/corrida-1-mision.json),
  costo real US$ 0,0199 con `claude-haiku-4-5`).
- **Modo Foto validado con un caso real de menú de varias hojas**: hasta 5 fotos JPEG por
  corrida (comprimidas en el navegador antes de mandarlas, para no chocar con el límite de
  tamaño de Vercel), leídas con visión nativa de Claude (ver
  [`corridas/corrida-2-il-giardino.json`](corridas/corrida-2-il-giardino.json), costo real
  US$ 0,0109 con `claude-haiku-4-5`).
- El encabezado del bloque de comida varía entre corridas (elección acotada del modelo entre 5
  frases aprobadas, no texto libre) en vez de salir siempre igual.
- Cuando no hay un precio real para un plato/trago, el sistema lo menciona igual sin precio en
  vez de inventar un número o esconderlo (`precio: null` en el JSON estructurado).
- **Las 3 corridas reales exigidas están completas**: Misión (Link), Il Giardino (Foto, 5
  imágenes) y [Victoria Brown](corridas/corrida-3-victoria-brown.json) (Link) — esta última
  mostró además al sistema usando el campo `advertencias` correctamente: cuando la dirección
  cargada a mano no coincidía con la del menú online, avisó la discrepancia en vez de mezclar
  los datos o inventar cuál era la correcta.

## Qué falta o qué falló

*(Se actualiza a medida que se completan los puntos pendientes de `DECISIONES.md`.)*

- Las 3 corridas reales exigidas ya están corridas y guardadas en `corridas/`. El modelo por
  defecto (`claude-haiku-4-5`) resultó preciso leyendo platos y precios reales en las 3 (tanto
  de links como de fotos) — ningún error de precisión de lectura, todos los bugs encontrados
  fueron de diseño del contrato o del schema (ver abajo).
- Encontrados y corregidos varios bugs reales durante las pruebas en producción — el detalle
  completo de cada uno está en `DECISIONES.md` (capítulos 7 a 16): `web_fetch` necesitaba
  `allowed_callers: ["direct"]` con Haiku 4.5; el alfabeto Unicode del título en negrita no
  soporta vocales acentuadas ni Ñ; el modo Foto solo aceptaba una imagen (los menús reales
  tienen varias hojas); Vercel corta cualquier request a 4.5 MB (fotos de celular sin comprimir
  la superaban); un precio inventado que resultó ser una **contaminación del few-shot** (copiado
  textual de uno de los ejemplos del contrato) y que, incluso después de prohibirlo
  explícitamente, se seguía inventando porque el JSON Schema exigía un precio como string
  obligatorio — la regla vivía en el prompt pero la obligación real vivía en la estructura de
  datos, y hubo que arreglar el schema, no solo el texto; y un horario inventado en la sección
  de datos operativos (agregó un día que no estaba en la fuente real).
- Faltan las secciones de análisis económico (proyección semanal/anual) y de gobierno y riesgo,
  y confirmar la elección de modelo por escrito con la evidencia ya reunida.

## Qué aprendí

*(Se completa al cierre, con las 5 líneas honestas que pide el formato — después de correr las
corridas reales y ver qué de todo esto sostiene y qué no.)*
