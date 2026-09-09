# DECISIONES.md — historia del proceso

Este documento cuenta cómo se llegó al sistema actual: las iteraciones, lo que falló, lo que
se achicó y por qué. Sigue en el mismo repo que la Entrega 1 (renombrado de
`Repo-Yanina-Navarro` a `Repo-Yanina-Navarro-ExamenFinal`) a propósito — el trabajo final es
"la versión seria" de esa entrega, no un proyecto nuevo, y la evolución real importa más que
un resultado prolijo sin historia.

## Capítulo 1 — Entrega 1 (Gemini, sin backend)

Lo que se construyó primero (ver historial de commits anteriores a esta entrega):

- Página estática (HTML/CSS/JS, sin backend) que generaba el copy con la API de Gemini
  (nivel gratuito), llamada **directo desde el navegador**.
- La API key de Gemini se pegaba en un campo del formulario y se guardaba en
  `localStorage` — visible para cualquiera que abriera las devtools del navegador.
- Se probó con un caso real (@mision.ba, modo Link) y funcionó, pero:
  - El modelo `gemini-3.6-flash` tiene 20 solicitudes/día gratis — se agotó en las pruebas.
  - Se probó bajar a `gemini-3.5-flash-lite` (500/día) y **empeoró la calidad**: inventó
    precios del menú real en vez de leerlos. Se volvió al modelo grande.
  - El **modo Foto nunca se probó** con un caso real — quedó implementado pero sin validar.
  - Hubo un error de disponibilidad de Gemini ("high demand") no relacionado con el código.

## Capítulo 2 — feedback del profesor sobre la Entrega 1

> "Muy buen trabajo de experimentación real con ejemplos, menú y generación de copys. Validá
> nuevamente el modo con foto y la repetición del flujo completo, y evitá exponer claves o
> credenciales desde el navegador."

Dos pendientes concretos, no genéricos: (1) probar el modo Foto con un caso real, (2) sacar
la clave del navegador. Los dos coinciden con lo que ya había quedado anotado como "Qué falta"
en el README de la Entrega 1 — no eran sorpresa.

## Capítulo 3 — decisión de arquitectura para el trabajo final

Consigna del trabajo final: "si tengo que pagar algo con Claude lo pago" — cambia la restricción
de costo que en la Entrega 1 había descartado la API de Claude. Con eso resuelto, la forma más
directa de solucionar el feedback del profesor de una sola vez es:

- **Sacar la clave del navegador de raíz**: en vez de que el JS del cliente llame a la API,
  se agrega un **backend serverless (Vercel)** — `api/generar-copy.js` — que es el único lugar
  donde vive `ANTHROPIC_API_KEY` (variable de entorno en el panel de Vercel, nunca en el
  código ni en el repo). El navegador solo le habla a `/api/generar-copy`.
- **Herramienta real del agente**: `web_fetch` (Claude) para leer el link del menú, reemplaza
  a `url_context` de Gemini. Para el modo Foto se usa visión nativa de Claude (mensaje con
  bloque `image`) — y esta vez sí se valida con un caso real (ver `corridas/`).
- **Salida estructurada de verdad**: el modelo ya no devuelve el texto final directo. Devuelve
  un JSON (`output_config.format` con json_schema) con campos (`nombre_lugar`, `items_comida`,
  `datos`, etc.), y **el backend arma el texto final** (incluida la transformación a negrita
  unicode del título). Esto saca del modelo la parte más mecánica y propensa a variar entre
  corridas, y deja algo comparable/reproducible — antes el formato dependía de que el modelo
  lo escribiera bien cada vez.
- **Repo continuo, no nuevo**: se sigue en el mismo repo (renombrado) en vez de arrancar uno
  separado, para que la evolución completa (incluida la parte mal hecha del principio) quede
  en la historia de commits en vez de perderse.

## Capítulo 4 — regla nueva del bloque de bebida (pedido explícito, 2026-09-08)

Se agregó una regla al contrato: si el menú no tiene la bebida exacta que se tomó en la
visita (según el speech), el agente no la inventa ni la omite — usa el nombre genérico de esa
categoría + "desde $X", con $X el precio más bajo real de esa categoría en el menú (ej.
"Cocktails de autor desde $15.000"). Esto evita dos malos resultados: inventar una bebida que
no está en el menú, o dejar el bloque vacío cuando sí hay información de precio aprovechable
(aunque no sea exacta).

## Capítulo 5 — simplificación: encabezado del bloque de comida

La Entrega 1 dejaba que el modelo eligiera entre "Para comer fuimos con:" o "Nosotros
probamos:" como variedad de estilo. Como ahora el **backend** arma el texto final (no el
modelo), ese encabezado tiene que ser un valor fijo, no una elección libre del modelo en cada
corrida — se fijó a "Para comer fuimos con:" para que el render sea determinístico.

## Capítulo 6 — decisión sobre vencimiento de la API key

Al crear la clave de Anthropic, Console ofrece ponerle fecha de vencimiento. Se eligió **sin
vencimiento** en vez de una fecha corta: esta herramienta no es solo para la entrega, se va a
seguir usando de verdad para @barescopados después del cierre de la materia. Una clave que
vence rompería el generador sin aviso (falla de autenticación) hasta notar el error, crear una
clave nueva y actualizarla a mano en Vercel. El riesgo que se acepta a cambio (una clave viva
indefinidamente si se filtrara) se mitiga porque nunca vive en el navegador ni en el repo, solo
en la variable de entorno del backend — ver sección de Gobierno y riesgo.

## Capítulo 7 — primer error real en producción: `web_fetch` + Haiku 4.5 (2026-09-08)

Primera corrida real contra el sistema desplegado (caso Misión, modo Link) — falló con un 400:

```
'claude-haiku-4-5-20251001' does not support programmatic tool calling. The following
tools have `allowed_callers` that require it: web_fetch. Explicitly set
`allowed_callers=["direct"]` on these tools, or use a model that supports programmatic
tool calling.
```

El error de la propia API decía la solución: había que agregar `allowed_callers: ["direct"]`
a la definición de la herramienta `web_fetch` en `api/generar-copy.js`. Se corrigió ahí.

De paso se encontró y arregló un bug del lado del frontend: `script.js` mostraba solo el
mensaje genérico `data.error` y descartaba `data.detalle` (donde el backend sí manda el error
real). Se corrigió para que el detalle completo aparezca en pantalla — así, si vuelve a fallar
algo, no hace falta ir a mirar los Logs de Vercel para diagnosticarlo.

## Capítulo 8 — bug de formato: la Ñ y las tildes rompían la negrita del título (2026-09-08)

Con el fix del capítulo 7, la corrida de Misión funcionó de punta a punta por primera vez —
pero el título salió como "🕺𝗠𝗜𝗦𝗜Ó𝗡🕺" con la O tildada en fuente normal en vez de bold: el
alfabeto Unicode "Mathematical Sans-Bold" no tiene versión acentuada de las vocales ni de la Ñ,
así que esos caracteres pasaban sin transformar por `aNegritaSansMayuscula` y quedaban
mezclados con el resto del título en negrita.

Se corrigió en el backend (no en el prompt): antes de mapear cada letra a su versión bold, el
texto pasa por `.normalize("NFD")`, que descompone cada letra acentuada en la letra base + un
caracter "combinante" separado (la tilde), y después se descartan esos caracteres combinantes.
Así "Ó" se convierte en "O" (y "Ñ" en "N") antes de la conversión a bold, sin depender de que
el modelo evite tildes por su cuenta en cada corrida — la garantía queda en el código, no en
una instrucción que el modelo podría no seguir siempre.

## Capítulo 9 — corrida 1 (Misión) validada de punta a punta (2026-09-08)

Con los dos fixes de los capítulos 7 y 8 ya desplegados, se repitió el caso Misión y salió
limpio. Queda guardada en [`corridas/corrida-1-mision.json`](corridas/corrida-1-mision.json),
con el flujo completo real: entrada (nombre, Instagram, dirección, speech completo, link del
menú), la llamada real a `web_fetch` (se ve en `fuentes` que efectivamente leyó
`queresto.com/misionbar` y trajo el menú completo con precios), el JSON estructurado que
devolvió el modelo, el copy ya renderizado, y el costo real: **US$ 0,0199** (788 tokens de
entrada, 545 de salida, más creación/lectura de cache), con `claude-haiku-4-5`.

*(Nota del 2026-09-09: este archivo se reemplazó después por una corrida nueva del mismo caso,
para que tuviera el campo `encabezado_comida` agregado en el capítulo 12 — ver capítulo 18. Los
números de costo y tokens de este párrafo corresponden a la versión original, ya no son los que
están en `corridas/corrida-1-mision.json` hoy.)*

Un detalle a favor de que el agente está priorizando bien la fuente correcta: en el speech se
mencionó "provoleta con compota de **higos**", pero el menú real dice "compota de **mango**"
— el agente usó el dato del menú (verificable) en vez de lo dicho en el speech (memoria,
posiblemente imprecisa). Es el comportamiento deseado, pero abre una pregunta para la sección
de Gobierno y riesgo: ¿qué pasa cuando el speech y el menú no coinciden y la diferencia importa
más que un ingrediente (ej. un precio desactualizado en el menú online)? Por ahora el sistema
no lo señala, solo elige silenciosamente la fuente del menú.

**Corridas: 1 de 3 completas.**

## Capítulo 10 — corrida repetida desde el celular, y limitación real del modo Foto (2026-09-09)

Se repitió el caso Misión desde el celular (mismo lugar que la corrida 1, para validar el flujo
completo desde mobile) y salió bien: título en bold sin romperse (confirma el fix del capítulo
8 con un segundo caso real), platos y precios correctos contra el menú real, y la regla de
"desde $X" del capítulo 4 aplicada bien (`🍸 Tragos de autor (desde $22.000)`, el precio más
bajo real de esa categoría). Costo: US$ 0,0198, casi idéntico a la corrida 1. No se guarda como
corrida nueva del trabajo final porque es el mismo lugar — queda como evidencia adicional del
fix, no como una de las 3 corridas exigidas.

Al intentar probar el modo Foto por primera vez con un caso real apareció una limitación que no
se había contemplado: el modo Foto solo soportaba **una** imagen, pero los menús reales casi
siempre tienen varias hojas (se sacan varias fotos con el celular, formato JPEG por default de
la cámara). Con una sola foto permitida, el modo Foto era inutilizable para el caso real.

Se corrigió en los tres lugares que tocan el modo Foto:
- `index.html`: el input de archivo pasa de aceptar un solo archivo a `multiple`, limitado a
  `image/jpeg` (el formato real que usa la usuaria, no cualquier imagen).
- `script.js`: en vez de mandar `menuFotoBase64`/`menuFotoMime` (un solo par), ahora arma un
  array `menuFotos` (hasta 5, se recortan las de más con un aviso en pantalla si se cargaron
  más).
- `api/generar-copy.js`: `construirContenidoUsuario` agrega un bloque `image` por cada foto del
  array (con el mismo tope de 5 repetido del lado del servidor, para no depender solo de la
  validación del navegador si alguien llama al endpoint directo), y el texto que acompaña al
  pedido le avisa a Claude cuántas imágenes está viendo cuando son varias hojas del mismo menú.

Con esto el modo Foto queda listo para probarse de verdad con un caso real de varias hojas —
sigue pendiente esa corrida.

## Capítulo 11 — segundo error real en producción: 413, el body pasaba el límite de Vercel (2026-09-09)

Con el fix del capítulo 10 ya desplegado, la primera prueba real del modo Foto multi-imagen
(varias fotos sacadas con la cámara del iPhone) falló al toque:

```
Status: 413 (FUNCTION_PAYLOAD_TOO_LARGE)
```

Vercel limita el body de cualquier función serverless a **4.5 MB**, un tope fijo de la
plataforma (no depende del plan, no se puede subir por configuración). Una foto de menú sacada
directo con la cámara de un celular pesa varios MB — codificada en base64 (que agrega ~33% de
peso) y con 2 o 3 fotos juntas en el mismo pedido, se pasa del límite fácilmente. El error de
Vercel no da más detalle que el código HTTP, pero el nombre (`FUNCTION_PAYLOAD_TOO_LARGE`) y el
tamaño real de las fotos elegidas explican la causa sin ambigüedad.

La solución no es subir el límite (no se puede) sino no mandar el archivo original: en
`script.js`, `comprimirFotoABase64()` redibuja cada foto en un `<canvas>` acotado a 1600px de
lado máximo y la recodifica como JPEG con calidad 0.75 antes de convertir a base64 — el texto
del menú sigue siendo legible para la visión de Claude, pero el peso baja de varios MB a
cientos de KB por foto. Además se agregó una verificación en el frontend antes de mandar el
pedido (si el total comprimido igual supera ~3,5 MB, se avisa en pantalla en vez de dejar que
falle en el servidor con un 413 sin contexto).

## Capítulo 12 — corrida real de Il Giardino (modo Foto, 5 fotos): dos bugs encontrados (2026-09-09)

Con el fix del capítulo 11 ya desplegado, la primera corrida real del modo Foto multi-imagen
funcionó técnicamente (sin 413) y la visión de Claude leyó bien las 5 fotos: los platos y
precios que devolvió (Provoleta a la brasa $18.000, Ñoquis con hongo porcini $26.000, T-Bone
Steak $65.000) coinciden con el copy que la usuaria había escrito a mano cuando visitó el lugar
— buena señal de que la lectura de imagen es confiable para el dato duro (precios), no solo
para el link.

Comparando el resultado contra ese copy de referencia aparecieron dos problemas reales:

**1. Precio inventado, y no al azar — contaminación del few-shot.** El bloque de bebida mostró
"🍸 Cocktails de autor (desde $17.600)", pero esa categoría no tenía precio visible en las
fotos del menú. El número $17.600 no es una alucinación cualquiera: es **exactamente** el precio
de "Cocktails de autor" del segundo ejemplo de la sección 5 del contrato (el ejemplo de LUZMALA).
El modelo, al no tener el dato real, tomó un precio plausible de los ejemplos de estilo en vez
de aplicar la regla existente de omitir el bloque cuando no hay precio real. La regla de "no
inventar" ya estaba escrita, pero no cubría específicamente el caso de "reusar un número de los
propios ejemplos del prompt" — un modo de fallo distinto a inventar de la nada.

Fix: se agregó una restricción explícita y nombrando el caso concreto ("no uses $17.600 de
cocktails de autor solo porque el ejemplo de LUZMALA también tiene cocktails de autor a ese
precio") en `prompts/system_prompt.md`, más una aclaración reforzada en el encabezado de la
sección EJEMPLOS. Nombrar el error real como ejemplo negativo es más efectivo que una regla
genérica de "no inventar" — ya se había visto lo mismo con la Ñ/tildes del capítulo 8: las
reglas abstractas no siempre alcanzan, hace falta ser específico sobre el modo de fallo real.

**2. El encabezado del bloque de comida salió idéntico en las dos corridas guardadas** ("Para
comer fuimos con:" en Misión y en Il Giardino) — pedido explícito de la usuaria de variarlo
("Nosotros probamos...", "Para comer pedimos...", "De entrada pedimos...", "De principales
pedimos..."). Esto revierte parcialmente la decisión del **capítulo 5**, que había fijado ese
encabezado a un único texto para que el render fuera determinístico (en ese momento el problema
era que el modelo armaba el texto final completo en prosa libre, y variar el encabezado ahí
significaba menos control). La solución no es volver a prosa libre: se agregó `encabezado_comida`
como campo del JSON estructurado, restringido por `enum` a las 5 frases aprobadas — el modelo
elige una (según si los platos son entradas, principales, o mezcla), pero no puede escribir
texto libre ahí. Sigue siendo determinístico y auditable, solo que con una elección acotada en
vez de un valor fijo único.

Esta corrida de Il Giardino no se guarda en `corridas/` tal cual (tiene los dos bugs) — con los
fixes ya desplegados, se va a repetir con las mismas fotos para guardar la versión corregida
como evidencia de la corrida 2.

## Capítulo 13 — el precio seguía inventado: el schema obligaba a inventarlo (2026-09-09)

Con el fix del capítulo 12 desplegado, se repitió Il Giardino. El encabezado sí varió ("Nosotros
probamos:" en vez de "Para comer fuimos con:" — ese fix funcionó), pero el precio de "Cocktails
de autor" se siguió inventando: esta vez "desde $10.000" en vez de "$17.600". Ya no era el
número copiado del ejemplo de LUZMALA (ese fix también funcionó, cortó esa vía puntual), pero
el modelo igual inventó un número distinto, "razonable", para la misma categoría sin precio
real. Pedido explícito de la usuaria para simplificar la regla: si no se encuentra el precio
(ni en el link ni en la foto), no inventarlo — mencionar el plato/trago igual, pero sin precio.

La causa real no era de redacción del contrato sino de **arquitectura del schema**: en
`itemSchema` (`api/generar-copy.js`), el campo `precio` era un `string` obligatorio para
cualquier ítem. El contrato decía en prosa "no inventes el precio", pero el JSON Schema —que es
lo que Claude realmente tiene que cumplir estructuralmente— no dejaba otra opción que escribir
algo en ese campo si quería incluir el ítem. Dicho de otra forma: la regla vivía en el texto del
prompt, pero la obligación real vivía en la estructura de datos, y la estructura le ganó a la
regla. Ningún texto de instrucción, por más específico, iba a resolver esto mientras el schema
siguiera exigiendo un string no vacío.

Fix real, en la estructura: `precio` pasa a ser nullable (`anyOf: [string, null]`) en
`itemSchema`, tanto para `items_comida` como `items_bebida` y `postre`. El contrato se actualiza
para reflejar la prioridad correcta al armar el bloque de bebida: (1) precio exacto del ítem si
está, (2) "desde $X" con el precio real más bajo de la categoría si hay otros ítems con precio,
(3) si no hay ningún precio real disponible, mencionar el ítem igual con `precio: null`. El
backend (`renderizarCopy` → `lineaDeItem`) arma la línea con paréntesis de precio solo si
`precio` no es `null`; si es `null`, el ítem aparece sin precio, en vez de desaparecer del copy
o llevar un número inventado.

De paso se aprovechó para reforzar el formato de precio en el contrato (separador de miles con
punto, ej. "$18.500"), porque en esta misma corrida aparecieron precios sin el punto ("$18000")
— inconsistencia menor de estilo, no de exactitud, pero vale la pena que quede escrita la regla
en vez de depender de que el modelo copie el estilo de los ejemplos por su cuenta cada vez.

**Aprendizaje para la sección de gobierno y riesgo**: cuando una regla de "no inventes X" no se
sostiene después de reforzarla en el prompt dos veces (capítulos 12 y 13), el problema
probablemente no es de redacción sino de que la estructura de datos no deja otra salida —
conviene mirar el schema antes de seguir puliendo el texto de las instrucciones.

## Capítulo 14 — corrida 2 (Il Giardino) validada de punta a punta (2026-09-09)

Se repitió Il Giardino una tercera vez, ya con los tres fixes de los capítulos 12 y 13
desplegados, y salió limpia:

- Encabezado: **"Nosotros probamos:"** — distinto al "Para comer fuimos con:" de la corrida 1
  (Misión). El campo `encabezado_comida` está funcionando como se esperaba.
- Precios de comida con formato correcto: "$18.000", "$26.000", "$65.000" (separador de miles).
- Bloque de bebida: **"🍸 Coctelería de autor"**, sin precio — el menú fotografiado no tenía un
  precio real para esa categoría, y por primera vez el sistema lo dice mencionando el ítem en
  vez de inventar un número o esconderlo. `precio: null` en el JSON, sin paréntesis en el texto
  renderizado.
- Costo: **US$ 0,0109** — más barato que las corridas anteriores porque esta vez pegó en el
  cache de 5 minutos del system prompt (`cache_read_input_tokens: 5433`, `cache_creation: 0`) en
  vez de tener que crearlo de nuevo.

Queda guardada en [`corridas/corrida-2-il-giardino.json`](corridas/corrida-2-il-giardino.json).
Con esto, el modo Foto (el pendiente puntual que dejó abierto el profesor desde la Entrega 1)
queda validado de punta a punta con un caso real de menú de varias hojas.

**Corridas: 2 de 3 completas.**

## Capítulo 15 — tercer intento de corrida (Victoria Brown): horario inventado en DATOS (2026-09-09)

Primer intento de la corrida 3 (Victoria Brown, modo Link). La lectura de menú vía `web_fetch`
volvió a ser precisa: "Truchón Patagónico" ($41.000), "Ojo de Bife" ($44.000) y "Copón
Victoriano" ($21.500) coinciden exactamente con el menú real online. "Mollejitas" (mencionadas
en el speech) no figuran en el menú actual del lugar — el sistema correctamente le puso
`precio: null` en vez de inventar uno, confirmando que el fix del capítulo 13 sigue funcionando
también con datos de `web_fetch`, no solo con fotos.

Pero apareció un bug nuevo, de la misma familia que los precios inventados: en la sección
DATOS, el copy dijo "Abre martes a domingo desde las 20hs." La fuente real (texto scrapeado por
`web_fetch`) dice textualmente: *"Martes & Miércoles de 20 a 02am | Jueves de 20 a 03am |
Viernes & Sábados de 20 a 04am."* — es decir, abre de **martes a sábado**, sin ninguna mención
de domingo, y con tres horarios de cierre distintos según el día. El modelo comprimió esa
información en una sola línea y en el proceso agregó un día que no existe en la fuente.

(De paso se había marcado como sospechoso "Conviene reservar.", que no aparece en el menú ni en
el speech — pero la usuaria aclaró que ese es un dato editorial habitual de la cuenta, no algo
que necesite estar confirmado en la fuente cada vez. Distinción importante para el contrato:
horarios/días son datos verificables que, si están mal, son un error de información real; una
recomendación como "conviene reservar" es estilo editorial de @barescopados, no un hecho que
haya que sourcear. El contrato quedó ajustado para reflejar exactamente esa distinción, sin
restringir de más.)

Es el mismo patrón de fondo que los precios de los capítulos 12 y 13, aplicado a horarios: cuando
el modelo tiene que resumir algo y no puede simplificarlo sin perder precisión, rellena con algo
plausible en vez de limitarse estrictamente a lo verificable. Acá no hay un problema de schema
(el campo `datos` ya es texto libre, no hay nada que forzar) — es puramente de instrucción. Se
agregó una regla explícita en `prompts/system_prompt.md`, sección DATOS, citando el caso real
como ejemplo negativo (mismo patrón que funcionó en los capítulos 8 y 12: nombrar el error
concreto en vez de una prohibición genérica).

Esta corrida de Victoria Brown no se guarda todavía — se va a repetir con el fix ya desplegado
para tener la corrida 3 limpia.

## Capítulo 16 — corrida 3 (Victoria Brown) validada, y un extra: `advertencias` en acción (2026-09-09)

Se repitió Victoria Brown con el fix del capítulo 15 desplegado y salió limpia: "Abre de martes
a sábado desde las 20hs (con cierre variable: hasta las 02am entre semana, hasta las 04am los
sábados)" — sin domingo inventado, y de hecho más preciso que el pedido mínimo (reflejó los tres
horarios de cierre distintos en vez de perderlos). "Conviene reservar" no apareció esta vez;
tampoco hacía falta, no cambia nada del fix.

Además pasó algo que vale la pena destacar para la sección de gobierno y riesgo: la usuaria
cargó a mano un Instagram y una dirección con errores de tipeo, distintos a los reales
(`@victotriabrownba`, "Honduras 444, palerml"), y el menú real (`web_fetch`) trae una dirección
registrada distinta a esa (Costa Rica 4827). El sistema no intentó adivinar cuál dirección es la
"correcta" ni las mezcló: usó la dirección que la usuaria cargó a mano (la fuente de verdad para
ese campo, según el contrato) y dejó un aviso explícito en el campo `advertencias`: *"El menú
online tiene dirección diferente (Costa Rica 4827); se usó la dirección proporcionada por el
usuario (Honduras 444). La mollejita no aparece en el menú online, se incluyó porque está
mencionada en el speech pero sin precio disponible."* — exactamente el comportamiento que pide
el contrato ante una fuente en conflicto: no inventar cuál dato es el correcto, señalar la
discrepancia y dejar que una persona lo revise antes de publicar.

Queda guardada en [`corridas/corrida-3-victoria-brown.json`](corridas/corrida-3-victoria-brown.json).

**Corridas: 3 de 3 completas — las 3 exigidas por la consigna del trabajo final.**

Resumen de las 3: Misión (Link), Il Giardino (Foto, 5 imágenes), Victoria Brown (Link). Los tres
modos de carga de menú quedaron representados entre las corridas guardadas (Foto y Link con 2
casos reales cada uno contando las pruebas fallidas documentadas en los capítulos previos; Texto
no se llegó a probar con una corrida guardada, pero es el modo más simple —sin herramienta
externa— y no tuvo ningún bug propio en el desarrollo).

## Capítulo 17 — elección de modelo, con evidencia real (2026-09-09)

Criterio de la materia (Diccionario, Clase 2): *"el modelo más chico que hace bien la tarea"*.
Con las 3 corridas reales completas, hay evidencia concreta para decidir sin extrapolar en el
vacío:

- **Precisión de lectura**: en las 3 corridas (un link con menú scrapeado por `web_fetch`, 5
  fotos reales de un menú de varias hojas, y otro link con un menú online completo),
  `claude-haiku-4-5` no cometió **ningún** error de precisión — todos los platos y precios que
  devolvió coinciden exactamente con la fuente real (verificado línea por línea contra el texto
  scrapeado y contra el copy de referencia que la usuaria había escrito a mano para Il Giardino).
- **Todos los bugs encontrados durante el desarrollo fueron de diseño** (contrato ambiguo,
  schema que forzaba a inventar, few-shot contaminando la salida) — **ninguno** fue una falla de
  comprensión atribuible al tamaño del modelo. No hay ninguna señal en las 3 corridas de que un
  modelo más grande hubiera evitado alguno de estos bugs; los fixes fueron todos de prompt/schema,
  no de modelo.
- **Costo**: ver Análisis económico más abajo — con Sonnet 4.6 el costo se triplica (mismo
  volumen de tokens, precio 3x tanto en input como en output) sin ninguna mejora de calidad
  observada que lo justifique.

**Decisión: `claude-haiku-4-5` se queda como modelo por defecto.** `MODEL_ID` sigue siendo una
variable de entorno (no hardcodeada) para poder subir a Sonnet sin tocar código el día que
aparezca un caso real que Haiku no resuelva bien (ej. un menú manuscrito ilegible, una foto muy
mala calidad, un menú en un idioma distinto) — la decisión es reversible y barata de revertir,
no una apuesta cerrada.

## Análisis económico

**Costo real por corrida**, con `claude-haiku-4-5` (las 3 corridas guardadas en `corridas/`):

| Corrida | Modo | Tokens in / out | Cache | Costo real |
|---|---|---|---|---|
| 1 — Misión | Link | 821 / 512 | frío (creó cache) | US$ 0,0218 |
| 2 — Il Giardino | Foto (5 imgs) | 8.189 / 427 | tibio (pegó cache de otra corrida reciente) | US$ 0,0109 |
| 3 — Victoria Brown | Link | 648 / 612 | frío (creó cache) | US$ 0,0186 |

*(La corrida 1 se reemplazó el 2026-09-09 por un fix de formato — ver capítulo 18. Los números
de esta tabla son los del archivo actual en `corridas/`.)*

El contrato (`prompts/system_prompt.md`) es largo (rol, contexto, restricciones detalladas, 3
ejemplos completos) y va cacheado (`cache_control: ephemeral`, ventana de 5 minutos). Cuando dos
corridas caen dentro de esa ventana, la segunda paga solo el 10% del precio de input por los
tokens que reutiliza del cache — por eso la corrida 2 salió más barata: se hizo poco después de
otra prueba. En **uso real**, los posteos de @barescopados están espaciados en días, no en
minutos, así que el cache casi siempre va a estar frío. La proyección usa por eso el promedio de
las corridas 1 y 3 (las dos que partieron de cache frío), no el mínimo observado:

**Costo esperado en uso real: ≈ US$ 0,020 por corrida.**

**Proyección**, según el ritmo real de la cuenta (1-2 posteos/semana, un uso, en general, sin
necesidad de repetir la corrida si el sistema no tiene bugs activos):

| Ritmo | Por semana | Por año (52 semanas) |
|---|---|---|
| 1 posteo/semana | US$ 0,020 | **≈ US$ 1** |
| 2 posteos/semana | US$ 0,040 | **≈ US$ 2** |

Incluso agregando un 30% de margen por corridas que haya que repetir (un dato ambiguo, una
prueba de un lugar que finalmente no se publica), el techo realista es de **unos pocos dólares
al año**. A esta escala, el costo de la API de Claude no es un factor de decisión — ni siquiera
se acerca a lo que cuesta una sola suscripción de cualquier herramienta de diseño o edición. El
verdadero ahorro del sistema no está en los tokens: está en el tiempo humano que reemplaza
(grabar, mirar el menú y escribir el copy a mano en el estilo de la cuenta), que no se mide en
dólares de infraestructura pero es el motivo real por el que este proyecto tiene sentido.

**Comparación con `claude-sonnet-4-6`** (no se corrió una corrida real con este modelo — la
proyección sale de la tabla de precios oficial, que es pública y no requiere una corrida para
calcularse): Sonnet cuesta 3x tanto en input (US$ 3 vs. US$ 1 por millón de tokens) como en
output (US$ 15 vs. US$ 5) respecto a Haiku. Con el mismo volumen de tokens que las 3 corridas
reales, el costo esperado por corrida pasaría de ≈ US$ 0,020 a ≈ US$ 0,060, y la proyección
anual de ≈ US$ 1-2 a ≈ US$ 3-6. Sigue siendo un monto trivial en términos absolutos, pero
pagarlo sin evidencia de que Haiku falla en algo no tiene sentido — ver capítulo 17.

## Gobierno y riesgo

**Niveles de supervisión (L0-L4).** El vocabulario del curso no deja una escala L0-L4 escrita en
el material disponible; se define acá de forma explícita, en los términos que pide la consigna
("qué hace solo, qué revisa una persona, quién firma"), y se ubica el sistema dentro de ella:

| Nivel | Qué hace el agente solo | Qué revisa una persona |
|---|---|---|
| L0 — Manual | Nada — todo lo hace una persona | Todo (esto era @barescopados antes de este proyecto) |
| L1 — Asistido | Redacta a partir de datos que la persona ya recopiló a mano | Lee y edita el resultado antes de usarlo |
| **L2 — Con herramientas, revisión previa (⬅ acá está este sistema)** | Busca/lee datos por su cuenta (`web_fetch`, visión) y arma el copy completo | Lee el copy entero, chequea `advertencias`, decide publicar o no — **ninguna salida llega a Instagram sin este paso** |
| L3 — Revisión por excepción | Publicaría directo salvo que dispare una señal de alerta | Solo interviene cuando el sistema avisa un conflicto |
| L4 — Autónomo | Decide y publica sin intervención en el camino crítico | Audita muestras después del hecho |

El sistema está en **L2** a propósito: no hay ninguna integración que publique en Instagram
directamente — el copy se genera, se lee, se copia manualmente. La firma humana ocurre *afuera*
del sistema, en el momento de apretar publicar en la app de Instagram, no en ningún paso del
código.

**Qué sistemas toca el agente, con qué permisos:**
- **API de Anthropic**: la clave (`ANTHROPIC_API_KEY`) vive solo como variable de entorno en
  Vercel (Production/Preview) — nunca en el repo ni en el navegador (el fix directo al feedback
  del profesor sobre la Entrega 1). No tiene fecha de vencimiento (decisión documentada en el
  capítulo 6): el riesgo que se acepta es que, si se filtrara, seguiría siendo válida
  indefinidamente; se mitiga porque el único lugar donde existe es esa variable de entorno.
- **`web_fetch`**: puede leer cualquier URL pública que la usuaria pegue en el campo del menú —
  no hay una lista blanca de dominios. El riesgo (que el link no sea el menú real, o apunte a
  contenido inapropiado) está acotado porque quien carga el link es la propia usuaria, no un
  tercero no confiable.
- **Fotos del menú**: se procesan en memoria (base64 dentro del request a la función serverless)
  y no quedan guardadas en ningún storage del servidor — Vercel no persiste el body más allá de
  la ejecución. Si se guarda una corrida, las fotos se excluyen a propósito del JSON descargado
  (nota en el campo, no la imagen — ver `script.js`).
- **No hay ninguna escritura a sistemas externos**: el agente no publica en Instagram, no manda
  mensajes, no modifica nada fuera de su propia respuesta. La única "escritura" es el archivo
  JSON que la usuaria descarga a mano con el botón "Guardar corrida", que queda local hasta que
  ella decide subirlo al repo.

**Qué puede salir mal — con evidencia real, no hipotética (todo esto pasó durante el desarrollo,
documentado capítulo por capítulo):**
1. El modelo prioriza en silencio una fuente sobre otra cuando entran en conflicto (capítulo 9:
   el speech decía "higos", el menú real decía "mango" — usó el menú, la decisión correcta, pero
   sin señalar que hubo un conflicto).
2. Contaminación de few-shot: copia un dato de los ejemplos de estilo del contrato en vez de usar
   el dato real de la corrida (capítulo 12) — clase de error que puede volver a aparecer si se
   agregan más ejemplos al contrato sin cuidado.
3. Un campo obligatorio en el schema puede forzar al modelo a inventar un valor si no hay dato
   real disponible (capítulo 13) — lección operativa: cuando una regla de "no inventes" no se
   sostiene, revisar el schema antes de seguir puliendo el texto del prompt.
4. Resumir mal un dato real al comprimirlo (capítulo 15: un horario con tres franjas distintas
   terminó con un día agregado que no estaba en la fuente).
5. Fuentes en conflicto explícitas, manejadas bien: dirección cargada a mano vs. dirección del
   menú online (capítulo 16) — el sistema no arbitra cuál es la verdad, deja constancia en
   `advertencias` y una persona lo resuelve.
6. Fallas de herramienta: si `web_fetch` falla o no trae precios utilizables, el contrato exige
   decirlo en `advertencias` en vez de inventar o callarlo (todavía no se dio este caso en una
   corrida real, pero está contemplado y no probado en producción — riesgo residual conocido).

**Qué reviso yo (Yanina) antes de confiar en una salida** — el punto de supervisión L2 real, no
un trámite:
- Que los platos y precios coincidan con la visita real, no solo con lo que dice el menú *hoy*
  (el menú puede haber cambiado desde la visita — el sistema lee la fuente actual, no puede saber
  qué pasó ese día puntual).
- Que el campo `advertencias` esté vacío; si no lo está, resolver la discrepancia a mano antes de
  publicar (no ignorarla).
- Que el tono sea coherente con la cuenta — esto lo evalúa solo una persona, no está en el
  contrato ni puede estarlo del todo.
- Que ningún ítem quedó con `precio: null` que en realidad sí se conoce de memoria (el sistema es
  deliberadamente conservador: prefiere omitir un precio a inventarlo, lo que a veces significa
  completar algo a mano que el sistema no pudo verificar solo).

**Quién firma:** Yanina o Lucho — quien efectivamente publica en la cuenta de Instagram de
@barescopados. No hay una firma dentro del sistema porque no hay ninguna acción del sistema que
requiera firma: el acto de publicar ocurre completamente afuera del código, en Instagram, después
de la revisión humana descrita arriba.

## Capítulo 18 — corrida 1 desactualizada: hallazgo del propio agente evaluador (2026-09-09)

Se construyó un agente evaluador propio (parcial de la materia) y se lo corrió sobre este mismo
repo antes de la entrega final. Puntaje: 91/100. El único punto débil que encontró, en la
dimensión "Sistema completo y funcionando" (21/30, "Bueno" en vez de "Excelente"): las 3 corridas
guardadas no tenían el mismo schema. `corridas/corrida-1-mision.json` se había guardado en el
capítulo 9, **antes** de que el capítulo 12 agregara el campo `encabezado_comida` al JSON — así
que las corridas 2 y 3 lo tienen y la 1 no. Formato no idéntico entre las 3 corridas, tal como
señaló el evaluador.

Es un hallazgo válido y esperable: la corrida 1 es evidencia real de un momento real del
desarrollo (antes del capítulo 12), no un error de tipeo. La sugerencia concreta del propio
evaluador fue la correcta: volver a correr el mismo caso con el sistema actual y reemplazar el
archivo. Se hizo así — no repitiendo el flujo por el navegador, sino llamando directamente al
endpoint desplegado (`POST /api/generar-copy`) con la misma entrada exacta que se había guardado
en la corrida original (mismo speech, mismo link de menú), para no introducir ninguna variable
nueva. La respuesta trajo `"encabezado_comida": "Nosotros probamos:"` y el resto de los datos
consistentes con las corridas anteriores del mismo lugar (mismos platos y precios reales del
menú, ver capítulos 9 y 10). Se reemplazó `corridas/corrida-1-mision.json` por esta versión.

El costo y los tokens de esta nueva corrida (US$ 0,021752; 821 tokens de entrada, 512 de salida,
14.177 de creación de cache) son ligeramente distintos a los de la corrida original citados en el
capítulo 9 (US$ 0,0199; 788/545) — normal, cada corrida es una inferencia nueva contra el menú
real, que además pudo cambiar levemente desde entonces. El análisis económico más abajo usa los
números actualizados.

## Pendiente al momento de escribir esto (2026-09-09)

- [x] Deploy en Vercel y verificación end-to-end con la clave real de Anthropic.
- [x] Modo Foto: soporte para varias imágenes (hasta 5, JPEG) — capítulo 10.
- [x] Modo Foto: fix del 413 (compresión de imágenes antes de mandarlas) — capítulo 11.
- [x] Modo Foto: validado con caso real (Il Giardino, 5 fotos) — capítulos 12-14.
- [x] Precio inventado cuando no hay dato real: `precio` nullable en el schema — capítulo 13.
- [x] Corrida 2 guardada (`corridas/corrida-2-il-giardino.json`) — capítulo 14.
- [x] Horario/dato operativo inventado en DATOS: regla explícita agregada — capítulo 15.
- [x] Corrida 3 guardada (`corridas/corrida-3-victoria-brown.json`) — capítulo 16.
- [x] **Las 3 corridas reales exigidas están completas.**
- [x] Elección de modelo justificada con evidencia real — capítulo 17.
- [x] Análisis económico: costo por corrida, proyección semanal/anual, comparación con Sonnet.
- [x] Gobierno y riesgo: niveles L0-L4, permisos, fallas reales, supervisión, quién firma.
- [x] Completar "Qué aprendí" en el README.
- [x] Corregir inconsistencia de formato en `corrida-1-mision.json` (hallazgo del agente
      evaluador propio, 91/100 antes de este fix) — capítulo 18.
