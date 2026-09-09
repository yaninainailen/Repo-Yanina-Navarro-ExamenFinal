// El navegador nunca ve la API key: solo llama a /api/generar-copy, que corre en el
// backend (Vercel) y ahí sí tiene la clave de Claude como variable de entorno.

// ---------- Tabs de menú ----------
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const mode = btn.dataset.mode;
    tabPanels.forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.panel !== mode);
    });
  });
});

function menuModeActivo() {
  return document.querySelector(".tab-btn.active").dataset.mode;
}

// ---------- Helpers ----------
// Vercel corta cualquier request a una función serverless en 4.5 MB de body (límite fijo de
// la plataforma, no se puede subir ni pagando). Una foto de menú sacada con la cámara de un
// celu pesa varios MB — con 2 o 3 fotos ya se pasa. Por eso cada foto se redibuja en un canvas
// más chico y se recomprime como JPEG antes de mandarla: el texto del menú sigue siendo
// legible para la visión de Claude, pero el peso baja de MB a cientos de KB.
const FOTO_LADO_MAXIMO_PX = 1600;
const FOTO_CALIDAD_JPEG = 0.75;

function comprimirFotoABase64(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > FOTO_LADO_MAXIMO_PX || height > FOTO_LADO_MAXIMO_PX) {
        const factor = FOTO_LADO_MAXIMO_PX / Math.max(width, height);
        width = Math.round(width * factor);
        height = Math.round(height * factor);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/jpeg", FOTO_CALIDAD_JPEG);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

async function datosFormulario() {
  const idealPara = Array.from(
    document.querySelectorAll('input[name="idealPara"]:checked')
  ).map((el) => el.value);

  const menuModo = menuModeActivo();
  // Los menús suelen tener varias hojas — se sacan varias fotos (siempre JPEG, cámara del
  // celu) y se mandan todas juntas. Tope de 5 para no disparar el tamaño del pedido.
  const MAX_FOTOS = 5;
  const menuFotoFilesElegidos = Array.from(document.getElementById("menuFoto").files || []);
  const menuFotoFiles = menuFotoFilesElegidos.slice(0, MAX_FOTOS);

  const datos = {
    nombreBar: document.getElementById("nombreBar").value.trim(),
    instagramLugar: document.getElementById("instagramLugar").value.trim(),
    direccion: document.getElementById("direccion").value.trim(),
    speech: document.getElementById("speech").value.trim(),
    idealPara,
    menuModo,
    menuLink: document.getElementById("menuLink").value.trim(),
    menuTexto: document.getElementById("menuTexto").value.trim(),
  };

  if (menuModo === "foto" && menuFotoFiles.length) {
    datos.menuFotos = await Promise.all(
      menuFotoFiles.map(async (file) => ({
        base64: await comprimirFotoABase64(file),
        mime: "image/jpeg", // se recomprime siempre a JPEG, sea cual sea el formato original
      }))
    );
    datos._fotosDescartadasPorLimite = menuFotoFilesElegidos.length - menuFotoFiles.length;
  }

  return datos;
}

async function generarCopy(datos) {
  const res = await fetch("/api/generar-copy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`El servidor respondió con un error que no es JSON (HTTP ${res.status}). Revisá los Logs del proyecto en Vercel.`);
  }

  if (!res.ok) {
    const base = data.error || `Error HTTP ${res.status}`;
    const detalle = data.detalle ? ` — ${typeof data.detalle === "string" ? data.detalle : JSON.stringify(data.detalle)}` : "";
    throw new Error(`${base}${detalle}`);
  }

  return data;
}

function formatearFuentes(fuentes) {
  if (!fuentes || !fuentes.length) {
    return "El agente no usó web_fetch en esta corrida (menú cargado por foto o texto).";
  }
  return fuentes
    .map((f) => (f.tipo === "solicitud" ? `Leyó: ${f.url}` : `Resultado: ${JSON.stringify(f.detalle).slice(0, 300)}`))
    .join("\n");
}

function formatearMeta(data) {
  if (!data.costo) return `Modelo: ${data.modelo}`;
  const { costoTotalUSD } = data.costo;
  const { input_tokens, output_tokens } = data.usage || {};
  return `Modelo: ${data.modelo} · Tokens: ${input_tokens} in / ${output_tokens} out · Costo estimado: US$ ${costoTotalUSD.toFixed(6)}`;
}

// ---------- UI: submit ----------
const form = document.getElementById("copyForm");
const generarBtn = document.getElementById("generarBtn");
const resultCard = document.getElementById("resultCard");
const loading = document.getElementById("loading");
const resultado = document.getElementById("resultado");
const copiarBtn = document.getElementById("copiarBtn");
const copiadoMsg = document.getElementById("copiadoMsg");
const errorCard = document.getElementById("errorCard");
const errorMsg = document.getElementById("errorMsg");
const fuentesToggleWrap = document.getElementById("fuentesToggleWrap");
const fuentesToggle = document.getElementById("fuentesToggle");
const fuentesDiv = document.getElementById("fuentes");
const metaCorrida = document.getElementById("metaCorrida");
const guardarCorridaBtn = document.getElementById("guardarCorridaBtn");

let ultimaCorrida = null;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorCard.classList.add("hidden");

  const datos = await datosFormulario();
  if (!datos.nombreBar || !datos.speech) {
    mostrarError("Completá al menos el nombre del bar y el speech del video.");
    return;
  }

  const fotosDescartadas = datos._fotosDescartadasPorLimite || 0;
  delete datos._fotosDescartadasPorLimite;

  // Red de seguridad extra: aunque cada foto se comprime antes de armar el pedido, si por lo
  // que sea el total sigue pesando mucho (menú con muchísimo detalle, fotos gigantes) avisamos
  // ANTES de mandar el pedido y recibir un 413 de Vercel sin explicación.
  if (datos.menuFotos && datos.menuFotos.length) {
    const bytesAprox = datos.menuFotos.reduce((total, f) => total + f.base64.length * 0.75, 0);
    const LIMITE_BYTES = 3.5 * 1024 * 1024;
    if (bytesAprox > LIMITE_BYTES) {
      mostrarError(`Las fotos del menú pesan demasiado incluso comprimidas (~${(bytesAprox / 1024 / 1024).toFixed(1)} MB). Probá con menos fotos, o cargá el menú por Link o Texto.`);
      return;
    }
  }

  resultCard.classList.remove("hidden");
  loading.classList.remove("hidden");
  resultado.value = "";
  copiadoMsg.classList.add("hidden");
  fuentesToggleWrap.classList.add("hidden");
  fuentesDiv.classList.add("hidden");
  metaCorrida.textContent = "";
  generarBtn.disabled = true;
  generarBtn.textContent = "Generando...";

  try {
    const data = await generarCopy(datos);
    resultado.value = data.copy;
    fuentesDiv.textContent = formatearFuentes(data.fuentes);
    fuentesToggleWrap.classList.remove("hidden");
    metaCorrida.textContent = formatearMeta(data) +
      (fotosDescartadas > 0 ? ` · ⚠️ Se ignoraron ${fotosDescartadas} foto(s) por pasar el máximo de 5.` : "");

    ultimaCorrida = {
      fecha: new Date().toISOString(),
      entrada: datos,
      salida: data,
    };
  } catch (err) {
    mostrarError(`No se pudo generar el copy.\n\nDetalle: ${err.message}`);
    resultCard.classList.add("hidden");
    ultimaCorrida = null;
  } finally {
    loading.classList.add("hidden");
    generarBtn.disabled = false;
    generarBtn.textContent = "✨ Generar copy";
  }
});

fuentesToggle.addEventListener("click", () => {
  fuentesDiv.classList.toggle("hidden");
});

copiarBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(resultado.value);
  copiadoMsg.classList.remove("hidden");
  setTimeout(() => copiadoMsg.classList.add("hidden"), 2000);
});

// Descarga la corrida (entrada + salida + fecha) como JSON, listo para subir a
// corridas/ del repo — así queda evidencia real sin copiar/pegar a mano.
guardarCorridaBtn.addEventListener("click", () => {
  if (!ultimaCorrida) {
    mostrarError("Generá un copy primero para poder guardar la corrida.");
    return;
  }

  // No guardamos las fotos en base64 en la corrida (pesan mucho y no aportan al análisis);
  // dejamos una nota de cuántas imágenes reales se cargaron.
  const entradaLimpia = { ...ultimaCorrida.entrada };
  if (entradaLimpia.menuFotos && entradaLimpia.menuFotos.length) {
    entradaLimpia.menuFotos = `(omitido en la corrida guardada — se cargaron ${entradaLimpia.menuFotos.length} foto(s) real(es))`;
  }

  const contenido = JSON.stringify(
    { fecha: ultimaCorrida.fecha, entrada: entradaLimpia, salida: ultimaCorrida.salida },
    null,
    2
  );

  const blob = new Blob([contenido], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const nombreArchivo = `corrida-${ultimaCorrida.entrada.nombreBar.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}.json`;
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
});

function mostrarError(msg) {
  errorMsg.textContent = msg;
  errorCard.classList.remove("hidden");
  errorCard.scrollIntoView({ behavior: "smooth", block: "center" });
}
