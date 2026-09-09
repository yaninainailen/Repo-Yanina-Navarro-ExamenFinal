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
- `DECISIONES.md` — la historia completa del proceso (17 capítulos, incluida la Entrega 1 y el
  feedback del profesor en clase que motivó este rediseño), más las secciones de **Análisis
  económico** y **Gobierno y riesgo** que pide la consigna del trabajo final.

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
- **Elección de modelo confirmada con evidencia**: `claude-haiku-4-5` no cometió ningún error de
  precisión en las 3 corridas reales — se queda como modelo por defecto (ver `DECISIONES.md`,
  capítulo 17). Con Sonnet 4.6 el costo se triplicaría sin ninguna mejora observada que lo
  justifique.
- **Análisis económico y Gobierno y riesgo** completos en `DECISIONES.md`: costo real ≈ US$ 0,019
  por corrida en uso normal, proyección de ≈ US$ 1-2 al año al ritmo real de la cuenta; niveles
  de supervisión L0-L4 definidos, con el sistema ubicado en L2 (agente con herramientas, pero
  ninguna salida se publica sin lectura humana previa).

## Qué falta o qué falló

*(Los 6 requisitos de la consigna están cubiertos. Esto es lo que falló en el camino y cómo se
resolvió — el detalle completo, capítulo por capítulo, está en `DECISIONES.md`.)*

- Encontrados y corregidos varios bugs reales durante las pruebas en producción: `web_fetch`
  necesitaba `allowed_callers: ["direct"]` con Haiku 4.5; el alfabeto Unicode del título en
  negrita no soporta vocales acentuadas ni Ñ; el modo Foto solo aceptaba una imagen (los menús
  reales tienen varias hojas); Vercel corta cualquier request a 4.5 MB (fotos de celular sin
  comprimir la superaban); un precio inventado que resultó ser una **contaminación del
  few-shot** (copiado textual de uno de los ejemplos del contrato) y que, incluso después de
  prohibirlo explícitamente, se seguía inventando porque el JSON Schema exigía un precio como
  string obligatorio — la regla vivía en el prompt pero la obligación real vivía en la
  estructura de datos; y un horario inventado en la sección de datos operativos (agregó un día
  que no estaba en la fuente real).
- No se llegó a correr una corrida guardada en modo Texto (las 3 exigidas cubrieron Link y Foto)
  — el modo existe y funciona (usado también como fallback interno), pero no tiene evidencia
  propia en `corridas/`.
- La falla de `web_fetch` sin precios utilizables (contemplada en el contrato, cae en
  `advertencias`) nunca se dio en una corrida real — es un camino del código probado por
  inspección, no por un caso real todavía.

## Qué aprendí

- **Aprendí el stack, no solo el prompt.** Entrar a Vercel, entender qué es una función
  serverless y una variable de entorno, bajar los Logs del proyecto para leer un error real
  (el 400 de `web_fetch`, el 413 del tamaño de las fotos) y volver con eso a corregir el código
  — y entender cómo se conectan las tres piezas: escribo/reviso en Claude Code, eso se sube a
  GitHub con un commit, y Vercel redespliega solo apenas detecta el push. En la Entrega 1 el
  "backend" era el propio navegador; acá tuve que entender un pipeline real, aunque no escriba
  el código a mano.
- **La regla no vive donde uno piensa que vive.** Escribí "no inventes el precio" en el contrato
  tres veces, con cada vez más detalle, y el modelo lo siguió inventando — hasta que miré el
  JSON Schema y vi que `precio` era un string obligatorio. La regla estaba en el prompt, pero la
  obligación real estaba en la estructura de datos. La lección se repite en la materia (output
  estructurado) pero hace falta vivirla para que quede: cuando una instrucción no se sostiene,
  el problema muchas veces no es de redacción.
- **Nombrar el error real gana contra la regla genérica.** "No inventes" no alcanzó. "No uses
  $17.600 de cocktails de autor solo porque el ejemplo de LUZMALA también tiene cocktails de
  autor a ese precio" sí. Poner el caso concreto como ejemplo negativo funcionó mejor que
  cualquier formulación abstracta, en los tres bugs de invención que aparecieron.
- **Los few-shot examples son una superficie de riesgo, no solo una ayuda de estilo.** Puse tres
  ejemplos reales de la cuenta para que el modelo imitara el tono — y terminó copiando un precio
  textual de uno de ellos. Un ejemplo de estilo puede filtrarse como dato si no se lo blindea
  explícitamente.
- **El modo Foto no estaba tan resuelto como parecía en la Entrega 1.** Ahí quedó "implementado
  pero sin validar" — acá, al validarlo de verdad, aparecieron dos problemas que ni siquiera
  había contemplado (una sola foto no alcanza para un menú real de varias hojas, y el límite de
  4.5 MB de Vercel). Un "funciona" sin una corrida real detrás no significa nada.
- **El costo de la API dejó de ser el problema.** En la Entrega 1, la razón para usar Gemini
  gratis en vez de Claude era el costo. Con las 3 corridas reales, el costo terminó siendo
  irrelevante (~US$ 1-2 al año) — el verdadero trabajo estuvo en el contrato, el schema y los
  bugs de producción, no en el presupuesto. La restricción que más importaba al principio no era
  la que más importó al final.
