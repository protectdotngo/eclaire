// Take9 mockup — carte + chatbot simulé "façon LLM" (streaming, mémoire de
// conversation, clarification, refus hors-sujet). Tout est local : aucune API.

/* ─── Map ─── */
const map = L.map("map", { minZoom: 3 }).setView([39.5, -98.35], 4);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const pinIcon = L.divIcon({ className: "", html: '<div class="marker-pin"></div>', iconSize: [20, 20], iconAnchor: [10, 20] });
const cluster = L.markerClusterGroup({
  iconCreateFunction: (c) =>
    L.divIcon({ html: `<div class="marker-cluster-custom" style="width:38px;height:38px">${c.getChildCount()}</div>`, className: "", iconSize: [38, 38] }),
});
const markersById = {};
for (const o of ORGS) {
  const m = L.marker([o.lat, o.lon], { icon: pinIcon }).bindPopup(
    `<b>${o.name}</b><br><small>${o.city}, ${o.state}</small><br>${o.desc}`
  );
  markersById[o.id] = m;
  cluster.addLayer(m);
}
map.addLayer(cluster);
document.getElementById("orgCount").textContent = ORGS.length;

// Leaflet fige la taille du conteneur à l'init : sans ça, après un
// redimensionnement la moitié de la carte ne répond plus à la souris.
new ResizeObserver(() => map.invalidateSize()).observe(document.getElementById("map"));

function focusOrgs(orgs) {
  if (!orgs.length) return;
  const bounds = L.latLngBounds(orgs.map((o) => [o.lat, o.lon]));
  map.flyToBounds(bounds.pad(0.4), { maxZoom: 9, duration: 1.2 });
}

/* ─── "NLU" simulée : normalisation + tolérance aux fautes ─── */
function norm(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
// distance d'édition ≤1 pour absorber les typos (scma → scam, phishng → phishing)
function fuzzyHas(text, word) {
  if (text.includes(word)) return true;
  if (word.length < 5) return false;
  for (const t of text.split(/[^a-z0-9]+/)) {
    // préfixe commun de 5 lettres sur les mots longs : absorbe les typos de fin
    // de mot et les transpositions (grandmohter → grandmother)
    if (word.length >= 6 && t.length >= 5 && t.slice(0, 5) === word.slice(0, 5)) return true;
    if (Math.abs(t.length - word.length) > 1) continue;
    let i = 0, j = 0, edits = 0;
    while (i < t.length && j < word.length) {
      if (t[i] === word[j]) { i++; j++; continue; }
      if (++edits > 1) break;
      if (t.length > word.length) i++;
      else if (t.length < word.length) j++;
      else { i++; j++; }
    }
    if (edits + (t.length - i) + (word.length - j) <= 1) return true;
  }
  return false;
}

const TOPICS = [
  { cat: "elder", words: ["senior", "seniors", "elder", "elderly", "grandma", "grandpa", "grandmother", "grandfather", "grandparent", "retired", "retirees", "older", "mom", "dad", "mother", "father", "aging"] },
  { cat: "phishing", words: ["phishing", "email", "emails", "text", "sms", "link", "click", "clicked", "spam", "suspicious"] },
  { cat: "romance", words: ["romance", "dating", "love", "sweetheart", "boyfriend", "girlfriend", "relationship", "tinder"] },
  { cat: "crypto", words: ["crypto", "bitcoin", "investment", "investing", "trading", "wallet", "exchange", "returns"] },
  { cat: "identity", words: ["identity", "ssn", "social security", "credit", "breach", "stolen", "impersonation"] },
  { cat: "tech-support-scams", words: ["tech support", "popup", "pop-up", "microsoft", "computer call", "remote access", "antivirus", "phone call", "caller", "weird call", "suspicious call", "bank call"] },
  { cat: "reporting", words: ["report", "reporting", "complaint", "scammed", "victim", "lost money", "stole", "fraud", "police"] },
  { cat: "education", words: ["workshop", "workshops", "learn", "learning", "training", "class", "classes", "teach", "prevention", "course"] },
];

const OFF_TOPIC = ["recipe", "cake", "cook", "weather", "football", "movie", "poem", "joke", "homework", "translate", "president", "election"];
const SCAM_HINTS = ["scam", "scams", "fraud", "help", "call", "money", "online", "phone", "protect", "safe"];

const STATE_NAMES = { alabama:"AL", alaska:"AK", arizona:"AZ", arkansas:"AR", california:"CA", colorado:"CO", connecticut:"CT", delaware:"DE", florida:"FL", georgia:"GA", hawaii:"HI", idaho:"ID", illinois:"IL", indiana:"IN", iowa:"IA", kansas:"KS", kentucky:"KY", louisiana:"LA", maine:"ME", maryland:"MD", massachusetts:"MA", michigan:"MI", minnesota:"MN", mississippi:"MS", missouri:"MO", montana:"MT", nebraska:"NE", nevada:"NV", "new hampshire":"NH", "new jersey":"NJ", "new mexico":"NM", "new york":"NY", "north carolina":"NC", "north dakota":"ND", ohio:"OH", oklahoma:"OK", oregon:"OR", pennsylvania:"PA", "rhode island":"RI", "south carolina":"SC", "south dakota":"SD", tennessee:"TN", texas:"TX", utah:"UT", vermont:"VT", virginia:"VA", washington:"WA", "west virginia":"WV", wisconsin:"WI", wyoming:"WY", "washington dc":"DC" };

function detectLocation(nq, rawQ) {
  const cities = [...new Set(ORGS.map((o) => o.city))].filter((c) => nq.includes(norm(c)));
  if (cities.length) {
    const city = cities.sort((a, b) => b.length - a.length)[0];
    return { label: city, orgs: ORGS.filter((o) => o.city === city) };
  }
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (nq.includes(name) || new RegExp(`\\b${code}\\b`).test(rawQ)) {
      const orgs = ORGS.filter((o) => o.state === code);
      if (orgs.length) return { label: name.replace(/\b\w/g, (c) => c.toUpperCase()), orgs };
    }
  }
  return null;
}

/* ─── Mémoire de conversation (comme l'historique d'éclaire) ─── */
const memory = { topics: [], loc: null, pool: [], offset: 0, clarifyCount: 0 };

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function analyse(rawQ) {
  const nq = norm(rawQ);
  const topics = TOPICS.filter((t) => t.words.some((w) => fuzzyHas(nq, w))).map((t) => t.cat);
  const loc = detectLocation(nq, rawQ);
  const wantsMore = /\b(more|others|other ones|next|another)\b/.test(nq);
  const offTopic = OFF_TOPIC.some((w) => fuzzyHas(nq, w)) && !topics.length;
  const scamHint = SCAM_HINTS.some((w) => fuzzyHas(nq, w));
  return { nq, topics, loc, wantsMore, offTopic, scamHint };
}

function buildReply(rawQ) {
  const a = analyse(rawQ);

  // Sortie D — hors périmètre, refus poli (comme éclaire)
  if (a.offTopic) {
    memory.clarifyCount = 0;
    return { kind: "text", text: pick([
      "I'm only here for scam and fraud questions — who can help you, where to report, how to learn the reflexes. I can't help with that one. What can I look up for you on the scam side?",
      "That's outside my lane! I stick to scams: local help, reporting, prevention workshops. Want me to find something like that near you?",
    ]) };
  }

  // "more / others" — pagination sur la recherche précédente
  if (a.wantsMore && memory.pool.length > memory.offset) {
    const orgs = memory.pool.slice(memory.offset, memory.offset + 3);
    memory.offset += orgs.length;
    const left = memory.pool.length - memory.offset;
    return { kind: "orgs", orgs, intro: pick(["Sure — here are a few more:", "Here's the next batch:"]),
      outro: left > 0 ? `There are ${left} more — say "more" and I'll keep going.` : "That's everyone I have for this search. Want to try another place or scam type?" };
  }

  // fusion avec la mémoire : "and in Chicago?" après une question phishing
  const topics = a.topics.length ? a.topics : memory.topics;
  const loc = a.loc || (a.topics.length && !a.loc ? null : memory.loc);

  // Sortie A — question de clarification si trop vague (max 1 relance, comme éclaire)
  if (!topics.length && !loc) {
    if (a.scamHint && memory.clarifyCount < 1) {
      memory.clarifyCount++;
      return { kind: "text", text: "Happy to help! To point you to the right people, tell me:<br>• what kind of scam it's about (phishing, romance, crypto, a suspicious call…)<br>• and roughly where you are (city or state)." };
    }
    memory.clarifyCount = 0;
    return { kind: "text", text: `I can show you who fights scams anywhere in the US — nonprofits, hotlines, workshops. Try something like <i>"${pick(QUICK_QUESTIONS)}"</i>.` };
  }
  memory.clarifyCount = 0;

  // Recherche : sujet + lieu, avec fallback national (le B+ d'éclaire)
  let pool = loc ? loc.orgs : ORGS;
  let matched = topics.length ? pool.filter((o) => o.categories.some((c) => topics.includes(c))) : pool;
  let fallback = false;
  if (!matched.length && topics.length && loc) {
    matched = ORGS.filter((o) => o.categories.some((c) => topics.includes(c)));
    fallback = true;
  }

  // mémorise pour les tours suivants
  memory.topics = topics;
  memory.loc = loc;
  memory.pool = matched;
  memory.offset = Math.min(3, matched.length);

  const orgs = matched.slice(0, 3);
  const topicLabel = topics.map((t) => CATEGORY_LABELS[t].toLowerCase()).join(", ");
  let intro;
  if (fallback) intro = `I couldn't find anything on ${topicLabel} based in ${loc.label}, but these folks help nationwide:`;
  else if (topics.length && loc) intro = pick([`Here's who works on ${topicLabel} around ${loc.label}:`, `Good news — ${loc.label} has people on this:`]);
  else if (loc) intro = pick([`Here's who's active around ${loc.label}:`, `In ${loc.label}, you can reach out to:`]);
  else intro = pick([`Here's who I'd start with for ${topicLabel}:`, `A few trusted places for ${topicLabel}:`]);

  const left = matched.length - orgs.length;
  const outro = left > 0
    ? `This is a selection (${left} more available — just say "more"). Tell me a city or state to narrow it down.`
    : pick(["Tell me a place or another scam type if you want me to dig further.", "Want me to look in another city, or for a different kind of scam?"]);

  return { kind: "orgs", orgs, intro, outro };
}

/* ─── Chat UI avec effet "streaming" ─── */
const chat = document.getElementById("chat");
const panelScroll = document.getElementById("panelScroll");
const form = document.getElementById("chatForm");
const input = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

const QUICK_QUESTIONS = [
  "My mom got a suspicious call — who can help?",
  "Where can I report a scam in Texas?",
  "Workshops to spot phishing near Chicago",
  "I lost money to a crypto investment — what now?",
];

function scrollDown() { panelScroll.scrollTo({ top: panelScroll.scrollHeight, behavior: "smooth" }); }

function addUser(text) {
  const d = document.createElement("div");
  d.className = "msg user";
  d.textContent = text;
  chat.appendChild(d);
  scrollDown();
}

function orgCardHTML(o) {
  const tags = o.categories.map((c) => `<span class="org-tag">${CATEGORY_LABELS[c]}</span>`).join("");
  return `<div class="org-card">
    <h4>${o.name}</h4>
    <div class="org-loc">📍 ${o.city}, ${o.state}</div>
    <div class="org-tags">${tags}</div>
    <div class="org-desc">${o.desc}</div>
    <div class="org-actions">
      <button class="primary" onclick="window.__seeOnMap(${o.id})">See on map 📍</button>
      <button class="secondary" onclick="alert('Mockup — this organization is fictional 😉')">Visit website →</button>
    </div>
  </div>`;
}

window.__seeOnMap = (id) => {
  const o = ORGS.find((x) => x.id === id);
  map.flyTo([o.lat, o.lon], 10, { duration: 1.1 });
  setTimeout(() => markersById[id].openPopup(), 1200);
};

// texte tapé caractère par caractère (l'illusion du streaming LLM)
function typeText(el, html, done) {
  const span = document.createElement("div");
  el.appendChild(span);
  let i = 0, tag = false, out = "";
  const tick = () => {
    let burst = 2 + Math.floor(Math.random() * 3);
    while (burst-- > 0 && i < html.length) {
      const ch = html[i++];
      out += ch;
      if (ch === "<") tag = true;
      if (ch === ">") tag = false;
    }
    while (tag && i < html.length) { const ch = html[i++]; out += ch; if (ch === ">") tag = false; }
    span.innerHTML = out;
    if (i < html.length) { if (i % 40 === 0) scrollDown(); setTimeout(tick, 18 + Math.random() * 28); }
    else { scrollDown(); done && done(); }
  };
  tick();
}

function respond(reply) {
  const d = document.createElement("div");
  d.className = "msg bot";
  chat.appendChild(d);

  if (reply.kind === "text") {
    typeText(d, reply.text, () => { sendBtn.disabled = false; });
    return;
  }
  typeText(d, reply.intro, () => {
    // les cartes "tombent" une par une, comme les blocs d'éclaire
    let k = 0;
    const dropCard = () => {
      if (k < reply.orgs.length) {
        d.insertAdjacentHTML("beforeend", orgCardHTML(reply.orgs[k++]));
        scrollDown();
        setTimeout(dropCard, 350 + Math.random() * 250);
      } else {
        typeText(d, `<div style="margin-top:10px;font-size:13.5px">${reply.outro}</div>`, () => { sendBtn.disabled = false; });
      }
    };
    setTimeout(dropCard, 300);
    focusOrgs(reply.orgs);
  });
}

function send(text) {
  if (!text.trim() || sendBtn.disabled) return;
  addUser(text.trim());
  input.value = "";
  sendBtn.disabled = true;

  const think = document.createElement("div");
  think.className = "msg bot";
  think.innerHTML = `<span class="thinking"><i></i><i></i><i></i></span><span class="thinking-label">taking 9 seconds to think…</span>`;
  chat.appendChild(think);
  scrollDown();

  const reply = buildReply(text);
  // latence variable façon LLM (plus longue quand il y a des résultats à "générer")
  const delay = reply.kind === "orgs" ? 2200 + Math.random() * 1800 : 1200 + Math.random() * 900;
  setTimeout(() => { think.remove(); respond(reply); }, delay);
}

form.addEventListener("submit", (e) => { e.preventDefault(); send(input.value); });

const qqRow = document.getElementById("qqRow");
for (const q of QUICK_QUESTIONS) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "qq";
  b.textContent = q;
  b.onclick = () => send(q);
  qqRow.appendChild(b);
}
