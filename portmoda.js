console.log("moda.js loaded (FINAL + FUNKY + IMAGE ZOOM)");

const boxes = Array.from(document.querySelectorAll(".box"));

const FLEE_RADIUS = 50;
const FORCE = 0.02;
const DAMPING = 0.92;

const DRIFT_FORCE = 2;
const DRIFT_INTERVAL = 100;

let mouseX = -99999;
let mouseY = -99999;

window.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}


const S = new Map();

function apply(box) {
  const s = S.get(box);
  if (!s) return;
  box.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
}

function rectsOverlap(a, b) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
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
  const vw = window.innerWidth;
  const vh = window.innerHeight;

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
    x: clamp(c.x, 0, vw - s.w),
    y: clamp(c.y, 0, vh - s.h),
  }));

  for (const c of candidates) {
    if (isFreeAt(box, c.x, c.y)) return c;
  }

  return { x, y };
}

function spreadInitialGrid() {
  const COLS = 6;
  const ROWS = 4;
  const GAP = 28;   
  const EDGE = 24;  

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const first = boxes[0];
  const r0 = first ? first.getBoundingClientRect() : { width: 180, height: 180 };
  const size = Math.min(r0.width || 180, r0.height || 180) || 180;

  const gridW = COLS * size + (COLS - 1) * GAP;
  const gridH = ROWS * size + (ROWS - 1) * GAP;

  const startX = clamp((vw - gridW) / 2, EDGE, vw - gridW - EDGE);
  const startY = clamp((vh - gridH) / 2, EDGE, vh - gridH - EDGE);

  boxes.forEach((box, i) => {
    const s = S.get(box);
    if (!s || s.stopped) return;

    const col = i % COLS;
    const row = Math.floor(i / COLS) % ROWS;

    const jitterX = (Math.random() - 0.5) * 10;
    const jitterY = (Math.random() - 0.5) * 10;

    s.w = size;
    s.h = size;

    s.x = startX + col * (size + GAP) + jitterX;
    s.y = startY + row * (size + GAP) + jitterY;

    s.x = clamp(s.x, EDGE, vw - size - EDGE);
    s.y = clamp(s.y, EDGE, vh - size - EDGE);

    apply(box);
  });
}

function spreadStopBottomToTop(gap = 30) {
  const N = boxes.length;
  if (!N) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let maxW = 0,
    maxH = 0;
  boxes.forEach((box) => {
    const s = S.get(box);
    if (!s) return;
    maxW = Math.max(maxW, s.w);
    maxH = Math.max(maxH, s.h);
  });

  const cellW = maxW + gap;
  const cellH = maxH + gap;

  let cols = Math.max(1, Math.floor((vw - gap) / cellW) - 1);
  let rows = Math.ceil(N / cols);

  while (rows * cellH + gap * 10 > vh && cols > 8) {
    cols--;
    rows = Math.ceil(N / cols);
  }

  const gridW = cols * cellW;
  const gridH = rows * cellH;

  const startX = (vw - gridW) / 2;
  const startY = (vh - gridH) / 2;

  boxes.forEach((box, i) => {
    const s = S.get(box);
    if (!s) return;

    const col = i % cols;
    const rowFromTop = Math.floor(i / cols);
    const row = rows - 1 - rowFromTop;

    s.x = clamp(startX + col * cellW + (maxW - s.w) / 2, gap, vw - s.w - gap);
    s.y = clamp(startY + row * cellH + (maxH - s.h) / 2, gap, vh - s.h - gap);

    s.vx = 0;
    s.vy = 0;
    s.stopped = true;

    box.classList.add("caught");
    apply(box);
  });
}

function clampAllToViewport() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  boxes.forEach((box) => {
    const s = S.get(box);
    if (!s) return;
    s.x = clamp(s.x, 0, vw - s.w);
    s.y = clamp(s.y, 0, vh - s.h);
    apply(box);
  });
}

function addFunkyText() {
  if (document.querySelector(".funky")) return;

  const p = document.createElement("p");
  p.className = "funky";
  p.style.position = "fixed";
  p.style.left = "50%";
  p.style.top = "50%";
  p.style.transform = "translate(-50%, -50%)";
  p.style.zIndex = "0";
  p.style.pointerEvents = "auto";
  const cfg = document.getElementById("funkyText");

  const lines = cfg
    ? [cfg.dataset.line1, cfg.dataset.line2, cfg.dataset.line3, cfg.dataset.line4].filter(Boolean)
    : ["DEFAULT TEXT"];

  p.innerHTML = lines.map(t => `<span class="word">${t}</span>`).join("");

  document.body.appendChild(p);

  p.querySelectorAll(".word").forEach((word) => {
    const text = word.textContent;
    word.textContent = "";

    [...text].forEach((char) => {
      const span = document.createElement("span");
      span.className = "letter";
      span.textContent = char;
      word.appendChild(span);
    });

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
  zoomOverlay.style.background = "rgba(0,0,0,0.75)";
  zoomOverlay.style.zIndex = "99999";
  zoomOverlay.setAttribute("aria-hidden", "true");

  zoomImg = document.createElement("img");
  zoomImg.id = "imageOverlayImg";
  zoomImg.style.maxWidth = "92vw";
  zoomImg.style.maxHeight = "92vh";
  zoomImg.style.objectFit = "contain";
  zoomImg.style.borderRadius = "18px";
  zoomImg.style.boxShadow = "0 20px 60px rgba(0,0,0,0.4)";

  zoomCloseBtn = document.createElement("button");
  zoomCloseBtn.type = "button";
  zoomCloseBtn.textContent = "×";
  zoomCloseBtn.style.position = "fixed";
  zoomCloseBtn.style.top = "16px";
  zoomCloseBtn.style.right = "16px";
  zoomCloseBtn.style.width = "44px";
  zoomCloseBtn.style.height = "44px";
  zoomCloseBtn.style.border = "none";
  zoomCloseBtn.style.borderRadius = "999px";
  zoomCloseBtn.style.background = "rgba(255,255,255,0.85)";
  zoomCloseBtn.style.fontSize = "28px";
  zoomCloseBtn.style.lineHeight = "44px";
  zoomCloseBtn.style.cursor = "pointer";

  zoomOverlay.appendChild(zoomImg);
  document.body.appendChild(zoomOverlay);
  document.body.appendChild(zoomCloseBtn);

  const close = () => closeImageZoom();

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
  document.body.classList.add("inModal"); 
}

function closeImageZoom() {
  if (!zoomOverlay) return;
  zoomOverlay.style.display = "none";
  zoomCloseBtn.style.display = "none";
  zoomOverlay.setAttribute("aria-hidden", "true");
  zoomImg.src = "";
  document.body.classList.remove("inModal");
}

function tick() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  for (const box of boxes) {
    const s = S.get(box);
    if (!s || s.stopped) continue;

    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;

    const dx = cx - mouseX;
    const dy = cy - mouseY;
    const dist = Math.hypot(dx, dy);

    if (dist < FLEE_RADIUS) {
      s.vx += (dx / (dist || 1)) * FORCE * 45;
      s.vy += (dy / (dist || 1)) * FORCE * 45;
    }

    s.vx *= DAMPING;
    s.vy *= DAMPING;

    s.x = clamp(s.x + s.vx, 0, vw - s.w);
    s.y = clamp(s.y + s.vy, 0, vh - s.h);

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

function init() {
  boxes.forEach((box) => {
    const r = box.getBoundingClientRect();

    const size = Math.min(r.width || 180, r.height || 180) || 180;
    box.style.width = `${size}px`;
    box.style.height = `${size}px`;

    S.set(box, {
    x: r.left,
    y: r.top,
    w: size,
    h: size,
    vx: 0,
    vy: 0,
    stopped: false,
    });
        box.style.left = "0";
    box.style.top = "0";
    box.style.cursor = "pointer";

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


  addFunkyText();
  spreadInitialGrid();

  requestAnimationFrame(tick);
  setInterval(drift, DRIFT_INTERVAL);
}

window.addEventListener("load", init);
window.addEventListener("resize", () => {
  clampAllToViewport();
});