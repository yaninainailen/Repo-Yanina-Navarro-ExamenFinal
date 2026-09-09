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
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const [, base64] = reader.result.split(",");
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function datosFormulario() {
  const idealPara = Array.from(
    document.querySelectorAll('input[name="idealPara"]:checked')
  ).map((el) => el.value);

  const menuModo = menuModeActivo();
  const menuFotoFile = document.getElementById("menuFoto").files[0] || null;

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

  if (menuModo === "foto" && menuFotoFile) {
    datos.menuFotoBase64 = await fileToBase64(menuFotoFile);
    datos.menuFotoMime = menuFotoFile.type || "image/jpeg";
  }

  return datos;
}

async function generarCopy(datos) {
  const res = await fetch("/api/generar-copy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Error HTTP ${res.status}`);
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
    metaCorrida.textContent = formatearMeta(data);

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

  // No guardamos la foto en base64 en la corrida (pesa mucho y no aporta al análisis);
  // dejamos una nota de que el menú se cargó como imagen.
  const entradaLimpia = { ...ultimaCorrida.entrada };
  if (entradaLimpia.menuFotoBase64) {
    entradaLimpia.menuFotoBase64 = "(omitido en la corrida guardada — se cargó una foto real)";
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
