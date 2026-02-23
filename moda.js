console.log("moda.js loaded (CLEAN REWRITE)");

// =====================
// Helpers
// =====================
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rectsOverlap(a, b) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

// =====================
// Ensure scroll containers exist
// =====================
let scrollEl = document.getElementById("textScroll");
if (!scrollEl) {
  scrollEl = document.createElement("div");
  scrollEl.id = "textScroll";
  document.body.appendChild(scrollEl);
}

let rootEl = document.getElementById("scrollInner");
if (!rootEl) {
  rootEl = document.createElement("div");
  rootEl.id = "scrollInner";
  scrollEl.appendChild(rootEl);
}

const USE_SCROLL_CONTAINER = !!(scrollEl && rootEl);

// =====================
// State
// =====================
const boxes = Array.from(document.querySelectorAll(".box"));
const S = new Map();

const FREEZE_GAP = 10;

const FLEE_RADIUS = 80;  // how close mouse has to get
const FORCE = 0.06;      // push strength
const DAMPING = 0.90;    // slow down
const DRIFT_FORCE = 0.35;
const DRIFT_INTERVAL = 350;

let mouseX = -99999;
let mouseY = -99999;

// Mouse tracking (relative to scroll container if present)
(USE_SCROLL_CONTAINER ? scrollEl : window).addEventListener("mousemove", (e) => {
  if (USE_SCROLL_CONTAINER) {
    const r = scrollEl.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  } else {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }
});

// =====================
// Zoom overlay
// =====================
let zoomOverlay, zoomImg, zoomCloseBtn;

function ensureZoomOverlay() {
  if (zoomOverlay) return;

  zoomOverlay = document.createElement("div");
  zoomOverlay.id = "imageOverlay";
  zoomOverlay.style.position = "fixed";
  zoomOverlay.style.inset = "0";
  zoomOverlay.style.display = "none";
  zoomOverlay.style.alignItems = "center";
  zoomOverlay.style.justifyContent = "center";
  zoomOverlay.style.background = "rgba(224, 225, 222, 0.95)";
  zoomOverlay.style.zIndex = "99999";
  zoomOverlay.setAttribute("aria-hidden", "true");

  zoomImg = document.createElement("img");
  zoomImg.id = "imageOverlayImg";
  zoomImg.style.maxWidth = "90vw";
  zoomImg.style.maxHeight = "90vh";
  zoomImg.style.objectFit = "contain";

  zoomCloseBtn = document.createElement("button");
  zoomCloseBtn.type = "button";
  zoomCloseBtn.textContent = "×";
  zoomCloseBtn.style.position = "fixed";
  zoomCloseBtn.style.top = "12px";
  zoomCloseBtn.style.right = "12px";
  zoomCloseBtn.style.width = "44px";
  zoomCloseBtn.style.height = "44px";
  zoomCloseBtn.style.border = "none";
  zoomCloseBtn.style.borderRadius = "999px";
  zoomCloseBtn.style.background = "rgba(0,0,0,0.35)";
  zoomCloseBtn.style.color = "white";
  zoomCloseBtn.style.fontSize = "28px";
  zoomCloseBtn.style.lineHeight = "44px";
  zoomCloseBtn.style.cursor = "pointer";
  zoomCloseBtn.style.display = "none";
  zoomCloseBtn.style.zIndex = "100000";

  zoomOverlay.appendChild(zoomImg);
  document.body.appendChild(zoomOverlay);
  document.body.appendChild(zoomCloseBtn);

  function close() {
    zoomOverlay.style.display = "none";
    zoomCloseBtn.style.display = "none";
    zoomOverlay.setAttribute("aria-hidden", "true");
    zoomImg.src = "";
  }

  zoomOverlay.addEventListener("click", (e) => {
    if (e.target === zoomOverlay) close();
  });
  zoomCloseBtn.addEventListener("click", close);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

function openImageZoom(src) {
  if (!src) return;
  ensureZoomOverlay();
  zoomImg.src = src;
  zoomOverlay.style.display = "flex";
  zoomCloseBtn.style.display = "block";
  zoomOverlay.setAttribute("aria-hidden", "false");
}

// =====================
// Text (textarea or data-line)
// =====================
function addFunkyText() {
  if (document.querySelector(".funky")) return;

  const p = document.createElement("p");
  p.className = "funky";
  p.style.pointerEvents = "auto";
  p.style.zIndex = "0";

  const cfg = document.getElementById("funkyText");

  // Pull text from textarea OR from data-line1..4
  let raw = "";
  if (cfg) {
    if ("value" in cfg) raw = (cfg.value || "").trim();
    else {
      const lines = [
        cfg.dataset.line1,
        cfg.dataset.line2,
        cfg.dataset.line3,
        cfg.dataset.line4,
      ].filter(Boolean);
      raw = lines.join("\n\n").trim();
    }
  } else {
    raw = "DEFAULT TEXT";
  }

  // Split into paragraphs (blank lines)
  const blocks = raw.split(/\n{2,}/);

  // Put each paragraph in its own block span
  p.innerHTML = blocks.map((b) => `<span class="word">${b}</span>`).join("\n\n");

  // IMPORTANT: append into scrollInner so boxes + text share coordinate space
  rootEl.appendChild(p);

  // Convert each paragraph into letter spans (preserve single newlines)
  p.querySelectorAll(".word").forEach((word) => {
    const text = word.textContent;
    word.textContent = "";

    [...text].forEach((char) => {
      if (char === "\n") {
        word.appendChild(document.createElement("br"));
        return;
      }
      const span = document.createElement("span");
      span.className = "letter";
      span.textContent = char;
      word.appendChild(span);
    });

    // hover jitter
    word.addEventListener("mouseenter", () => {
      word.querySelectorAll(".letter").forEach((letter) => {
        letter.style.setProperty("--x", (Math.random() * 40 - 20).toFixed(1));
        letter.style.setProperty("--y", (Math.random() * 40 - 20).toFixed(1));
        letter.style.setProperty("--r", (Math.random() * 30 - 15).toFixed(1));
        letter.style.setProperty("--s", "1");
      });
    });
  });
}

// =====================
// Boxes (floating)
// =====================
function apply(box) {
  const s = S.get(box);
  if (!s) return;
  box.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
}

function getBounds() {
  // In scroll mode, allow y to extend down the content
  const w = rootEl.clientWidth || scrollEl.clientWidth || window.innerWidth;
  const h = Math.max(rootEl.scrollHeight || 0, scrollEl.clientHeight || window.innerHeight);
  return { w, h };
}

function getFrozenRects(exceptBox) {
  const rects = [];
  for (const [box, s] of S.entries()) {
    if (box === exceptBox || !s.stopped) continue;
    rects.push({
      left: s.x - FREEZE_GAP,
      top: s.y - FREEZE_GAP,
      right: s.x + s.w + FREEZE_GAP,
      bottom: s.y + s.h + FREEZE_GAP,
      cx: s.x + s.w / 2,
      cy: s.y + s.h / 2,
    });
  }
  return rects;
}

function isFreeAt(box, x, y) {
  const s = S.get(box);
  if (!s) return true;
  const test = { left: x, top: y, right: x + s.w, bottom: y + s.h };
  return !getFrozenRects(box).some((fr) => rectsOverlap(test, fr));
}

function findFreezeSpot(box, x, y) {
  if (isFreeAt(box, x, y)) return { x, y };

  const s = S.get(box);
  const frozen = getFrozenRects(box);
  const { w: bw, h: bh } = getBounds();

  let nearest = frozen[0];
  let bestD = Infinity;

  const cx = x + s.w / 2;
  const cy = y + s.h / 2;

  for (const fr of frozen) {
    const d = Math.hypot(cx - fr.cx, cy - fr.cy);
    if (d < bestD) {
      bestD = d;
      nearest = fr;
    }
  }

  const candidates = [
    { x: nearest.right + FREEZE_GAP, y },
    { x: nearest.left - FREEZE_GAP - s.w, y },
    { x, y: nearest.bottom + FREEZE_GAP },
    { x, y: nearest.top - FREEZE_GAP - s.h },
  ].map((c) => ({
    x: clamp(c.x, 0, bw - s.w),
    y: clamp(c.y, 0, bh - s.h),
  }));

  for (const c of candidates) {
    if (isFreeAt(box, c.x, c.y)) return c;
  }
  return {
    x: clamp(x, 0, bw - s.w),
    y: clamp(y, 0, bh - s.h),
  };
}

function placeFromAnchor(box) {
  const anchorId = box.dataset.anchor;
  if (!anchorId) return false;

  const a = document.getElementById(anchorId);
  if (!a) return false;

  const ar = a.getBoundingClientRect();
  const rr = rootEl.getBoundingClientRect();

  const ox = parseFloat(box.dataset.offsetX || "0");
  const oy = parseFloat(box.dataset.offsetY || "0");

  const s = S.get(box);
  if (!s) return false;

  // convert anchor rect to scrollInner coordinate space
  s.x = (ar.left - rr.left) + ox;
  s.y = (ar.top - rr.top) + oy;

  const { w, h } = getBounds();
  s.x = clamp(s.x, 0, w - s.w);
  s.y = clamp(s.y, 0, h - s.h);

  apply(box);
  return true;
}

function initialPlaceUnanchored(box, i) {
  const s = S.get(box);
  const { w, h } = getBounds();

  // simple gentle random placement
  s.x = clamp((w * 0.1) + Math.random() * (w * 0.8 - s.w), 0, w - s.w);
  s.y = clamp(120 + i * (s.h + 40) + (Math.random() - 0.5) * 30, 0, h - s.h);

  apply(box);
}

function tick() {
  const { w: bw, h: bh } = getBounds();

  for (const box of boxes) {
    const s = S.get(box);
    if (!s || s.stopped) continue;

    // mouse repulsion only matters in visible viewport
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;

    const dx = cx - mouseX;
    const dy = cy - mouseY;
    const dist = Math.hypot(dx, dy);

    if (dist < FLEE_RADIUS) {
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);
      s.vx += nx * FORCE * 45;
      s.vy += ny * FORCE * 45;
    }

    s.vx *= DAMPING;
    s.vy *= DAMPING;

    s.x = clamp(s.x + s.vx, 0, bw - s.w);
    s.y = clamp(s.y + s.vy, 0, bh - s.h);

    apply(box);
  }

  requestAnimationFrame(tick);
}

function drift() {
  for (const box of boxes) {
    const s = S.get(box);
    if (!s || s.stopped) continue;
    s.vx += (Math.random() - 0.5) * DRIFT_FORCE;
    s.vy += (Math.random() - 0.5) * DRIFT_FORCE;
  }
}

// =====================
// Init
// =====================
function init() {
  addFunkyText();

  // Make sure boxes are inside scrollInner if you want them to scroll with text
  // (If you keep them outside, they'll still work but won't scroll with text)

  boxes.forEach((box, i) => {
    // measure size
    const r = box.getBoundingClientRect();
    const w = r.width || 200;
    const h = r.height || 200;

    // normalize for transform-based positioning
    box.style.left = "0";
    box.style.top = "0";
    box.style.cursor = "pointer";

    S.set(box, {
      x: 0,
      y: 0,
      w,
      h,
      vx: 0,
      vy: 0,
      stopped: false,
    });

    // Anchor placement if available, otherwise random placement
    const didAnchor = placeFromAnchor(box);
    if (!didAnchor) initialPlaceUnanchored(box, i);

    // Click behavior: 1st click freeze, 2nd click zoom
    box.addEventListener("click", (e) => {
      e.preventDefault();
      const s = S.get(box);
      if (!s) return;

      if (!s.stopped) {
        const spot = findFreezeSpot(box, s.x, s.y);
        s.x = spot.x;
        s.y = spot.y;
        s.vx = 0;
        s.vy = 0;
        s.stopped = true;
        box.classList.add("caught");
        apply(box);
        return;
      }

      const img = box.querySelector("img");
      if (img) openImageZoom(img.currentSrc || img.src);
    });
  });

  requestAnimationFrame(tick);
  setInterval(drift, DRIFT_INTERVAL);
}

window.addEventListener("load", init);

// If layout changes (font load, resize), re-anchor boxes that have anchors
window.addEventListener("resize", () => {
  boxes.forEach((box) => {
    if (box.dataset.anchor) placeFromAnchor(box);
  });
});