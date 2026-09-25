/* ==========================================================================
   TermoSense — script.js
   Protótipo estático: todos os dados são simulados para apresentação.
   ========================================================================== */

(() => {
  "use strict";

  // ---------------- Dados simulados (leituras por hora, 0h às 23h) ---------
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const HORA_AGORA = new Date().getHours();

  // Semeia o histórico do dia até a hora atual; horas futuras ficam zeradas
  const PERFIL = [0, 0, 0, 0, 0, 0, 1, 2, 3, 5, 8, 10, 11, 9, 7, 8, 9, 10, 8, 5, 3, 2, 1, 1];
  let LEITURAS = HOURS.map((h) => (h <= HORA_AGORA ? PERFIL[h] : 0));
  let ALERTAS_HORA = HOURS.map((h, i) => (h <= HORA_AGORA && LEITURAS[i] >= 8 && i % 5 === 0 ? 1 : 0));

  // Limites de temperatura (°C)
  const LIMITE_ALERTA = 37.5;
  const LIMITE_CRITICO = 38.5;
  const CHANCE_ALERTA = 0.07; // ~7% das medições simuladas disparam alerta

  const el = (id) => document.getElementById(id);

  // ---------------- Estado simulado ---------------------------------------
  let tempAtual = 36.4;
  let distancia = 32; // cm
  let uptimeSeg = 6 * 3600 + 12 * 60 + 44; // uptime do ESP32
  let leiturasHoje = LEITURAS.reduce((a, b) => a + b, 0);
  let alertasHoje = ALERTAS_HORA.reduce((a, b) => a + b, 0);
  let somaTemp = 36.2 * leiturasHoje; // para a média do dia
  let contTemp = leiturasHoje;
  let minTemp = 35.1;
  let maxTemp = 37.8;

  // ---------------- Utilidades ---------------------------------------------
  const fmtInt = (n) => n.toLocaleString("pt-BR");
  const fmtTemp = (t) => t.toFixed(1).replace(".", ",");

  function estadoTemp(t) {
    if (t <= LIMITE_ALERTA) return "ok";
    if (t <= LIMITE_CRITICO) return "warn";
    return "crit";
  }

  // ---------------- Relógio, data e uptime ---------------------------------
  function tickClock() {
    const d = new Date();
    const clock = el("clock");
    const hoje = el("data-hoje");
    if (clock) clock.textContent = d.toLocaleTimeString("pt-BR");
    if (hoje) {
      hoje.textContent = d.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }
  }

  function tickUptime() {
    uptimeSeg++;
    const h = Math.floor(uptimeSeg / 3600);
    const m = Math.floor((uptimeSeg % 3600) / 60);
    const s = uptimeSeg % 60;
    const uptime = el("uptime");
    if (uptime) uptime.textContent = `uptime ${h}h ${m}m ${s}s`;
  }

  // ---------------- Registro de alerta -------------------------------------
  function registrarAlerta(temp, est) {
    alertasHoje++;

    const kpiAlertas = el("kpi-alertas");
    if (kpiAlertas) kpiAlertas.textContent = fmtInt(alertasHoje);

    const subAlertas = el("kpi-alertas-sub");
    if (subAlertas) {
      subAlertas.textContent =
        alertasHoje === 1 ? "1 alerta térmico registrado" : `${alertasHoje} alertas térmicos registrados`;
    }

    const tbody = el("tabela-alertas");
    if (tbody) {
      const vazia = tbody.querySelector(".empty-row");
      if (vazia) tbody.innerHTML = "";

      const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const sev = est === "crit"
        ? '<span class="sev crit"><span class="dot dot-red"></span>Crítico</span>'
        : '<span class="sev warn"><span class="dot dot-amber"></span>Alerta</span>';
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td class="mono">${hora}</td>` +
        `<td>${sev}</td>` +
        `<td>Temperatura acima do limite (${fmtTemp(temp)} °C)</td>` +
        `<td>Terminal 01 — Recepção</td>` +
        `<td class="muted">Pendente</td>`;
      tbody.prepend(tr);
    }
  }

  // ---------------- Leitura simulada ---------------------------------------
  function novaLeitura() {
    // Passeio aleatório suave, puxando de volta para a faixa normal
    tempAtual += (Math.random() - 0.52) * 0.25;
    if (tempAtual > 37.2) tempAtual -= Math.random() * 0.18;
    if (tempAtual < 35.6) tempAtual += Math.random() * 0.18;
    tempAtual = Math.min(Math.max(tempAtual, 34.8), 39.2);

    // Esporadicamente simula uma pessoa com temperatura elevada (~7%)
    let alertou = false;
    if (Math.random() < CHANCE_ALERTA) {
      tempAtual = LIMITE_ALERTA + 0.1 + Math.random() * 1.4; // 37,6 – 39,0 °C
      alertou = true;
    }

    leiturasHoje++;
    somaTemp += tempAtual;
    contTemp++;
    if (minTemp == null || tempAtual < minTemp) minTemp = tempAtual;
    if (maxTemp == null || tempAtual > maxTemp) maxTemp = tempAtual;
    distancia = Math.round(30 + Math.sin(Date.now() / 9000) * 3 + Math.random() * 2);

    // Incrementa a barra da hora atual no gráfico
    const h = new Date().getHours();
    LEITURAS[h]++;
    if (alertou) {
      ALERTAS_HORA[h]++;
      registrarAlerta(tempAtual, estadoTemp(tempAtual));
    }

    renderChart();
    render();
  }

  // ---------------- Render --------------------------------------------------
  function render() {
    const est = estadoTemp(tempAtual);
    const t = fmtTemp(tempAtual);

    // Temperatura grande + gauge
    const tempEl = el("temp-atual");
    if (tempEl) tempEl.textContent = t;

    const arc = el("gauge-arc");
    if (arc) {
      const R = 84;
      const C = 2 * Math.PI * R;
      const ARC = C * 0.75; // arco de 270°
      const pct = Math.min(Math.max((tempAtual - 30) / (42 - 30), 0), 1);
      arc.style.strokeDasharray = `${ARC} ${C}`;
      arc.style.strokeDashoffset = String(ARC * (1 - pct));
      arc.classList.remove("warn", "crit");
      if (est === "warn") arc.classList.add("warn");
      if (est === "crit") arc.classList.add("crit");
    }

    // Pílula de estado
    const pill = el("estado-pill");
    const texto = el("estado-texto");
    if (pill && texto) {
      const dot = pill.querySelector(".dot");
      const map = {
        ok:   { cls: "dot-green", label: "Dentro do normal" },
        warn: { cls: "dot-amber", label: "Alerta térmico" },
        crit: { cls: "dot-red",   label: "Estado crítico" },
      }[est];
      if (dot) dot.className = `dot ${map.cls}`;
      texto.textContent = map.label;
      pill.style.borderColor =
        est === "ok" ? "rgba(16,185,129,.28)" :
        est === "warn" ? "rgba(245,158,11,.32)" : "rgba(239,68,68,.34)";
    }

    // Sensores / periféricos
    const set = (id, txt) => { const n = el(id); if (n) n.textContent = txt; };
    set("distancia", `${distancia} cm · OK`);
    set("hw-mlx", `Leitura: ${t} °C · ±0,2 °C`);
    set("hw-vl53", `Distância: ${distancia} cm · Posicionamento OK`);
    set("hw-oled", `Exibindo: ${t} °C`);

    // LED RGB + buzzer
    const ledTxt = el("led-texto");
    const stLed = el("st-led");
    const stBuz = el("st-buzzer");
    const hwLed = el("hw-led");
    const hwBuz = el("hw-buzzer");
    const corLed = { ok: "Verde", warn: "Amarelo", crit: "Vermelho" }[est];
    if (ledTxt) {
      const dot = ledTxt.querySelector(".dot");
      if (dot) dot.className = `dot dot-${est === "ok" ? "green" : est === "warn" ? "amber" : "red"}`;
      ledTxt.childNodes[ledTxt.childNodes.length - 1].textContent = corLed;
    }
    if (stLed) {
      stLed.textContent = corLed;
      stLed.className = `hw-status ${est}`;
    }
    if (hwLed) hwLed.textContent = `Cor: ${corLed.toLowerCase()} · estado ${est === "ok" ? "normal" : est === "warn" ? "de alerta" : "crítico"}`;
    if (stBuz) {
      stBuz.textContent = est === "ok" ? "Silencioso" : "Alarme";
      stBuz.className = `hw-status ${est}`;
    }
    if (hwBuz) hwBuz.textContent = est === "ok" ? "Silencioso · sem alarmes" : "Alarme sonoro ativo";

    // KPI de leituras
    const kpi = el("kpi-leituras");
    if (kpi) kpi.textContent = fmtInt(leiturasHoje);

    // KPI de temperatura média + faixa do dia
    renderMedia();
  }

  function renderMedia() {
    const m = el("kpi-media");
    const sub = el("kpi-media-sub");
    if (m) m.textContent = contTemp > 0 ? fmtTemp(somaTemp / contTemp) : "—";
    if (sub) {
      sub.textContent = minTemp != null
        ? `faixa do dia: ${fmtTemp(minTemp)} – ${fmtTemp(maxTemp)} °C`
        : "aguardando leituras…";
    }
  }

  // ---------------- Gráfico (SVG gerado em tempo real) ----------------------
  function renderChart() {
    const wrap = el("chart");
    if (!wrap) return;

    const W = 640, H = 260, padL = 40, padR = 8, padT = 12, padB = 28;
    const plotH = H - padT - padB;
    const MAX = Math.max(4, ...LEITURAS);
    const n = HOURS.length;
    const step = (W - padL - padR) / n;
    const bw = Math.min(16, step * 0.55);

    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de leituras por hora">`;
    s += `<defs>
      <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3b82f6"/>
        <stop offset="100%" stop-color="rgba(59,130,246,0.28)"/>
      </linearGradient>
    </defs>`;

    // Linhas de grade + rótulos do eixo Y
    [0, Math.round(MAX / 2), MAX].forEach((v) => {
      const y = padT + plotH - (v / MAX) * plotH;
      s += `<line class="grid-line" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"/>`;
      s += `<text class="axis-label" x="${padL - 8}" y="${y + 3}" text-anchor="end">${v}</text>`;
    });

    // Barras
    HOURS.forEach((h, i) => {
      const v = LEITURAS[i];
      const a = ALERTAS_HORA[i];
      const hTotal = v > 0 ? Math.max((v / MAX) * plotH, 4) : 0;
      const hAlert = a > 0 ? Math.max((a / MAX) * plotH, 5) : 0;
      const x = padL + i * step + (step - bw) / 2;
      const yTop = padT + plotH - hTotal;

      if (a > 0) {
        const hBlue = hTotal - hAlert;
        s += `<rect class="bar-blue" x="${x}" y="${yTop + hAlert}" width="${bw}" height="${Math.max(hBlue, 0)}" rx="3"/>`;
        s += `<rect class="bar-alert" x="${x}" y="${yTop}" width="${bw}" height="${hAlert}" rx="3"/>`;
      } else {
        s += `<rect class="bar-blue" x="${x}" y="${yTop}" width="${bw}" height="${hTotal}" rx="3"/>`;
      }

      s += `<text class="axis-label" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${h}h</text>`;
      // Área invisível de hover cobrindo a coluna inteira
      s += `<rect class="bar-hit" data-i="${i}" x="${padL + i * step}" y="${padT}" width="${step}" height="${plotH}" fill="transparent"/>`;
    });

    s += `</svg>`;
    wrap.innerHTML = s + `<div class="chart-tooltip mono" id="chart-tooltip" hidden></div>`;

    // Tooltip por barra (área de hover de cada coluna)
    const tip = el("chart-tooltip");
    const svg = wrap.querySelector("svg");
    if (!tip || !svg) return;

    svg.querySelectorAll(".bar-hit").forEach((hit) => {
      const i = Number(hit.getAttribute("data-i"));
      const v = LEITURAS[i];
      const a = ALERTAS_HORA[i];
      const label = `${HOURS[i]}h — ${v} leitura${v === 1 ? "" : "s"}${a > 0 ? ` · ${a} alerta${a > 1 ? "s" : ""}` : ""}`;

      hit.addEventListener("mouseenter", () => {
        tip.textContent = label;
        tip.hidden = false;
      });
      hit.addEventListener("mousemove", (e) => {
        const r = wrap.getBoundingClientRect();
        tip.style.left = `${e.clientX - r.left}px`;
        tip.style.top = `${e.clientY - r.top - 8}px`;
      });
      hit.addEventListener("mouseleave", () => {
        tip.hidden = true;
      });
    });
  }

  // ---------------- Reiniciar dados (zerar simulação) ----------------------
  function zerarDados() {
    LEITURAS = LEITURAS.map(() => 0);
    ALERTAS_HORA = ALERTAS_HORA.map(() => 0);
    leiturasHoje = 0;
    alertasHoje = 0;
    somaTemp = 0;
    contTemp = 0;
    minTemp = null;
    maxTemp = null;
    tempAtual = 36.4;
    uptimeSeg = 0;

    const subLeituras = el("kpi-leituras-sub");
    if (subLeituras) subLeituras.textContent = "contagem reiniciada — recomeçando do zero";

    const kpiAlertas = el("kpi-alertas");
    if (kpiAlertas) kpiAlertas.textContent = "0";

    const subAlertas = el("kpi-alertas-sub");
    if (subAlertas) subAlertas.textContent = "nenhum alerta registrado";

    const tbody = el("tabela-alertas");
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="empty-row">Nenhum alerta registrado desde o reinício da simulação.</td></tr>';
    }

    renderChart();
    render();

    const label = el("btn-reset-label");
    if (label) {
      label.textContent = "Dados zerados ✓";
      setTimeout(() => { label.textContent = "Reiniciar Dados"; }, 1800);
    }
  }

  // ---------------- Inicialização -------------------------------------------
  renderChart();
  render();
  tickClock();
  tickUptime();

  const btnReset = el("btn-reset");
  if (btnReset) btnReset.addEventListener("click", zerarDados);

  setInterval(tickClock, 1000);
  setInterval(tickUptime, 1000);
  setInterval(novaLeitura, 3000); // nova leitura simulada a cada 3 s
})();
