const CATEGORIES = [
  { name: "Eletrônicos", icon: "💻", hint: "Celulares, cabos e equipamentos" },
  { name: "Pilhas e baterias", icon: "🔋", hint: "Pilhas, baterias e carregadores" },
  { name: "Óleo de cozinha", icon: "🫙", hint: "Óleo usado e bem armazenado" },
  { name: "Roupas e tecidos", icon: "👕", hint: "Roupas, calçados e tecidos" },
  { name: "Móveis", icon: "🪑", hint: "Móveis em bom estado" },
  { name: "Recicláveis", icon: "♻️", hint: "Papel, plástico, vidro e metal" },
  { name: "Outros", icon: "📦", hint: "Outros resíduos especiais" }
];

const icons = {
  pin: '<svg viewBox="0 0 24 24" fill="none"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="1.7"/></svg>',
  locate: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4.2 4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none"><path d="M6.6 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-2.6a1 1 0 0 0-.8-1l-4.1-.9a1 1 0 0 0-1 .3l-1.8 2.2a15 15 0 0 1-6.3-6.3l2.2-1.8a1 1 0 0 0 .3-1L7.6 3.8a1 1 0 0 0-1-.8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" fill="none"><path d="M20.5 3.5C11 3 5.2 5.5 4 11c-.8 3.7 2 6.5 5.5 6 4.6-.7 8.7-6.4 11-13.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M3 21c3-5.8 7.3-9.4 13-12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  box: '<svg viewBox="0 0 80 80" fill="none"><path d="m40 8 29 16v32L40 72 11 56V24L40 8Z" fill="#D1EDE0" stroke="#27AE75" stroke-width="2"/><path d="m11 24 29 17 29-17M40 41v31M25 16l29 17" stroke="#27AE75" stroke-width="2" stroke-linejoin="round"/><path d="m39 24-9 10 8 4 10-10-9-4Z" fill="#fff"/><path d="m40 16 8 5-4 6-8-5 4-6Z" fill="#1769AA"/></svg>'
};

const app = document.querySelector("#app");
const toastRegion = document.querySelector("#toast-region");
const menuToggle = document.querySelector("#mobile-menu-toggle");
const nav = document.querySelector("#main-nav");
let points = [];
let mapPoints = [];
let mapSearchCenter = null;
let mapSearchParams = null;
let currentRoute = "";
let revealObserver = null;

function setupScrollReveal() {
  if (revealObserver) revealObserver.disconnect();
  const elements = app.querySelectorAll(".hero-copy-wrap, .hero-art, .trust-item, .section-heading, .category-card, .step-card, .benefits-visual, .benefits-copy, .cta-band, .map-results-section, .point-card, .map-point-card, .filter-card, .suggestion-form, .detail-main, .detail-aside, .admin-card, .admin-stats, .feedback-card");
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    elements.forEach((element) => element.classList.add("scroll-reveal", "is-visible"));
    return;
  }
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.target.classList.toggle("is-visible", entry.isIntersecting));
  }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
  elements.forEach((element) => {
    element.classList.add("scroll-reveal");
    revealObserver.observe(element);
  });
}

function apiBaseUrl() {
  const { protocol, hostname, port } = window.location;
  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLoopback && port && port !== "3000") return `${protocol}//${hostname}:3000`;
  return "";
}

const API_BASE_URL = apiBaseUrl();

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function normalizeSearch(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

function locationScore(point, query) {
  const search = normalizeSearch(query);
  if (!search) return 0;
  const neighborhood = normalizeSearch(point.neighborhood);
  const city = normalizeSearch(point.city);
  const address = normalizeSearch(point.address);
  const searchDigits = String(query).replace(/\D/g, "");
  const postalCode = String(point.postalCode || "").replace(/\D/g, "");
  const matchesPostalCode = searchDigits.length >= 3 && /^[\d\s.-]+$/.test(String(query)) && postalCode.includes(searchDigits);

  if (neighborhood === search) return 5;
  if (matchesPostalCode) return 4;
  if (neighborhood.includes(search)) return 4;
  if (city === search) return 3;
  if (city.includes(search)) return 2;
  if (address.includes(search) || normalizeSearch(`${neighborhood} ${city}`).includes(search)) return 1;
  return -1;
}

function selectedMapCategories() {
  return [...document.querySelectorAll('input[name="category"]:checked')].map((input) => input.value);
}

function filteredMapPoints() {
  const categories = selectedMapCategories();
  return mapPoints.filter((point) => !categories.length || !point.categories.length || categories.some((category) => point.categories.includes(category)));
}

function pointLocation(point) {
  return [point.address, point.neighborhood, point.city, point.postalCode ? `CEP ${point.postalCode}` : ""].filter(Boolean).join(" · ");
}

function toast(message, error = false) {
  const item = document.createElement("div");
  item.className = `toast${error ? " toast-error" : ""}`;
  item.textContent = message;
  toastRegion.append(item);
  window.setTimeout(() => item.remove(), 4800);
}

function feedbackStars(value, interactive = false) {
  const label = Number.isInteger(value) ? String(value) : value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `<span class="star-row${interactive ? " star-controls" : ""}"${interactive ? ' role="radiogroup" aria-label="Sua avaliação, de 1 a 5 estrelas"' : ` role="img" aria-label="${label} de 5 estrelas"`}>${[1, 2, 3, 4, 5].map((star) => interactive
    ? `<button class="star-button${star <= value ? " is-selected" : ""}" type="button" role="radio" aria-checked="${star === value}" tabindex="${star === (value || 1) ? "0" : "-1"}" aria-label="${star} ${star === 1 ? "estrela" : "estrelas"}" data-rating="${star}">★</button>`
    : `<span class="star-display${star <= value ? " is-filled" : value >= star - 0.5 ? " is-half" : ""}" aria-hidden="true">★</span>`).join("")}</span>`;
}

function updateFeedbackSummary(summary) {
  const container = app.querySelector("#feedback-summary");
  if (!container) return;
  container.innerHTML = summary.count
    ? `<span class="feedback-score">${summary.average.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>${feedbackStars(summary.average)}<span class="feedback-count">${summary.count} ${summary.count === 1 ? "avaliação recebida" : "avaliações recebidas"}</span>`
    : '<span class="feedback-score feedback-score-empty">—</span><span class="feedback-count">Seja a primeira pessoa a avaliar.</span>';
}

async function loadFeedbackSummary() {
  updateFeedbackSummary(await request("/api/feedback/summary"));
}

function bindFeedbackForm() {
  const form = app.querySelector("#feedback-form");
  if (!form) return;
  const controls = form.querySelector(".star-controls");
  let rating = 0;
  const setRating = (value) => {
    rating = value;
    controls.querySelectorAll("[data-rating]").forEach((button) => {
      const selected = Number(button.dataset.rating) === rating;
      button.setAttribute("aria-checked", String(selected));
      button.setAttribute("tabindex", selected || (!rating && Number(button.dataset.rating) === 1) ? "0" : "-1");
      button.classList.toggle("is-selected", Number(button.dataset.rating) <= rating);
    });
    form.querySelector("#feedback-form-status").textContent = `${rating} ${rating === 1 ? "estrela selecionada" : "estrelas selecionadas"}.`;
  };
  controls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-rating]");
    if (button) setRating(Number(button.dataset.rating));
  });
  controls.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const current = Number(event.target.closest("[data-rating]")?.dataset.rating || rating || 1);
    const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
    const next = Math.min(5, Math.max(1, current + direction));
    controls.querySelector(`[data-rating="${next}"]`).focus();
    setRating(next);
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!rating) {
      toast("Escolha uma nota de 1 a 5 estrelas para enviar sua avaliação.", true);
      controls.querySelector("[data-rating='1']").focus();
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await request("/api/feedback", { method: "POST", body: JSON.stringify({ rating, comment: form.elements.comment.value }) });
      form.reset();
      setRating(0);
      await loadFeedbackSummary();
      toast("Obrigado por avaliar o Descarte Certo!");
    } catch (error) {
      toast(error.message, true);
    } finally { button.disabled = false; }
  });
  loadFeedbackSummary().catch((error) => {
    const summary = app.querySelector("#feedback-summary");
    if (summary) summary.textContent = "As avaliações estão temporariamente indisponíveis.";
    toast(`Não foi possível carregar as avaliações: ${error.message}`, true);
  });
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor. Inicie a aplicação com node server.js e tente novamente.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a solicitação.");
  return data;
}

function routePath() {
  return (window.location.hash.replace(/^#/, "") || "/").split("?")[0];
}

function link(path, label, className = "") {
  return `<a class="${className}" href="#${path}">${label}</a>`;
}

function categoryCards() {
  return CATEGORIES.map((category) => `
    <a class="category-card" href="#/pesquisar?categoria=${encodeURIComponent(category.name)}">
      <span class="category-icon" aria-hidden="true">${category.icon}</span>
      <span><strong>${esc(category.name)}</strong><small>${esc(category.hint)}</small></span>
      <span class="category-arrow" aria-hidden="true">↗</span>
    </a>`).join("");
}

function homePage() {
  return `
    <section class="hero">
      <div class="container hero-inner">
        <div class="hero-copy-wrap">
          <span class="eyebrow"><span class="eyebrow-dot"></span>Um futuro mais consciente</span>
          <h1>O descarte correto começa com <em>uma escolha.</em></h1>
          <p class="hero-copy">Encontre lugares que recebem aquilo que você não usa mais. O destino certo está mais perto do que você imagina.</p>
          <form class="hero-search" id="hero-search">
            <label class="search-input-wrap">${icons.search}<span class="screen-reader-only">O que você quer descartar?</span><input name="material" placeholder="O que você quer descartar?" aria-label="O que você quer descartar?"></label>
            <button class="button" type="submit">Encontrar pontos ${icons.pin}</button>
          </form>
          <div class="hero-note">${icons.shield}<span>Locais verificados. Descarte com mais confiança.</span></div>
        </div>
        <div class="hero-art" aria-hidden="true">
          <span class="art-orbit"></span><span class="art-center">${icons.box}</span>
          <span class="art-card art-card-one"><span class="art-icon">🔋</span><span><strong>Pilhas e baterias</strong><small>Destino responsável</small></span></span>
          <span class="art-card art-card-two"><span class="art-icon">♻️</span><span><strong>Recicláveis</strong><small>Um novo ciclo começa</small></span></span>
          <span class="art-card art-card-three"><span class="art-icon">📍</span><span><strong>Um ponto perto de você</strong><small>Encontre com facilidade</small></span></span>
          <span class="art-pin"></span><span class="art-pin art-pin-blue"></span><span class="art-sparkle sparkle-one">✳</span><span class="art-sparkle sparkle-two">✦</span>
        </div>
      </div>
    </section>
    <section class="trust-strip"><div class="container trust-inner">
      <div class="trust-item"><span class="trust-icon">${icons.shield}</span><span><strong>Informações confiáveis</strong><br>locais revisados pela equipe</span></div>
      <div class="trust-item"><span class="trust-icon">${icons.pin}</span><span><strong>Perto de você</strong><br>pesquise por cidade ou bairro</span></div>
      <div class="trust-item"><span class="trust-icon">${icons.leaf}</span><span><strong>Impacto positivo</strong><br>um item de cada vez</span></div>
      <div class="trust-item"><span class="trust-icon">${icons.box}</span><span><strong>Várias categorias</strong><br>descarte mais consciente</span></div>
    </div></section>
    <section class="section"><div class="container">
      <div class="section-heading"><span class="eyebrow"><span class="eyebrow-dot"></span>O que você precisa descartar?</span><h2>Todo material merece o destino certo.</h2><p>Escolha uma categoria para encontrar locais preparados para receber seu material.</p></div>
      <div class="category-grid">${categoryCards()}</div>
    </div></section>
    <section class="section section-soft" id="como-funciona"><div class="container">
      <div class="section-heading"><span class="eyebrow"><span class="eyebrow-dot"></span>Simples assim</span><h2>Três passos para fazer a diferença.</h2><p>Uma experiência fácil para você e um futuro melhor para todo mundo.</p></div>
      <div class="steps-grid">
        <article class="step-card"><span class="step-num">01</span><h3>Encontre o material</h3><p>Pesquise pelo que deseja descartar ou escolha uma das categorias disponíveis.</p></article>
        <article class="step-card"><span class="step-num">02</span><h3>Escolha um ponto</h3><p>Compare as opções perto de você e confira endereço, horário e materiais aceitos.</p></article>
        <article class="step-card"><span class="step-num">03</span><h3>Faça o descarte</h3><p>Siga as orientações do local e encaminhe seu material com responsabilidade.</p></article>
      </div>
    </div></section>
    <section class="section"><div class="container benefits-layout">
      <div class="benefits-visual" aria-hidden="true"><div class="benefits-circle">${icons.leaf}</div><span class="benefits-badge">Cada atitude conta ✳</span></div>
      <div class="benefits-copy"><span class="eyebrow"><span class="eyebrow-dot"></span>Uma escolha melhor</span><h2>Informação transforma intenção em atitude.</h2><p>Quando o lugar certo fica fácil de encontrar, descartar com responsabilidade entra na rotina.</p>
        <div class="benefit-list">
          <div class="benefit-item"><span class="check-icon">✓</span><span><strong>Decisão sem dúvida</strong><span>Veja quais materiais cada local recebe antes de sair.</span></span></div>
          <div class="benefit-item"><span class="check-icon">✓</span><span><strong>Menos tempo procurando</strong><span>Encontre pontos por tipo de material e localização.</span></span></div>
          <div class="benefit-item"><span class="check-icon">✓</span><span><strong>Comunidade que participa</strong><span>Sugira novos locais e ajude outras pessoas a encontrá-los.</span></span></div>
        </div>
      </div>
    </div></section>
    <section class="section feedback-section"><div class="container feedback-layout">
      <div class="feedback-copy"><span class="eyebrow"><span class="eyebrow-dot"></span>Feito para a comunidade</span><h2>Sua opinião ajuda a gente a melhorar.</h2><p>Conte como foi sua experiência com o Descarte Certo. Cada avaliação nos ajuda a deixar a busca mais simples para todo mundo.</p>
        <div class="feedback-summary" id="feedback-summary" aria-live="polite"><span class="feedback-count">Carregando avaliações…</span></div>
      </div>
      <form class="content-card feedback-card" id="feedback-form">
        <span class="feedback-card-kicker">Queremos ouvir você</span><h3>Como foi sua experiência?</h3><p>Escolha uma nota de 1 a 5 estrelas.</p>
        <div class="feedback-stars-input">${feedbackStars(0, true)}</div>
        <div class="field"><label for="feedback-comment">Quer deixar um comentário? <span class="optional-label">Opcional</span></label><textarea id="feedback-comment" name="comment" maxlength="500" placeholder="O que funcionou bem? O que podemos melhorar?" aria-describedby="feedback-comment-hint"></textarea><small class="field-hint" id="feedback-comment-hint">Até 500 caracteres. Comentários ficam visíveis apenas para a equipe.</small></div>
        <button class="button feedback-submit" type="submit">Enviar avaliação <span aria-hidden="true">↗</span></button>
        <span class="screen-reader-only" id="feedback-form-status" role="status"></span>
      </form>
    </div></section>
    <section class="section section-soft"><div class="container"><div class="cta-band"><div class="cta-content"><div><h2>Conhece um ponto de coleta?</h2><p>Sugira um local e ajude mais gente a descartar do jeito certo.</p></div>${link("/sugerir", "Sugerir um ponto ↗", "button")}</div></div></section>`;
}

function pointCard(point) {
  const materials = (point.categories || []).map((name) => `<span class="material-chip">${esc(name)}</span>`).join("");
  return `<article class="content-card point-card">
    <div class="point-card-top"><div><h2 class="point-title">${esc(point.name)}</h2><span class="point-address">${icons.pin}${esc(pointLocation(point))}</span></div><span class="verified-badge">${icons.shield} Verificado</span></div>
    <div class="point-materials">${materials}</div>
    <div class="point-card-bottom"><span class="point-hours">${icons.clock} ${esc(point.hours || "Consulte o horário")}</span><a class="text-button" href="#/ponto/${encodeURIComponent(point.id)}">Ver detalhes <span aria-hidden="true">→</span></a></div>
  </article>`;
}

function mapPointCard(point) {
  const categories = point.categories.length
    ? point.categories.map((category) => `<span class="material-chip">${esc(category)}</span>`).join("")
    : '<span class="material-chip material-chip-muted">Materiais aceitos não informados</span>';
  const location = [point.address, point.neighborhood, point.city].filter(Boolean).join(" · ") || "Endereço não informado no mapa";
  return `<article class="map-point-card">
    <div class="map-point-icon" aria-hidden="true">${point.kind === "waste" ? "🗑️" : "♻️"}</div>
    <div class="map-point-content">
      <div class="map-point-title-row"><h3>${esc(point.name)}</h3><span class="map-source-badge">OpenStreetMap · não verificado</span></div>
      <p class="map-point-address">${icons.pin}${esc(location)}</p>
      <div class="point-materials">${categories}</div>
      <div class="map-point-bottom"><span>${point.distanceKm !== null ? `${point.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km em linha reta` : "Distância indisponível"}${point.hours ? ` · ${esc(point.hours)}` : ""}</span><a class="text-button" href="${esc(point.mapUrl)}" target="_blank" rel="noopener noreferrer">Ver no mapa ↗</a></div>
    </div>
  </article>`;
}

function searchPage() {
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const selected = params.get("categoria") || "";
  const material = params.get("material") || "";
  return `<section class="page-shell"><div class="container">
    <div class="breadcrumbs"><a href="#/">Início</a><span>›</span><span>Pontos de coleta</span></div>
    <div class="page-heading"><span class="eyebrow"><span class="eyebrow-dot"></span>Encontre um destino</span><h1>Pontos de coleta</h1><p>Busque por material e região para encontrar uma opção adequada para você.</p></div>
    <div class="search-layout">
      <aside class="filter-card"><h2>Refine sua busca</h2>
        <div class="field"><label for="filter-material">Material ou local</label><input id="filter-material" type="search" value="${esc(material)}" placeholder="Ex.: pilhas, Centro"></div>
        <div class="field"><label for="filter-location">Cidade ou bairro</label><input id="filter-location" type="search" placeholder="Ex.: Guarulhos ou Centro, Recife"><small class="field-hint">Buscamos a partir do centro aproximado da cidade. Para CEP, prefira informar cidade ou bairro.</small></div>
        <button class="button button-blue map-search-button" id="search-map" type="button">Buscar locais nessa região ${icons.search}</button>
        <button class="button button-secondary location-button" id="use-my-location" type="button">${icons.locate} Usar minha localização</button>
        <div class="field map-radius-field"><label for="map-radius">Distância para busca</label><select id="map-radius"><option value="5000">Até 5 km</option><option value="10000">Até 10 km</option><option value="20000">Até 20 km</option></select></div>
        <p class="map-privacy-note">A busca no mapa usa o OpenStreetMap. Sua localização só é compartilhada se você autorizar o navegador; o local digitado é enviado para encontrar resultados.</p>
        <div class="field"><span class="field-label">Categoria</span><div class="filter-options">${CATEGORIES.map((category) => `<label class="check-label"><input type="checkbox" name="category" value="${esc(category.name)}" ${selected === category.name ? "checked" : ""}>${esc(category.name)}</label>`).join("")}</div></div>
        <button class="button button-secondary button-small" id="clear-filters" type="button">Limpar filtros</button>
      </aside>
      <div class="search-results-column">
        <div class="results-top"><span id="results-count">Carregando pontos…</span><span>Locais aprovados pela equipe</span></div>
        <div class="results-list" id="results-list"><div class="content-card loading">Buscando pontos de coleta…</div></div>
        <section class="map-results-section" aria-labelledby="map-results-heading">
          <div class="map-results-heading"><div><span class="eyebrow"><span class="eyebrow-dot"></span>Mapa comunitário</span><h2 id="map-results-heading">Outros locais na região</h2><p id="map-results-status">Busque por cidade ou permita sua localização para encontrar locais mapeados pela comunidade OpenStreetMap.</p></div><span class="map-count" id="map-results-count">—</span></div>
          <div class="map-results-list" id="map-results-list"><div class="map-empty-hint">${icons.locate}<span>Os resultados do mapa aparecem aqui quando você iniciar uma busca por região.</span></div></div>
          <p class="map-attribution">Dados © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> · Distância aproximada em linha reta, não é uma rota. Os locais são informados pela comunidade, não têm avaliações do Google e não são verificados pelo Descarte Certo. Lixões a céu aberto não são destinos recomendados. Confirme regras, materiais e horário diretamente com o local.</p>
        </section>
      </div>
    </div>
  </div></section>`;
}

function categoryChecks(values = []) {
  return `<div class="category-picker">${CATEGORIES.map((category) => `<label class="category-option"><input type="checkbox" name="categories" value="${esc(category.name)}" ${values.includes(category.name) ? "checked" : ""}>${category.icon} ${esc(category.name)}</label>`).join("")}</div>`;
}

function suggestionPage() {
  return `<section class="page-shell"><div class="container">
    <div class="breadcrumbs"><a href="#/">Início</a><span>›</span><span>Sugerir um ponto</span></div>
    <div class="page-heading"><span class="eyebrow"><span class="eyebrow-dot"></span>Participe</span><h1>Conhece um ponto de coleta?</h1><p>Compartilhe as informações e ajude mais pessoas a encontrarem o destino certo.</p></div>
    <div class="form-layout">
      <form class="form-card" id="suggestion-form">
        <div class="form-grid">
          <div class="field field-wide"><label for="suggest-name">Nome do estabelecimento *</label><input id="suggest-name" name="name" maxlength="100" required placeholder="Ex.: Cooperativa de reciclagem"></div>
          <div class="field field-wide"><label for="suggest-address">Endereço *</label><input id="suggest-address" name="address" maxlength="180" required placeholder="Rua, número e complemento"></div>
          <div class="field"><label for="suggest-neighborhood">Bairro</label><input id="suggest-neighborhood" name="neighborhood" maxlength="100" placeholder="Bairro do ponto"></div>
          <div class="field"><label for="suggest-city">Cidade *</label><input id="suggest-city" name="city" maxlength="100" required placeholder="Sua cidade"></div>
          <div class="field"><label for="suggest-postal-code">CEP</label><input id="suggest-postal-code" name="postalCode" inputmode="numeric" maxlength="9" pattern="[0-9]{5}-?[0-9]{3}" placeholder="00000-000"></div>
          <div class="field"><label for="suggest-hours">Horário de funcionamento *</label><input id="suggest-hours" name="hours" maxlength="120" required placeholder="Ex.: seg. a sex., 9h às 17h"></div>
          <div class="field field-wide"><label for="suggest-contact">Telefone ou contato</label><input id="suggest-contact" name="contact" maxlength="120" placeholder="Telefone, e-mail ou site"></div>
          <div class="field field-wide"><span class="field-label">Materiais recebidos * <span style="font-weight:400">(selecione ao menos um)</span></span>${categoryChecks()}</div>
          <div class="field field-wide"><label for="suggest-description">Descrição e instruções para descarte *</label><textarea id="suggest-description" name="description" maxlength="1000" required placeholder="Descreva como funciona a entrega e os cuidados necessários."></textarea></div>
        </div>
        <div class="notice">Sua sugestão ficará pendente até ser revisada. Ela só será exibida publicamente depois de aprovada.</div>
        <div class="form-actions"><button class="button" type="submit">Enviar sugestão ↗</button></div>
      </form>
      <aside class="info-aside"><h3>O que acontece depois?</h3><p>Para manter as informações úteis e confiáveis, cada sugestão é revisada antes de aparecer na busca.</p><ul><li>Preencha dados que você conseguiu confirmar.</li><li>A equipe revisará o local antes da publicação.</li><li>Seu cadastro ficará pendente durante a análise.</li></ul></aside>
    </div>
  </div></section>`;
}

function detailPage(id) {
  const point = points.find((item) => item.id === id);
  if (!point) return `<section class="page-shell"><div class="container"><div class="content-card empty-state"><span class="empty-icon">⌕</span><h3>Ponto não encontrado</h3><p>Este ponto pode ter sido removido ou não está disponível.</p><a class="button button-blue" href="#/pesquisar">Voltar à pesquisa</a></div></div></section>`;
  const location = [point.address, point.neighborhood, point.city, point.postalCode].filter(Boolean).join(", ");
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  return `<section class="page-shell"><div class="container">
    <div class="breadcrumbs"><a href="#/">Início</a><span>›</span><a href="#/pesquisar">Pontos de coleta</a><span>›</span><span>${esc(point.name)}</span></div>
    <div class="detail-grid">
      <article class="detail-card">
        <span class="verified-badge">${icons.shield} Local verificado</span><h1 class="page-heading" style="margin:14px 0 6px"><span style="font:800 30px/1.2 Manrope,sans-serif;color:var(--blue-dark)">${esc(point.name)}</span></h1>
        <div class="detail-facts"><div class="detail-fact">${icons.pin}<span>${esc(location)}</span></div><div class="detail-fact">${icons.clock}<span>${esc(point.hours)}</span></div>${point.contact ? `<div class="detail-fact">${icons.phone}<span>${esc(point.contact)}</span></div>` : ""}</div>
        <h2>Materiais aceitos</h2><div class="point-materials">${(point.categories || []).map((name) => `<span class="material-chip">${esc(name)}</span>`).join("")}</div>
        <h2>Sobre este ponto</h2><p>${esc(point.description)}</p>
      </article>
      <aside class="detail-aside"><div class="map-preview" aria-label="Ilustração de mapa"><span class="map-pin"><span>•</span></span></div><a class="button button-blue" href="${mapUrl}" target="_blank" rel="noopener noreferrer">Abrir localização no mapa ↗</a><div class="notice">Confirme o horário e a disponibilidade dos materiais diretamente com o local antes de ir.</div></aside>
    </div>
  </div></section>`;
}

function adminLoginPage() {
  const credentialsHint = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? 'Acesso de apresentação local: <strong>admin</strong> / <strong>Descarte@2026</strong>. Configure credenciais próprias com as variáveis <code>ADMIN_USER</code> e <code>ADMIN_PASSWORD</code>.'
    : 'Use o usuário e a senha administrativa configurados nas variáveis <code>ADMIN_USER</code> e <code>ADMIN_PASSWORD</code> do Render. As credenciais locais de apresentação não funcionam no site publicado.';
  return `<section class="page-shell"><div class="container admin-login-wrap">
    <div class="breadcrumbs"><a href="#/">Início</a><span>›</span><span>Área administrativa</span></div>
    <form class="content-card admin-login" id="admin-login"><span class="eyebrow"><span class="eyebrow-dot"></span>Acesso restrito</span><h1>Área administrativa</h1><p>Entre para revisar sugestões e gerenciar os pontos de coleta publicados.</p>
      <div class="field"><label for="admin-user">Usuário</label><input id="admin-user" name="username" autocomplete="username" required></div>
      <div class="field"><label for="admin-password">Senha</label><input id="admin-password" name="password" type="password" autocomplete="current-password" required></div>
      <button class="button button-blue" type="submit" style="width:100%">Entrar na área administrativa</button>
      <div class="demo-credentials">${credentialsHint}</div>
    </form>
  </div></section>`;
}

function adminPanelPage(items, feedback) {
  const pending = items.filter((item) => item.status === "pending");
  const approved = items.filter((item) => item.status === "approved");
  const rejected = items.filter((item) => item.status === "rejected");
  const feedbackRows = feedback.map((item) => `<article class="admin-feedback-row"><div class="admin-feedback-top"><div>${feedbackStars(item.rating)}<time datetime="${esc(item.createdAt)}">${new Date(item.createdAt).toLocaleDateString("pt-BR")}</time></div><button class="mini-button mini-button-delete" data-delete-feedback="${esc(item.id)}" type="button">Excluir</button></div><p>${item.comment ? esc(item.comment) : '<span class="admin-feedback-empty">Sem comentário escrito.</span>'}</p></article>`).join("");
  const row = (item) => `<div class="admin-row"><div class="admin-row-info"><strong>${esc(item.name)} <span class="${item.status === "approved" ? "verified-badge" : item.status === "rejected" ? "rejected-badge" : "pending-badge"}">${item.status === "approved" ? "Aprovado" : item.status === "rejected" ? "Rejeitado" : "Pendente"}</span></strong><span>${esc(pointLocation(item))} · ${(item.categories || []).map(esc).join(", ")}</span></div><div class="admin-row-actions"><button class="mini-button" type="button" data-edit="${esc(item.id)}">Editar</button>${item.status !== "approved" ? `<button class="mini-button mini-button-approve" type="button" data-status="${esc(item.id)}" data-value="approved">Aprovar</button>` : ""}${item.status !== "rejected" ? `<button class="mini-button mini-button-reject" type="button" data-status="${esc(item.id)}" data-value="rejected">Rejeitar</button>` : ""}<button class="mini-button mini-button-delete" type="button" data-delete="${esc(item.id)}">Excluir</button></div></div>`;
  return `<section class="page-shell"><div class="container">
    <div class="admin-toolbar"><div><span class="eyebrow"><span class="eyebrow-dot"></span>Área protegida</span><h1>Gerenciar pontos</h1></div><div class="admin-toolbar-actions"><button class="button button-secondary button-small" id="refresh-admin" type="button">Atualizar lista</button><button class="button button-danger button-small" id="admin-logout" type="button">Sair</button></div></div>
    <div class="admin-stats"><div class="content-card stat-card"><span>Sugestões pendentes</span><strong>${pending.length}</strong></div><div class="content-card stat-card"><span>Pontos publicados</span><strong>${approved.length}</strong></div><div class="content-card stat-card"><span>Não aprovados</span><strong>${rejected.length}</strong></div></div>
    <section class="admin-card"><div class="admin-card-header"><h2>Sugestões pendentes</h2><span>${pending.length} aguardando revisão</span></div><div class="admin-list">${pending.length ? pending.map(row).join("") : '<div class="admin-empty">Nenhuma sugestão aguardando revisão.</div>'}</div></section>
    <section class="admin-card"><div class="admin-card-header"><h2>Pontos publicados</h2><span>${approved.length} visíveis ao público</span></div><div class="admin-list">${approved.length ? approved.map(row).join("") : '<div class="admin-empty">Nenhum ponto aprovado até o momento.</div>'}</div></section>
    ${rejected.length ? `<section class="admin-card"><div class="admin-card-header"><h2>Sugestões não aprovadas</h2><span>${rejected.length} não publicadas</span></div><div class="admin-list">${rejected.map(row).join("")}</div></section>` : ""}
    <section class="admin-card"><div class="admin-card-header"><h2>Avaliações do site</h2><span>${feedback.length} recebidas · comentários privados</span></div><div class="admin-feedback-list">${feedbackRows || '<div class="admin-empty">Ainda não recebemos avaliações.</div>'}</div></section>
  </div></section>`;
}

function editModal(point) {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title"><div class="modal-header"><h2 id="edit-title">Editar ponto</h2><button class="modal-close" type="button" aria-label="Fechar">×</button></div>
    <form id="edit-point-form"><div class="form-grid">
      <div class="field field-wide"><label for="edit-name">Nome *</label><input id="edit-name" name="name" maxlength="100" required value="${esc(point.name)}"></div>
      <div class="field field-wide"><label for="edit-address">Endereço *</label><input id="edit-address" name="address" maxlength="180" required value="${esc(point.address)}"></div>
      <div class="field"><label for="edit-neighborhood">Bairro</label><input id="edit-neighborhood" name="neighborhood" maxlength="100" value="${esc(point.neighborhood || "")}"></div>
      <div class="field"><label for="edit-city">Cidade *</label><input id="edit-city" name="city" maxlength="100" required value="${esc(point.city)}"></div>
      <div class="field"><label for="edit-postal-code">CEP</label><input id="edit-postal-code" name="postalCode" inputmode="numeric" maxlength="9" pattern="[0-9]{5}-?[0-9]{3}" value="${esc(point.postalCode || "")}" placeholder="00000-000"></div>
      <div class="field"><label for="edit-hours">Horário *</label><input id="edit-hours" name="hours" maxlength="120" required value="${esc(point.hours)}"></div>
      <div class="field field-wide"><label for="edit-contact">Contato</label><input id="edit-contact" name="contact" maxlength="120" value="${esc(point.contact || "")}"></div>
      <div class="field field-wide"><span class="field-label">Materiais recebidos *</span>${categoryChecks(point.categories || [])}</div>
      <div class="field field-wide"><label for="edit-description">Descrição e instruções *</label><textarea id="edit-description" name="description" maxlength="1000" required>${esc(point.description)}</textarea></div>
    </div><div class="form-actions"><button class="button button-secondary" type="button" data-cancel>Cancelar</button><button class="button" type="submit">Salvar alterações</button></div></form></section>`;
  document.body.append(modal);
  modal.querySelector(".modal-close").addEventListener("click", () => modal.remove());
  modal.querySelector("[data-cancel]").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (event) => { if (event.target === modal) modal.remove(); });
  modal.querySelector("#edit-point-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    data.categories = [...form.querySelectorAll('input[name="categories"]:checked')].map((input) => input.value);
    try {
      await request(`/api/admin/points/${encodeURIComponent(point.id)}`, { method: "PATCH", body: JSON.stringify(data) });
      modal.remove();
      toast("Alterações salvas.");
      await renderAdmin();
    } catch (error) { toast(error.message, true); }
  });
  modal.querySelector("#edit-name").focus();
}

async function renderAdmin() {
  app.innerHTML = '<section class="page-shell"><div class="container loading">Carregando área administrativa…</div></section>';
  try {
    const session = await request("/api/admin/session");
    if (!session.authenticated) {
      app.innerHTML = adminLoginPage();
      app.querySelector("#admin-login").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = Object.fromEntries(new FormData(form));
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
          await request("/api/admin/login", { method: "POST", body: JSON.stringify(data) });
          toast("Acesso autorizado.");
          await renderAdmin();
        } catch (error) {
          toast(error.message, true);
          button.disabled = false;
        }
      });
      return;
    }
    const [result, feedbackResult] = await Promise.all([
      request("/api/admin/points"),
      request("/api/admin/feedback")
    ]);
    app.innerHTML = adminPanelPage(result.points, feedbackResult.feedback);
    setupScrollReveal();
    app.querySelector("#admin-logout").addEventListener("click", async () => {
      try {
        await request("/api/admin/logout", { method: "POST", body: "{}" });
        toast("Você saiu da área administrativa.");
        await renderAdmin();
      } catch (error) { toast(error.message, true); }
    });
    app.querySelector("#refresh-admin").addEventListener("click", renderAdmin);
    app.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", async () => {
      try {
        await request(`/api/admin/points/${encodeURIComponent(button.dataset.status)}`, { method: "PATCH", body: JSON.stringify({ status: button.dataset.value }) });
        toast(button.dataset.value === "approved" ? "Ponto aprovado e publicado." : "Sugestão rejeitada.");
        await renderAdmin();
      } catch (error) { toast(error.message, true); }
    }));
    app.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => {
      const point = result.points.find((item) => item.id === button.dataset.edit);
      if (point) editModal(point);
    }));
    app.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
      const point = result.points.find((item) => item.id === button.dataset.delete);
      if (!point || !window.confirm(`Excluir "${point.name}"? Esta ação não pode ser desfeita.`)) return;
      try {
        await request(`/api/admin/points/${encodeURIComponent(point.id)}`, { method: "DELETE" });
        toast("Ponto excluído.");
        await renderAdmin();
      } catch (error) { toast(error.message, true); }
    }));
    app.querySelectorAll("[data-delete-feedback]").forEach((button) => button.addEventListener("click", async () => {
      if (!window.confirm("Excluir esta avaliação? Esta ação não pode ser desfeita.")) return;
      try {
        await request(`/api/admin/feedback/${encodeURIComponent(button.dataset.deleteFeedback)}`, { method: "DELETE" });
        toast("Avaliação excluída.");
        await renderAdmin();
      } catch (error) { toast(error.message, true); }
    }));
  } catch (error) {
    app.innerHTML = `<section class="page-shell"><div class="container"><div class="content-card empty-state"><h3>Não foi possível abrir o painel</h3><p>${esc(error.message)}</p><button class="button button-secondary" id="retry-admin" type="button">Tentar novamente</button></div></div></section>`;
    app.querySelector("#retry-admin").addEventListener("click", renderAdmin);
  }
}

async function loadSearchResults() {
  const list = app.querySelector("#results-list");
  const count = app.querySelector("#results-count");
  if (!list || !count) return;
  const material = normalizeSearch(app.querySelector("#filter-material").value);
  const location = app.querySelector("#filter-location").value.trim();
  const selected = [...app.querySelectorAll('input[name="category"]:checked')].map((input) => input.value);
  list.innerHTML = '<div class="content-card loading">Buscando pontos de coleta…</div>';
  try {
    const result = await request("/api/points");
    points = result.points;
    const filtered = points.filter((point) => {
      const matchesCategory = !selected.length || selected.some((item) => point.categories.includes(item));
      const searchText = normalizeSearch(`${point.name} ${point.description} ${(point.categories || []).join(" ")} ${pointLocation(point)}`);
      return matchesCategory && (!material || searchText.includes(material)) && locationScore(point, location) >= 0;
    });
    if (location) filtered.sort((first, second) => locationScore(second, location) - locationScore(first, location));
    count.innerHTML = `<strong>${filtered.length}</strong> ${filtered.length === 1 ? "ponto encontrado" : "pontos encontrados"}`;
    list.innerHTML = filtered.length ? filtered.map(pointCard).join("") : `<div class="content-card empty-state"><span class="empty-icon">⌕</span><h3>${points.length ? "Nenhum ponto encontrado" : "Ainda não há pontos cadastrados"}</h3><p>${points.length ? "Tente mudar os filtros ou sugerir um ponto que conheça." : "Os locais aparecem aqui depois de serem sugeridos e aprovados. Conhece um? Compartilhe com a comunidade."}</p><a class="button button-blue" href="#/sugerir">Sugerir um ponto</a></div>`;
    renderMapResults();
    setupScrollReveal();
  } catch (error) {
    count.textContent = "Busca indisponível";
    list.innerHTML = `<div class="content-card empty-state"><h3>Não foi possível carregar os pontos</h3><p>${esc(error.message)}</p><button class="button button-secondary" id="retry-search" type="button">Tentar novamente</button></div>`;
    app.querySelector("#retry-search").addEventListener("click", loadSearchResults);
  }
}

function renderMapResults(message) {
  const list = app.querySelector("#map-results-list");
  const count = app.querySelector("#map-results-count");
  const status = app.querySelector("#map-results-status");
  if (!list || !count || !status) return;
  const filtered = filteredMapPoints();
  count.textContent = mapSearchCenter ? `${filtered.length} ${filtered.length === 1 ? "local" : "locais"}` : "—";
  if (message) status.textContent = message;
  else if (mapSearchCenter) {
    status.textContent = mapSearchCenter.radius < mapSearchCenter.requestedRadius
      ? `Busca reduzida para ${mapSearchCenter.radius / 1000} km perto de ${mapSearchCenter.label}.`
      : `Resultados próximos de ${mapSearchCenter.label}.`;
  }
  if (!mapSearchCenter) {
    list.innerHTML = `<div class="map-empty-hint">${icons.locate}<span>Os resultados do mapa aparecem aqui quando você iniciar uma busca por região.</span></div>`;
    return;
  }
  if (!filtered.length) {
    list.innerHTML = `<div class="map-empty-hint">${icons.search}<span>${mapPoints.length ? "Nenhum local mapeado corresponde ao material ou à categoria escolhida. Tente outro filtro ou aumente a distância da busca." : "Não encontramos pontos no mapa nessa região. Isso não significa que não existam; a cobertura do mapa varia por cidade."}</span></div>`;
    return;
  }
  list.innerHTML = filtered.map(mapPointCard).join("");
  setupScrollReveal();
}

async function findMapLocations(parameters) {
  const button = app.querySelector("#search-map");
  const locationButton = app.querySelector("#use-my-location");
  const locationField = app.querySelector("#filter-location");
  const radius = app.querySelector("#map-radius").value;
  const list = app.querySelector("#map-results-list");
  const status = app.querySelector("#map-results-status");
  const count = app.querySelector("#map-results-count");
  const buttons = [button, locationButton];
  buttons.forEach((item) => { item.disabled = true; });
  list.innerHTML = '<div class="map-empty-hint map-loading"><span class="map-loader" aria-hidden="true"></span><span>Procurando locais no mapa…</span></div>';
  count.textContent = "…";
  status.textContent = "Consultando o mapa comunitário. Isso pode levar alguns segundos.";
  try {
    const query = new URLSearchParams({ radius, ...parameters });
    const result = await request(`/api/map/search?${query}`);
    mapPoints = result.points;
    mapSearchCenter = { label: result.locationLabel, radius: result.radius, requestedRadius: Number(radius) };
    mapSearchParams = parameters;
    if (result.radius < Number(radius)) app.querySelector("#map-radius").value = String(result.radius);
    const reducedRadius = result.radius < Number(radius);
    const message = reducedRadius
      ? `A busca ampla demorou; mostramos os resultados próximos de ${result.locationLabel} em um raio reduzido de ${result.radius / 1000} km.`
      : `Resultados próximos de ${result.locationLabel}.`;
    renderMapResults(message);
    if (!result.points.length) toast("Nenhum local mapeado foi encontrado nessa distância. Experimente aumentar o raio.");
  } catch (error) {
    mapPoints = [];
    mapSearchCenter = null;
    renderMapResults(error.message);
    count.textContent = "Indisponível";
    list.innerHTML = `<div class="map-empty-hint map-error">${icons.search}<span>${esc(error.message)}</span></div>`;
  } finally {
    buttons.forEach((item) => { item.disabled = false; });
    if (locationField) locationField.removeAttribute("aria-busy");
  }
}

function bindSearch() {
  const material = app.querySelector("#filter-material");
  const location = app.querySelector("#filter-location");
  let searchTimeout;
  const schedule = () => {
    window.clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(loadSearchResults, 180);
  };
  material.addEventListener("input", () => { schedule(); renderMapResults(); });
  location.addEventListener("input", schedule);
  app.querySelectorAll('input[name="category"]').forEach((input) => input.addEventListener("change", () => {
    loadSearchResults();
    renderMapResults();
  }));
  app.querySelector("#search-map").addEventListener("click", () => {
    const place = location.value.trim();
    if (!place) {
      location.focus();
      toast("Digite uma cidade, bairro ou CEP para buscar locais no mapa.", true);
      return;
    }
    location.setAttribute("aria-busy", "true");
    findMapLocations({ place });
  });
  app.querySelector("#use-my-location").addEventListener("click", async () => {
    if (!navigator.geolocation) {
      toast("Este navegador não oferece acesso à localização. Digite sua cidade ou bairro para buscar.", true);
      return;
    }
    const button = app.querySelector("#use-my-location");
    try {
      const permission = await navigator.permissions?.query({ name: "geolocation" });
      if (permission?.state === "denied") {
        toast("A localização está bloqueada para este site. Abra as permissões do navegador e permita Localização, ou pesquise sua cidade manualmente.", true);
        app.querySelector("#map-results-status").textContent = "Localização bloqueada pelo navegador. Digite sua cidade ou bairro para encontrar locais no mapa.";
        return;
      }
    } catch {
      // Older browsers may not expose the Permissions API; getCurrentPosition remains the fallback.
    }
    button.disabled = true;
    app.querySelector("#map-results-status").textContent = "Aguardando autorização do navegador para acessar sua localização…";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        app.querySelector("#filter-location").value = "";
        findMapLocations({
          lat: position.coords.latitude.toString(),
          lon: position.coords.longitude.toString()
        });
      },
      (error) => {
        button.disabled = false;
        const messages = {
          1: "O acesso à localização foi bloqueado. No navegador, abra as permissões do site e permita Localização; ou busque sua cidade no campo ao lado.",
          2: "Não foi possível determinar sua localização. Confira se a localização do dispositivo está ativada ou pesquise por cidade.",
          3: "A localização demorou demais. Confira as permissões do site no navegador ou pesquise sua cidade manualmente."
        };
        toast(messages[error.code] || "Não foi possível obter sua localização.", true);
        app.querySelector("#map-results-status").textContent = "Sua localização não foi compartilhada. Você pode buscar digitando uma cidade ou bairro.";
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 12000 }
    );
  });
  app.querySelector("#map-radius").addEventListener("change", () => {
    if (mapSearchParams) findMapLocations(mapSearchParams);
  });
  app.querySelector("#clear-filters").addEventListener("click", () => {
    material.value = "";
    location.value = "";
    mapPoints = [];
    mapSearchCenter = null;
    mapSearchParams = null;
    app.querySelector("#map-results-status").textContent = "Busque por cidade ou permita sua localização para encontrar locais mapeados pela comunidade OpenStreetMap.";
    app.querySelectorAll('input[name="category"]').forEach((input) => { input.checked = false; });
    loadSearchResults();
  });
  loadSearchResults();
}

async function render() {
  const route = routePath();
  currentRoute = route;
  nav.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  if (route === "/" || route === "/como-funciona") {
    app.innerHTML = homePage();
    bindFeedbackForm();
    app.querySelector("#hero-search").addEventListener("submit", (event) => {
      event.preventDefault();
      const material = new FormData(event.currentTarget).get("material").toString().trim();
      window.location.hash = `/pesquisar${material ? `?material=${encodeURIComponent(material)}` : ""}`;
    });
  } else if (route === "/pesquisar") {
    app.innerHTML = searchPage();
    bindSearch();
  } else if (route === "/sugerir") {
    app.innerHTML = suggestionPage();
    const suggestionForm = app.querySelector("#suggestion-form");
    suggestionForm.querySelectorAll('input[name="categories"]').forEach((input) => {
      const option = input.closest(".category-option");
      const updateOption = () => option.classList.toggle("is-selected", input.checked);
      updateOption();
      input.addEventListener("change", updateOption);
    });
    suggestionForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form));
      data.categories = [...form.querySelectorAll('input[name="categories"]:checked')].map((input) => input.value);
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await request("/api/suggestions", { method: "POST", body: JSON.stringify(data) });
        toast("Sugestão enviada! Ela ficará pendente até ser revisada.");
        form.reset();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        toast(error.message, true);
      } finally { button.disabled = false; }
    });
  } else if (route.startsWith("/ponto/")) {
    try {
      const result = await request("/api/points");
      points = result.points;
    } catch (error) {
      app.innerHTML = `<section class="page-shell"><div class="container"><div class="content-card empty-state"><h3>Não foi possível carregar o ponto</h3><p>${esc(error.message)}</p><a class="button button-blue" href="#/pesquisar">Voltar à pesquisa</a></div></div></section>`;
      return;
    }
    app.innerHTML = detailPage(decodeURIComponent(route.slice("/ponto/".length)));
  } else if (route === "/admin") {
    await renderAdmin();
  } else {
    app.innerHTML = `<section class="page-shell"><div class="container"><div class="content-card empty-state"><span class="empty-icon">⌕</span><h3>Página não encontrada</h3><p>O endereço que você procurou não existe.</p><a class="button button-blue" href="#/">Voltar ao início</a></div></div></section>`;
  }
  setupScrollReveal();
  if (currentRoute === route) {
    app.focus({ preventScroll: true });
    if (route === "/como-funciona") document.querySelector("#como-funciona")?.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

const themeToggle = document.querySelector("#theme-toggle");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === "dark";
  themeToggle.setAttribute("aria-label", dark ? "Ativar tema claro" : "Ativar tema escuro");
  themeToggle.setAttribute("title", dark ? "Usar tema claro" : "Usar tema escuro");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#10201b" : "#183c36");
}

const savedTheme = localStorage.getItem("descarte-certo-theme");
const preferredTheme = savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
applyTheme(preferredTheme);

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("descarte-certo-theme", nextTheme);
  applyTheme(nextTheme);
});

menuToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(open));
});
nav.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    nav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
  }
});
window.addEventListener("hashchange", render);
render();
