// Backend serverless (Vercel) — el unico lugar donde vive la ANTHROPIC_API_KEY.
// El navegador nunca la ve: llama a este endpoint, y este endpoint llama a Claude.

const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// El contrato vive en un solo lugar (prompts/system_prompt.md) y se lee tal cual
// para que documentacion y comportamiento nunca se desincronicen.
const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, "..", "prompts", "system_prompt.md"),
  "utf-8"
);

const MODEL_ID = process.env.MODEL_ID || "claude-haiku-4-5";

// Precios oficiales USD por 1M tokens (ver DECISIONES.md para la justificacion del modelo).
const PRECIOS_POR_MILLON = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
};

const itemSchema = {
  type: "object",
  properties: {
    emoji: { type: "string" },
    item: { type: "string" },
    precio: { type: "string" },
  },
  required: ["emoji", "item", "precio"],
  additionalProperties: false,
};

const listaDeItemsONull = {
  anyOf: [{ type: "array", items: itemSchema }, { type: "null" }],
};

const itemONull = { anyOf: [itemSchema, { type: "null" }] };

const listaDeStringsONull = {
  anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }],
};

const stringONull = { anyOf: [{ type: "string" }, { type: "null" }] };

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    emoji_tematico: { type: "string" },
    nombre_lugar: { type: "string" },
    apertura: { type: "string" },
    items_comida: listaDeItemsONull,
    items_bebida: listaDeItemsONull,
    postre: itemONull,
    datos: listaDeStringsONull,
    ideal_para: { type: "array", items: { type: "string" } },
    direccion: { type: "string" },
    cierre_emoji: { type: "string" },
    cierre_pregunta: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    advertencias: stringONull,
  },
  required: [
    "emoji_tematico",
    "nombre_lugar",
    "apertura",
    "items_comida",
    "items_bebida",
    "postre",
    "datos",
    "ideal_para",
    "direccion",
    "cierre_emoji",
    "cierre_pregunta",
    "hashtags",
    "advertencias",
  ],
  additionalProperties: false,
};

function construirTextoUsuario(datos) {
  let texto = `Nombre del lugar: ${datos.nombreBar}
Instagram del lugar: ${datos.instagramLugar || "(no especificado)"}
Dirección: ${datos.direccion || "(no especificada)"}
Ideal para: ${datos.idealPara && datos.idealPara.length ? datos.idealPara.join(", ") : "(no especificado)"}

Speech del video (fuente principal de info y anécdotas):
${datos.speech}`;

  if (datos.menuModo === "texto") {
    texto += `\n\nMenú y precios (pegados a mano):\n${datos.menuTexto || ""}`;
  } else if (datos.menuModo === "link") {
    texto += `\n\nEl menú con los precios está en este link: ${datos.menuLink}\nUsá la herramienta web_fetch para leer ese link y extraer los platos/tragos y precios que coincidan con lo mencionado en el speech.`;
  } else if (datos.menuModo === "foto") {
    const cantidad = Array.isArray(datos.menuFotos) ? datos.menuFotos.length : 0;
    texto += cantidad > 1
      ? `\n\nEl menú con los precios está en las ${cantidad} imágenes adjuntas (son varias hojas del mismo menú). Mirá todas antes de responder y extraé de ahí los platos/tragos relevantes que coincidan con lo mencionado en el speech.`
      : `\n\nEl menú con los precios está en la imagen adjunta. Extraé de ahí los platos/tragos relevantes que coincidan con lo mencionado en el speech.`;
  }

  return texto;
}

// Tope de seguridad del lado del servidor: aunque el frontend ya limita a 5 fotos antes de
// mandar el pedido, no confiamos solo en la validación del cliente (alguien podría pegarle
// directo al endpoint) — se vuelve a cortar acá.
const MAX_FOTOS_MENU = 5;

function construirContenidoUsuario(datos) {
  const contenido = [];

  if (datos.menuModo === "foto" && Array.isArray(datos.menuFotos) && datos.menuFotos.length) {
    for (const foto of datos.menuFotos.slice(0, MAX_FOTOS_MENU)) {
      contenido.push({
        type: "image",
        source: {
          type: "base64",
          media_type: foto.mime || "image/jpeg",
          data: foto.base64,
        },
      });
    }
  }

  contenido.push({ type: "text", text: construirTextoUsuario(datos) });
  return contenido;
}

// Unicode "Mathematical Sans-Bold" no tiene variantes acentuadas (Á, É, Í, Ó, Ú, Ñ) —
// si no se les saca el acento antes, esas letras quedan sin convertir y rompen el look
// del título (mezcla de fuente normal y bold a la mitad de una palabra). Por eso se
// normaliza el texto (quitando tildes) antes de mapear letra por letra.
function aNegritaSansMayuscula(texto) {
  const INICIO_MAYUSCULAS = 0x1d5d4;
  const INICIO_DIGITOS = 0x1d7ec;
  // NFD descompone cada letra acentuada (incluida la Ñ) en la letra base + un caracter
  // "combinante" separado (la tilde); al sacar ese rango de caracteres combinantes queda
  // solo la letra base, lista para mapear a su version bold.
  const RANGO_COMBINANTES = new RegExp(String.fromCharCode(0x5b, 0x5c, 0x75, 0x30, 0x33, 0x30, 0x30, 0x2d, 0x5c, 0x75, 0x30, 0x33, 0x36, 0x66, 0x5d), "g");
  const sinTildes = texto.normalize("NFD").replace(RANGO_COMBINANTES, "");
  return sinTildes
    .toUpperCase()
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(INICIO_MAYUSCULAS + (code - 65));
      if (code >= 48 && code <= 57) return String.fromCodePoint(INICIO_DIGITOS + (code - 48));
      return ch;
    })
    .join("");
}

function renderizarCopy(d) {
  const bloques = [];

  bloques.push(`${d.emoji_tematico}${aNegritaSansMayuscula(d.nombre_lugar)}${d.emoji_tematico}`);
  bloques.push(d.apertura);

  if (d.items_comida && d.items_comida.length) {
    const lineas = d.items_comida.map((i) => `${i.emoji} ${i.item} (${i.precio})`);
    bloques.push(`Para comer fuimos con:\n${lineas.join("\n")}`);
  }

  if (d.items_bebida && d.items_bebida.length) {
    const lineas = d.items_bebida.map((i) => `${i.emoji} ${i.item} (${i.precio})`);
    bloques.push(`Para tomar:\n${lineas.join("\n")}`);
  }

  if (d.postre) {
    bloques.push(`Y de postre…\n${d.postre.emoji} ${d.postre.item} (${d.postre.precio})`);
  }

  if (d.datos && d.datos.length) {
    const lineas = d.datos.map((x) => `✅ ${x}`);
    bloques.push(`✍🏼 DATOS:\n${lineas.join("\n")}`);
  }

  if (d.ideal_para && d.ideal_para.length) {
    bloques.push(`☝🏼 Ideal para: ${d.ideal_para.join(", ")}`);
  }

  bloques.push(`📍 ${d.direccion}`);
  bloques.push(`${d.cierre_emoji} ${d.cierre_pregunta}`);
  bloques.push(d.hashtags.join(" "));

  return bloques.join("\n\n");
}

function extraerFuentesWebFetch(content) {
  const fuentes = [];
  for (const bloque of content || []) {
    if (bloque.type === "server_tool_use" && bloque.name === "web_fetch") {
      fuentes.push({ tipo: "solicitud", url: bloque.input && bloque.input.url });
    }
    if (bloque.type === "web_fetch_tool_result") {
      fuentes.push({ tipo: "resultado", detalle: bloque.content });
    }
  }
  return fuentes;
}

function calcularCosto(usage, model) {
  const precios = PRECIOS_POR_MILLON[model];
  if (!precios || !usage) return null;

  const costoInputUSD =
    ((usage.input_tokens || 0) / 1e6) * precios.input +
    (((usage.cache_creation_input_tokens || 0) / 1e6) * precios.input) * 1.25 +
    (((usage.cache_read_input_tokens || 0) / 1e6) * precios.input) * 0.1;
  const costoOutputUSD = ((usage.output_tokens || 0) / 1e6) * precios.output;

  return {
    costoInputUSD: Number(costoInputUSD.toFixed(6)),
    costoOutputUSD: Number(costoOutputUSD.toFixed(6)),
    costoTotalUSD: Number((costoInputUSD + costoOutputUSD).toFixed(6)),
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido, usá POST." });
    return;
  }

  const datos = req.body || {};

  if (!datos.nombreBar || !datos.speech) {
    res.status(400).json({ error: "Faltan datos obligatorios: nombreBar y speech." });
    return;
  }

  const usaMenuLink = datos.menuModo === "link" && datos.menuLink;
  // allowed_callers: ["direct"] es obligatorio en Haiku 4.5 — sin esto, Claude devuelve 400
  // porque interpreta que la herramienta necesita "programmatic tool calling" (no soportado
  // en este modelo).
  const tools = usaMenuLink
    ? [{ type: "web_fetch_20260209", name: "web_fetch", allowed_callers: ["direct"] }]
    : undefined;

  try {
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 4096,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools,
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [{ role: "user", content: construirContenidoUsuario(datos) }],
    });

    if (response.stop_reason === "refusal") {
      res.status(502).json({
        error: "El modelo rechazó la solicitud.",
        detalle: response.stop_details || null,
      });
      return;
    }

    const bloqueTexto = response.content.find((b) => b.type === "text");
    if (!bloqueTexto) {
      res.status(502).json({
        error: "El modelo no devolvió texto (posible corte por longitud o filtro de contenido).",
        stopReason: response.stop_reason,
      });
      return;
    }

    let copyData;
    try {
      copyData = JSON.parse(bloqueTexto.text);
    } catch (e) {
      res.status(502).json({ error: "El modelo devolvió un JSON inválido.", raw: bloqueTexto.text });
      return;
    }

    res.status(200).json({
      copy: renderizarCopy(copyData),
      datosEstructurados: copyData,
      fuentes: extraerFuentesWebFetch(response.content),
      modelo: MODEL_ID,
      usage: response.usage,
      costo: calcularCosto(response.usage, MODEL_ID),
    });
  } catch (err) {
    console.error("Error llamando a Claude:", err);
    res.status(502).json({ error: "No se pudo generar el copy.", detalle: err.message });
  }
};
