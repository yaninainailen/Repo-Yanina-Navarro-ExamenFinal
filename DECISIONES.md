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

## Pendiente al momento de escribir esto (2026-09-09)

- [ ] Elegir modelo con evidencia real: probar `claude-haiku-4-5` (el más barato) contra un
      caso real con precios; si falla en precisión (como pasó con el Gemini lite en la
      Entrega 1), subir a `claude-sonnet-4-6`. Documentar el resultado acá. *(Los platos y
      precios reales siempre salieron correctos con Haiku 4.5 en las 2 corridas guardadas — los
      bugs de los capítulos 12 y 13 fueron de diseño del contrato/schema, no de precisión de
      lectura del modelo — evidencia a favor de quedarse con el modelo chico.)*
- [ ] Correr 1 corrida más en un lugar nuevo (modo Link o Texto) para llegar a las 3 exigidas.
- [ ] Análisis económico: costo real por corrida (rango observado US$ 0,011-0,020 con Haiku
      4.5, según si pega en cache), proyección semanal/anual según el ritmo real de
      @barescopados (1-2 posteos/semana).
- [ ] Sección de gobierno y riesgo: niveles de supervisión, qué revisa una persona antes de
      publicar, quién firma, y los casos de los capítulos 9, 12 y 13 (fuente en conflicto,
      contaminación de few-shot, schema que forzaba a inventar precios).
- [x] Deploy en Vercel y verificación end-to-end con la clave real de Anthropic.
- [x] Modo Foto: soporte para varias imágenes (hasta 5, JPEG) — capítulo 10.
- [x] Modo Foto: fix del 413 (compresión de imágenes antes de mandarlas) — capítulo 11.
- [x] Modo Foto: validado con caso real (Il Giardino, 5 fotos) — capítulos 12-14.
- [x] Precio inventado cuando no hay dato real: `precio` nullable en el schema — capítulo 13.
- [x] Corrida 2 guardada (`corridas/corrida-2-il-giardino.json`) — capítulo 14.
