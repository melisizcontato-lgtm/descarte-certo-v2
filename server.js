const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "points.json");
const FEEDBACK_FILE = path.join(DATA_DIR, "feedback.json");
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Descarte@2026";
const PASSWORD_SALT = crypto.randomBytes(16);
const PASSWORD_HASH = crypto.scryptSync(ADMIN_PASSWORD, PASSWORD_SALT, 64);
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new Map();
const feedbackSubmissions = new Map();
const CATEGORIES = ["Eletrônicos", "Pilhas e baterias", "Óleo de cozinha", "Roupas e tecidos", "Móveis", "Recicláveis", "Outros"];
const MAX_BODY_BYTES = 32 * 1024;
const NOMINATIM_CONTACT = process.env.NOMINATIM_CONTACT || "http://localhost:3000/";
const NOMINATIM_USER_AGENT = `DescarteCerto/1.0 (${NOMINATIM_CONTACT})`;
const OVERPASS_URLS = [...new Set([
  process.env.OVERPASS_URL,
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter"
].filter(Boolean))];
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const MAP_CACHE_TTL_MS = 10 * 60 * 1000;
const mapCache = new Map();
let nextNominatimRequestAt = 0;
let nextMapRequestAt = 0;
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]\n", { flag: "wx" });
if (!fs.existsSync(FEEDBACK_FILE)) fs.writeFileSync(FEEDBACK_FILE, "[]\n", { flag: "wx" });

function readPoints() {
  const contents = fs.readFileSync(DATA_FILE, "utf8");
  const points = JSON.parse(contents);
  if (!Array.isArray(points)) throw new Error("O banco de dados de pontos deve ser uma lista.");
  return points;
}

function writePoints(points) {
  const temporary = `${DATA_FILE}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(points, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(temporary, DATA_FILE);
}

function readFeedback() {
  const contents = fs.readFileSync(FEEDBACK_FILE, "utf8");
  const feedback = JSON.parse(contents);
  if (!Array.isArray(feedback)) throw new Error("O banco de dados de avaliações deve ser uma lista.");
  return feedback;
}

function writeFeedback(feedback) {
  const temporary = `${FEEDBACK_FILE}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(feedback, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(temporary, FEEDBACK_FILE);
}

function feedbackSummary(feedback) {
  const distribution = [1, 2, 3, 4, 5].map((rating) => feedback.filter((item) => item.rating === rating).length);
  const total = feedback.reduce((sum, item) => sum + item.rating, 0);
  return {
    count: feedback.length,
    average: feedback.length ? Number((total / feedback.length).toFixed(2)) : null,
    distribution
  };
}

function json(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(res.corsHeaders || {}),
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function localDevelopmentOrigin(origin) {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function setApiCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (!origin || !localDevelopmentOrigin(origin)) return;
  res.corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const separator = part.indexOf("=");
    return separator < 0 ? ["", ""] : [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
  }).filter(([key]) => key));
}

function adminSession(req) {
  const token = parseCookies(req.headers.cookie).dc_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return token;
}

function requireAdmin(req, res) {
  if (adminSession(req)) return true;
  json(res, 401, { error: "Sua sessão expirou. Entre novamente." });
  return false;
}

function sameOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    if (new URL(origin).host === req.headers.host) return true;
    const target = new URL(`http://${req.headers.host}`);
    if (["localhost", "127.0.0.1"].includes(target.hostname) && localDevelopmentOrigin(origin)) return true;
  } catch {}
  json(res, 403, { error: "Origem da solicitação não autorizada." });
  return false;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let tooLarge = false;
    req.on("data", (chunk) => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        tooLarge = true;
        reject(Object.assign(new Error("O formulário excede o tamanho permitido."), { status: 413 }));
      }
    });
    req.on("end", () => {
      if (tooLarge) return;
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(Object.assign(new Error("O formato dos dados enviados é inválido."), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

function cleanString(value, label, maxLength, required = true) {
  if (typeof value !== "string") {
    if (!required && (value === undefined || value === null)) return "";
    throw Object.assign(new Error(`Informe ${label}.`), { status: 400 });
  }
  const clean = value.trim();
  if (required && !clean) throw Object.assign(new Error(`Informe ${label}.`), { status: 400 });
  if (clean.length > maxLength) throw Object.assign(new Error(`${label} deve ter no máximo ${maxLength} caracteres.`), { status: 400 });
  return clean;
}

function validatePoint(body) {
  const categories = body.categories;
  if (!Array.isArray(categories) || categories.length === 0 || categories.some((category) => !CATEGORIES.includes(category))) {
    throw Object.assign(new Error("Selecione ao menos uma categoria válida."), { status: 400 });
  }
  return {
    name: cleanString(body.name, "o nome do estabelecimento", 100),
    address: cleanString(body.address, "o endereço", 180),
    neighborhood: cleanString(body.neighborhood, "o bairro", 100, false),
    city: cleanString(body.city, "a cidade", 100),
    postalCode: normalizePostalCode(cleanString(body.postalCode, "o CEP", 9, false)),
    hours: cleanString(body.hours, "o horário de funcionamento", 120),
    contact: cleanString(body.contact, "um contato válido", 120, false),
    description: cleanString(body.description, "a descrição e as instruções", 1000),
    categories: [...new Set(categories)]
  };
}

function normalizePostalCode(value) {
  const digits = value.replace(/\D/g, "");
  if (digits && digits.length !== 8) {
    throw Object.assign(new Error("Informe um CEP válido com 8 números."), { status: 400 });
  }
  return digits ? `${digits.slice(0, 5)}-${digits.slice(5)}` : "";
}

function comparePassword(password) {
  if (typeof password !== "string" || password.length > 200) return false;
  const candidate = crypto.scryptSync(password, PASSWORD_SALT, 64);
  return crypto.timingSafeEqual(candidate, PASSWORD_HASH);
}

function clientIp(req) {
  return req.socket.remoteAddress || "unknown";
}

function getCachedMapValue(key) {
  const cached = mapCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    mapCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedMapValue(key, value) {
  if (mapCache.size >= 300) {
    const firstKey = mapCache.keys().next().value;
    if (firstKey) mapCache.delete(firstKey);
  }
  mapCache.set(key, { value, expiresAt: Date.now() + MAP_CACHE_TTL_MS });
}

async function getMapJson(url, options = {}, timeoutMs = 20000) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error.name === "TimeoutError") throw Object.assign(new Error("O serviço do mapa demorou demais para responder. Tente novamente."), { status: 504 });
    throw Object.assign(new Error("Não foi possível conectar ao serviço do OpenStreetMap. Tente novamente."), { status: 502 });
  }
  if (!response.ok) {
    const status = response.status === 429 || response.status >= 500 ? 503 : 502;
    throw Object.assign(new Error("O serviço do mapa está temporariamente indisponível. Tente novamente em alguns instantes."), { status });
  }
  try { return await response.json(); }
  catch { throw Object.assign(new Error("O serviço do mapa retornou uma resposta inválida."), { status: 502 }); }
}

async function searchNominatim(place) {
  const key = `place:${place.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}`;
  const cached = getCachedMapValue(key);
  if (cached) return cached;

  const requestAt = Math.max(Date.now(), nextNominatimRequestAt);
  nextNominatimRequestAt = requestAt + NOMINATIM_MIN_INTERVAL_MS;
  if (requestAt > Date.now()) await new Promise((resolve) => setTimeout(resolve, requestAt - Date.now()));

  const query = new URLSearchParams({ format: "jsonv2", countrycodes: "br", limit: "1", q: place });
  let results;
  try {
    results = await getMapJson(`https://nominatim.openstreetmap.org/search?${query}`, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9" }
    }, 12000);
  } catch (nominatimError) {
    const photonQuery = new URLSearchParams({ q: place, limit: "1", lang: "pt", osm_tag: "place" });
    try {
      const photon = await getMapJson(`https://photon.komoot.io/api/?${photonQuery}`, {}, 12000);
      if (Array.isArray(photon.features) && photon.features.length) {
        const feature = photon.features[0];
        results = [{
          lat: feature.geometry.coordinates[1],
          lon: feature.geometry.coordinates[0],
          display_name: [feature.properties.name, feature.properties.city, feature.properties.state].filter(Boolean).join(", ")
        }];
      }
    } catch {
      throw nominatimError;
    }
  }
  if (!Array.isArray(results) || !results.length) {
    throw Object.assign(new Error("Não encontramos esse lugar no mapa. Confira o nome da cidade ou bairro e tente novamente."), { status: 404 });
  }
  const result = {
    lat: Number(results[0].lat),
    lon: Number(results[0].lon),
    label: String(results[0].display_name || place).split(",").slice(0, 3).join(",").trim()
  };
  if (!Number.isFinite(result.lat) || !Number.isFinite(result.lon)) {
    throw Object.assign(new Error("Não foi possível localizar esse endereço no mapa."), { status: 502 });
  }
  setCachedMapValue(key, result);
  return result;
}

function distanceInKm(firstLat, firstLon, secondLat, secondLon) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDifference = radians(secondLat - firstLat);
  const longitudeDifference = radians(secondLon - firstLon);
  const a = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(radians(firstLat)) * Math.cos(radians(secondLat)) * Math.sin(longitudeDifference / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function osmCategories(tags) {
  const tagCategories = {
    "recycling:electrical_appliances": "Eletrônicos",
    "recycling:small_appliances": "Eletrônicos",
    "recycling:computers": "Eletrônicos",
    "recycling:mobile_phones": "Eletrônicos",
    "recycling:electronics": "Eletrônicos",
    "recycling:batteries": "Pilhas e baterias",
    "recycling:battery": "Pilhas e baterias",
    "recycling:cooking_oil": "Óleo de cozinha",
    "recycling:oil": "Óleo de cozinha",
    "recycling:clothes": "Roupas e tecidos",
    "recycling:shoes": "Roupas e tecidos",
    "recycling:textiles": "Roupas e tecidos",
    "recycling:furniture": "Móveis",
    "recycling:paper": "Recicláveis",
    "recycling:cardboard": "Recicláveis",
    "recycling:plastic": "Recicláveis",
    "recycling:glass": "Recicláveis",
    "recycling:metal": "Recicláveis",
    "recycling:cans": "Recicláveis"
  };
  const acceptedValues = new Set(["yes", "only", "designated", "public"]);
  return [...new Set(Object.entries(tagCategories)
    .filter(([tag]) => acceptedValues.has(String(tags[tag] || "").toLowerCase()))
    .map(([, category]) => category))];
}

function mapElementsToPoints(elements, center) {
  return elements.flatMap((element) => {
    const tags = element.tags || {};
    const latitude = Number(element.lat ?? element.center?.lat);
    const longitude = Number(element.lon ?? element.center?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    const isWaste = tags.amenity === "waste_disposal";
    const address = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(", ");
    const categories = osmCategories(tags);
    const name = tags.name || (isWaste ? "Local de descarte mapeado" : tags.recycling_type === "centre" ? "Centro de reciclagem mapeado" : "Ponto de reciclagem mapeado");
    const search = new URLSearchParams({ mlat: String(latitude), mlon: String(longitude), zoom: "17" });
    return [{
      id: `${element.type}/${element.id}`,
      name,
      kind: isWaste ? "waste" : "recycling",
      address,
      neighborhood: tags["addr:suburb"] || tags["addr:neighbourhood"] || "",
      city: tags["addr:city"] || "",
      hours: tags.opening_hours || "",
      contact: tags.phone || tags["contact:phone"] || "",
      categories,
      distanceKm: distanceInKm(center.lat, center.lon, latitude, longitude),
      mapUrl: `https://www.openstreetmap.org/?${search}`
    }];
  }).sort((first, second) => first.distanceKm - second.distanceKm);
}

async function searchOverpassAtRadius(center, radius) {
  const cacheKey = `points:${center.lat.toFixed(4)}:${center.lon.toFixed(4)}:${radius}`;
  const cached = getCachedMapValue(cacheKey);
  if (cached) return { points: cached, radius };

  const requestAt = Math.max(Date.now(), nextMapRequestAt);
  nextMapRequestAt = requestAt + 1000;
  if (requestAt > Date.now()) await new Promise((resolve) => setTimeout(resolve, requestAt - Date.now()));

  const latitude = center.lat.toFixed(6);
  const longitude = center.lon.toFixed(6);
  const query = `[out:json][timeout:15];(nwr(around:${radius},${latitude},${longitude})["amenity"="recycling"]["access"!~"^(private|no)$"];nwr(around:${radius},${latitude},${longitude})["amenity"="waste_disposal"]["access"!~"^(private|no)$"];);out center tags 100;`;
  let response;
  let lastError;
  const attempts = await Promise.allSettled(OVERPASS_URLS.map((overpassUrl) => getMapJson(overpassUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": NOMINATIM_USER_AGENT
    },
    body: new URLSearchParams({ data: query })
  }, 15000)));
  for (const attempt of attempts) {
    if (attempt.status === "fulfilled" && Array.isArray(attempt.value.elements)) {
      response = attempt.value;
      break;
    }
    if (attempt.status === "rejected") lastError = attempt.reason;
  }
  if (!response || !Array.isArray(response.elements)) {
    throw lastError || Object.assign(new Error("O serviço do mapa está temporariamente indisponível. Tente novamente."), { status: 503 });
  }
  if (response.remark) {
    const timedOut = /timed out|timeout/i.test(response.remark);
    throw Object.assign(new Error(timedOut
      ? "A busca nessa distância demorou demais para o serviço do mapa."
      : "O serviço do mapa não conseguiu concluir a busca. Tente novamente."), { status: timedOut ? 504 : 503 });
  }
  const result = mapElementsToPoints(response.elements, center).slice(0, 100);
  setCachedMapValue(cacheKey, result);
  return { points: result, radius };
}

async function searchOverpass(center, radius) {
  try {
    return await searchOverpassAtRadius(center, radius);
  } catch (error) {
    if (error.status !== 504 || radius <= 5000) throw error;
    console.warn(`Busca de mapa excedeu o tempo em ${radius} m; tentando novamente em 5 km.`);
    return searchOverpassAtRadius(center, 5000);
  }
}

async function handleApi(req, res, url) {
  const route = url.pathname;
  if (route.startsWith("/api/") && req.method === "OPTIONS") {
    if (!res.corsHeaders) return json(res, 403, { error: "Origem da solicitação não autorizada." });
    res.writeHead(204, { ...(res.corsHeaders || {}), "Cache-Control": "no-store" });
    return res.end();
  }
  if (req.method === "GET" && route === "/api/map/search") {
    const radius = Number(url.searchParams.get("radius") || 10000);
    if (!Number.isInteger(radius) || radius < 1000 || radius > 20000) {
      return json(res, 400, { error: "Escolha uma distância entre 1 e 20 km." });
    }

    let center;
    let locationLabel;
    const place = (url.searchParams.get("place") || "").trim();
    const latitude = url.searchParams.get("lat");
    const longitude = url.searchParams.get("lon");
    if (place) {
      if (place.length > 150) return json(res, 400, { error: "O local pesquisado deve ter no máximo 150 caracteres." });
      center = await searchNominatim(place);
      locationLabel = center.label;
    } else if (latitude !== null && longitude !== null) {
      center = { lat: Number(latitude), lon: Number(longitude) };
      if (!Number.isFinite(center.lat) || !Number.isFinite(center.lon)
        || center.lat < -35 || center.lat > 6 || center.lon < -75 || center.lon > -32) {
        return json(res, 400, { error: "A localização precisa estar dentro do Brasil." });
      }
      locationLabel = "sua localização";
    } else {
      return json(res, 400, { error: "Informe uma cidade/bairro ou compartilhe sua localização." });
    }

    const results = await searchOverpass(center, radius);
    return json(res, 200, {
      locationLabel,
      radius: results.radius,
      points: results.points.map((point) => ({ ...point, distanceKm: Number(point.distanceKm.toFixed(2)) }))
    });
  }
  if (req.method === "GET" && route === "/api/points") {
    const points = readPoints().filter((point) => point.status === "approved")
      .map(({ id, name, address, neighborhood, city, postalCode, hours, categories, description, contact }) => ({ id, name, address, neighborhood, city, postalCode, hours, categories, description, contact }));
    return json(res, 200, { points });
  }
  if (req.method === "GET" && route === "/api/feedback/summary") {
    return json(res, 200, feedbackSummary(readFeedback()));
  }
  if (req.method === "POST" && route === "/api/feedback") {
    if (!sameOrigin(req, res)) return;
    const body = await readBody(req);
    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
      return json(res, 400, { error: "Escolha uma avaliação entre 1 e 5 estrelas." });
    }
    const comment = cleanString(body.comment, "o comentário", 500, false);
    const ip = clientIp(req);
    const now = Date.now();
    const previousSubmission = feedbackSubmissions.get(ip);
    if (previousSubmission && now - previousSubmission < 30000) {
      return json(res, 429, { error: "Aguarde 30 segundos antes de enviar outra avaliação." });
    }
    if (feedbackSubmissions.size > 500) {
      for (const [address, timestamp] of feedbackSubmissions) {
        if (now - timestamp >= 30000) feedbackSubmissions.delete(address);
      }
    }
    const feedback = readFeedback();
    const record = { id: crypto.randomUUID(), rating: body.rating, comment, createdAt: new Date(now).toISOString() };
    feedback.unshift(record);
    writeFeedback(feedback);
    feedbackSubmissions.set(ip, now);
    return json(res, 201, { message: "Obrigado por avaliar o Descarte Certo.", summary: feedbackSummary(feedback) });
  }
  if (req.method === "POST" && route === "/api/suggestions") {
    if (!sameOrigin(req, res)) return;
    const body = await readBody(req);
    const point = validatePoint(body);
    const points = readPoints();
    const record = { id: crypto.randomUUID(), ...point, status: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    points.unshift(record);
    writePoints(points);
    return json(res, 201, { message: "Sugestão recebida para revisão.", id: record.id });
  }
  if (req.method === "GET" && route === "/api/admin/session") {
    return json(res, 200, { authenticated: Boolean(adminSession(req)) });
  }
  if (req.method === "POST" && route === "/api/admin/login") {
    if (!sameOrigin(req, res)) return;
    const ip = clientIp(req);
    const now = Date.now();
    const attempt = loginAttempts.get(ip);
    if (attempt && attempt.lockedUntil > now) return json(res, 429, { error: "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente." });
    const body = await readBody(req);
    const validUser = typeof body.username === "string" && body.username === ADMIN_USER;
    const validPassword = comparePassword(body.password);
    if (!validUser || !validPassword) {
      const failed = attempt && attempt.lockedUntil <= now ? { count: 0, lockedUntil: 0 } : (attempt || { count: 0, lockedUntil: 0 });
      failed.count += 1;
      if (failed.count >= 5) failed.lockedUntil = now + 15 * 60 * 1000;
      loginAttempts.set(ip, failed);
      return json(res, 401, { error: "Usuário ou senha incorretos." });
    }
    loginAttempts.delete(ip);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { expiresAt: now + SESSION_TTL_MS });
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return json(res, 200, { authenticated: true }, { "Set-Cookie": `dc_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure}` });
  }
  if (req.method === "POST" && route === "/api/admin/logout") {
    if (!sameOrigin(req, res)) return;
    const token = parseCookies(req.headers.cookie).dc_session;
    if (token) sessions.delete(token);
    return json(res, 200, { authenticated: false }, { "Set-Cookie": "dc_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
  }
  if (route === "/api/admin/points" && req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    return json(res, 200, { points: readPoints() });
  }
  if (route === "/api/admin/feedback" && req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    return json(res, 200, { feedback: readFeedback() });
  }
  const feedbackMatch = route.match(/^\/api\/admin\/feedback\/([0-9a-f-]{36})$/i);
  if (feedbackMatch && req.method === "DELETE") {
    if (!sameOrigin(req, res) || !requireAdmin(req, res)) return;
    const feedback = readFeedback();
    const index = feedback.findIndex((item) => item.id === feedbackMatch[1]);
    if (index < 0) return json(res, 404, { error: "A avaliação solicitada não existe mais." });
    feedback.splice(index, 1);
    writeFeedback(feedback);
    return json(res, 200, { message: "Avaliação excluída.", summary: feedbackSummary(feedback) });
  }
  const match = route.match(/^\/api\/admin\/points\/([0-9a-f-]{36})$/i);
  if (match && ["PATCH", "DELETE"].includes(req.method)) {
    if (!sameOrigin(req, res) || !requireAdmin(req, res)) return;
    const points = readPoints();
    const index = points.findIndex((point) => point.id === match[1]);
    if (index < 0) return json(res, 404, { error: "O ponto solicitado não existe mais." });
    if (req.method === "DELETE") {
      points.splice(index, 1);
      writePoints(points);
      return json(res, 200, { message: "Ponto excluído." });
    }
    const body = await readBody(req);
    const statuses = ["pending", "approved", "rejected"];
    if (Object.hasOwn(body, "status")) {
      if (!statuses.includes(body.status)) return json(res, 400, { error: "Situação inválida." });
      points[index].status = body.status;
      points[index].updatedAt = new Date().toISOString();
    } else {
      Object.assign(points[index], validatePoint(body), { updatedAt: new Date().toISOString() });
    }
    writePoints(points);
    return json(res, 200, { point: points[index] });
  }
  return json(res, 404, { error: "Rota não encontrada." });
}

function sendStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const file = path.resolve(ROOT, `.${requested}`);
  if (!file.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" });
    return res.end("Página não encontrada.");
  }
  const extension = path.extname(file).toLowerCase();
  if (!mimeTypes[extension]) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Arquivo não encontrado.");
  }
  const body = fs.readFileSync(file);
  res.writeHead(200, {
    "Content-Type": mimeTypes[extension],
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:; connect-src 'self' http://localhost:3000 http://127.0.0.1:3000; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    "Cache-Control": "no-cache"
  });
  if (req.method === "HEAD") return res.end();
  return res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      setApiCorsHeaders(req, res);
      await handleApi(req, res, url);
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Método não permitido.");
    }
    sendStatic(req, res, url.pathname);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.url}:`, error);
    if (res.headersSent) return res.end();
    json(res, error.status || 500, { error: error.status ? error.message : "Não foi possível concluir a operação. Tente novamente." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Descarte Certo disponível em http://localhost:${PORT}`);
  console.log(`Usuário administrativo: ${ADMIN_USER}`);
  if (ADMIN_PASSWORD === "Descarte@2026") console.warn("Usando senha de apresentação. Configure ADMIN_PASSWORD antes de expor o servidor à rede.");
});
