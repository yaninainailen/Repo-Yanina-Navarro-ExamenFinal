# User prompt — plantilla

El backend arma este mensaje a partir de lo que la usuaria carga en el formulario. No es un
texto fijo (varía en cada corrida), pero la estructura y el orden de los campos son siempre
los mismos:

```
Nombre del lugar: {nombreBar}
Instagram del lugar: {instagramLugar | "(no especificado)"}
Dirección: {direccion | "(no especificada)"}
Ideal para: {idealPara.join(", ") | "(no especificado)"}

Speech del video (fuente principal de info y anécdotas):
{speech}

{bloque de menú, según el modo elegido}
```

## Bloque de menú, según modo

**Modo link:**
```
El menú con los precios está en este link: {menuLink}
Usá la herramienta web_fetch para leer ese link y extraer los platos/tragos y precios que
coincidan con lo mencionado en el speech.
```

**Modo foto:** se agrega la imagen como bloque `image` (base64) en el mismo mensaje, más el texto:
```
El menú con los precios está en la imagen adjunta. Extraé de ahí los platos/tragos relevantes
que coincidan con lo mencionado en el speech.
```

**Modo texto:**
```
Menú y precios (pegados a mano):
{menuTexto}
```

## Variantes

- Si `idealPara` está vacío, se pasa "(no especificado)" y el modelo debe dejar `ideal_para: []`
  en la salida (nunca inventar valores).
- Si no hay speech, el formulario bloquea el envío antes de llamar al agente (validación en el
  frontend, no en el prompt).
