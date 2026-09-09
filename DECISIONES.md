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

## Pendiente al momento de escribir esto (2026-09-08)

- [ ] Elegir modelo con evidencia real: probar `claude-haiku-4-5` (el más barato) contra un
      caso real con precios; si falla en precisión (como pasó con el Gemini lite en la
      Entrega 1), subir a `claude-sonnet-4-6`. Documentar el resultado acá.
- [ ] Correr las 3 corridas reales (Misión + 2 lugares nuevos, al menos uno con foto real del
      menú) y guardarlas en `corridas/`.
- [ ] Análisis económico: costo real por corrida (tokens de la corrida de Misión), proyección
      semanal/anual según el ritmo real de @barescopados (1-2 posteos/semana).
- [ ] Sección de gobierno y riesgo: niveles de supervisión, qué revisa una persona antes de
      publicar, quién firma.
- [ ] Deploy en Vercel y verificación end-to-end con la clave real de Anthropic.
