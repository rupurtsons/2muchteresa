console.log("spread.js loaded (FULL FIXED VERSION)");

const boxes = Array.from(document.querySelectorAll(".box"));

const FLEE_RADIUS = 120;
const FORCE = 0.05;
const DAMPING = 0.9;
const DRIFT_FORCE = 0.6;
const DRIFT_INTERVAL = 350;
const FREEZE_GAP = 10;

let mouseX = -99999;
let mouseY = -99999;

const modalOverlay = document.getElementById("modalOverlay");
const modalFrame = document.getElementById("modalFrame");
const modalClose = document.getElementById("modalClose");
const cursor = document.getElementById("cursor");

const S = new Map();

window.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;

  if (cursor) {
    cursor.style.left = e.clientX + "px";
    cursor.style.top = e.clientY + "px";
  }
});

window.addEventListener("mouseleave", () => {
  if (cursor) cursor.style.display = "none";
});

window.addEventListener("mouseenter", () => {
  if (cursor && modalOverlay && !modalOverlay.classList.contains("isOpen")) {
    cursor.style.display = "block";
  }
});

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function apply(box) {
  const s = S.get(box);
  if (!s) return;
  box.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
}

function openModal(url) {
  if (!modalOverlay || !modalFrame || !url) return;

  modalFrame.src = url;
  modalOverlay.classList.add("isOpen");
  modalOverlay.setAttribute("aria-hidden", "false");

  if (cursor) cursor.style.display = "none";
}

function closeModal() {
  if (!modalOverlay || !modalFrame) return;

  modalOverlay.classList.remove("isOpen");
  modalOverlay.setAttribute("aria-hidden", "true");
  modalFrame.src = "";

  if (cursor) cursor.style.display = "block";
}

if (modalOverlay && modalClose) {
  modalClose.addEventListener("click", closeModal);

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
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

  const test = {
    left: x,
    top: y,
    right: x + s.w,
    bottom: y + s.h,
  };

  return !getFrozenRects(box).some((fr) => rectsOverlap(test, fr));
}

function findFreezeSpot(box, x, y) {
  if (isFreeAt(box, x, y)) return { x, y };

  const s = S.get(box);
  if (!s) return { x, y };

  const frozen = getFrozenRects(box);
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!frozen.length) return { x, y };

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

function refreshBoxSizes() {
  boxes.forEach((box) => {
    const s = S.get(box);
    if (!s) return;

    const r = box.getBoundingClientRect();

    s.w = r.width || box.offsetWidth || 120;
    s.h = r.height || box.offsetHeight || 120;
  });
}

function spreadInitialGrid() {
  refreshBoxSizes();

  const COLS = 5;
  const ROWS = 3;
  const GAP = 40;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const cellW = vw / COLS;
  const cellH = vh / ROWS;

  boxes.forEach((box, i) => {
    const s = S.get(box);
    if (!s) return;

    const col = i % COLS;
    const row = Math.floor(i / COLS) % ROWS;

    const jitterX = (Math.random() - 0.5) * (cellW * 0.3);
    const jitterY = (Math.random() - 0.5) * (cellH * 0.3);

    s.x = clamp(
      col * cellW + (cellW - s.w) / 2 + jitterX,
      GAP,
      vw - s.w - GAP
    );

    s.y = clamp(
      row * cellH + (cellH - s.h) / 2 + jitterY,
      GAP,
      vh - s.h - GAP
    );

    apply(box);
  });
}

function spreadStopEvenly() {
  const N = boxes.length;
  if (!N) return;

  refreshBoxSizes();

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const padding = 30;

  const usableW = vw - padding * 2;
  const usableH = vh - padding * 2;

  const cols = Math.ceil(Math.sqrt(N * (usableW / usableH)));
  const rows = Math.ceil(N / cols);

  const cellW = usableW / cols;
  const cellH = usableH / rows;

  boxes.forEach((box, i) => {
    const s = S.get(box);
    if (!s) return;

    const col = i % cols;
    const row = Math.floor(i / cols);

    s.x = padding + col * cellW + (cellW - s.w) / 2;
    s.y = padding + row * cellH + (cellH - s.h) / 2;

    s.x = clamp(s.x, padding, vw - s.w - padding);
    s.y = clamp(s.y, padding, vh - s.h - padding);

    s.vx = 0;
    s.vy = 0;
    s.stopped = true;

    // box.classList.add("caught");
    apply(box);
  });
}

function unstopAll() {
  boxes.forEach((box) => {
    const s = S.get(box);
    if (!s) return;

    s.stopped = false;
    s.vx = 0;
    s.vy = 0;

    box.classList.remove("caught");
  });
}

function init() {
  boxes.forEach((box) => {
    const r = box.getBoundingClientRect();

    S.set(box, {
      x: r.left,
      y: r.top,
      w: r.width || box.offsetWidth || 120,
      h: r.height || box.offsetHeight || 120,
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

      openModal(box.dataset.link);
    });
  });

  const resetButton = document.getElementById("resetLayout");

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      spreadStopEvenly();
    });
  }

  spreadInitialGrid();

  requestAnimationFrame(tick);
  setInterval(drift, DRIFT_INTERVAL);
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

window.addEventListener("load", init);

window.addEventListener("resize", () => {
  const anyStopped = boxes.some((box) => {
    const s = S.get(box);
    return s && s.stopped;
  });

  if (anyStopped) {
    spreadStopEvenly();
  } else {
    spreadInitialGrid();
  }
});