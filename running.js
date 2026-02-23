console.log("running.js loaded");

const boxes = Array.from(document.querySelectorAll(".box"));

function spreadBoxesEvenly() {
  const N = boxes.length;
  if (!N) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const cols = Math.ceil(Math.sqrt(N));
  const rows = Math.ceil(N / cols);

  const cellW = vw / cols;
  const cellH = vh / rows;

  boxes.forEach((box, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    const rect = box.getBoundingClientRect();
    const bw = rect.width || 120;
    const bh = rect.height || 120;

    let left = col * cellW + (cellW - bw) / 2;
    let top  = row * cellH + (cellH - bh) / 2;

    left += (Math.random() - 0.5) * 30;
    top  += (Math.random() - 0.5) * 30;

    left = Math.max(0, Math.min(left, vw - bw));
    top  = Math.max(0, Math.min(top, vh - bh));

    box.style.left = left + "px";
    box.style.top  = top + "px";

    box.dataset.stopped = "false";
  });
}

window.addEventListener("load", () => {
  spreadBoxesEvenly();
});


const FLEE_RADIUS = 300;
const PUSH_STRENGTH = 180;
const DRIFT_STEP = 80;
const DRIFT_INTERVAL = 300;


const modalOverlay = document.getElementById("modalOverlay");
const modalFrame = document.getElementById("modalFrame");
const modalClose = document.getElementById("modalClose");

function rectsOverlap(a, b) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

function getFrozenRects(exceptBox = null) {
  return boxes
    .filter((b) => b !== exceptBox && b.dataset.stopped === "true")
    .map((b) => b.getBoundingClientRect());
}

function findNonOverlappingPosition(box, startLeft, startTop) {
  const frozenRects = getFrozenRects(box);
  if (frozenRects.length === 0) return { left: startLeft, top: startTop };

  const rectNow = box.getBoundingClientRect();
  const w = rectNow.width;
  const h = rectNow.height;

  const STEP = 18;       
  const RINGS = 40;      

  for (let ring = 0; ring < RINGS; ring++) {
    const r = ring * STEP;

    const candidates = [
      { x: startLeft + r, y: startTop },
      { x: startLeft - r, y: startTop },
      { x: startLeft, y: startTop + r },
      { x: startLeft, y: startTop - r },
      { x: startLeft + r, y: startTop + r },
      { x: startLeft - r, y: startTop + r },
      { x: startLeft + r, y: startTop - r },
      { x: startLeft - r, y: startTop - r },
    ];

    for (const c of candidates) {
      const left = clamp(c.x, 0, window.innerWidth - w);
      const top = clamp(c.y, 0, window.innerHeight - h);

      const testRect = { left, top, right: left + w, bottom: top + h };

      const overlapsAny = frozenRects.some((fr) => rectsOverlap(testRect, fr));
      if (!overlapsAny) return { left, top };
    }
  }

  // If we fail to find a spot, just return the original
  return { left: startLeft, top: startTop };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setInitialPosition(box) {
  const hasLeft = box.style.left && box.style.left.trim() !== "";
  const hasTop = box.style.top && box.style.top.trim() !== "";

  if (!hasLeft || !hasTop) {
    const rect = box.getBoundingClientRect();
    box.style.left = rect.left + "px";
    box.style.top = rect.top + "px";
  }
}

function isFrozen(box) {
  return box.dataset.stopped === "true";
}

function freezeBox(box) {
  box.dataset.stopped = "true";
  box.classList.add("caught");
}

function openModal(url) {
  if (!modalOverlay || !modalFrame) return; 
  if (!url) return;

  modalFrame.src = url;
  modalOverlay.classList.add("isOpen");
  modalOverlay.setAttribute("aria-hidden", "false");
}

function closeModal() {
  if (!modalOverlay || !modalFrame) return;
  modalOverlay.classList.remove("isOpen");
  modalOverlay.setAttribute("aria-hidden", "true");
  modalFrame.src = "";
}

if (modalOverlay && modalFrame && modalClose) {
  modalClose.addEventListener("click", closeModal);

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

boxes.forEach((box) => {
  setInitialPosition(box);

  box.dataset.stopped = "false";
  box.dataset.state = "move"; 

  box.style.cursor = "pointer";

  box.addEventListener("click", () => {
    if (box.dataset.state === "move") {
      freezeBox(box);
      box.dataset.state = "caught";
      return;
    }

    if (box.dataset.state === "caught") {
      openModal(box.dataset.link);
    }
  });
}); 


window.addEventListener("mousemove", (e) => {
  const mouseX = e.clientX;
  const mouseY = e.clientY;

  boxes.forEach((box) => {
    if (isFrozen(box)) return;

    const rect = box.getBoundingClientRect();
    const boxX = rect.left + rect.width / 2;
    const boxY = rect.top + rect.height / 2;

    const dx = boxX - mouseX;
    const dy = boxY - mouseY;
    const dist = Math.hypot(dx, dy);

    if (dist < FLEE_RADIUS) {
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);

      const currentLeft = parseFloat(box.style.left) || rect.left;
      const currentTop = parseFloat(box.style.top) || rect.top;

      let newLeft = currentLeft + nx * PUSH_STRENGTH;
      let newTop = currentTop + ny * PUSH_STRENGTH;

      newLeft = clamp(newLeft, 0, window.innerWidth - rect.width);
      newTop = clamp(newTop, 0, window.innerHeight - rect.height);

      box.style.left = newLeft + "px";
      box.style.top = newTop + "px";
    }
  });
});

// 
function randomDrift() {
  boxes.forEach((box) => {
    if (isFrozen(box)) return;

    const rect = box.getBoundingClientRect();
    const currentLeft = parseFloat(box.style.left) || rect.left;
    const currentTop = parseFloat(box.style.top) || rect.top;

    let newLeft = currentLeft + (Math.random() - 0.5) * DRIFT_STEP;
    let newTop = currentTop + (Math.random() - 0.5) * DRIFT_STEP;

    newLeft = clamp(newLeft, 0, window.innerWidth - rect.width);
    newTop = clamp(newTop, 0, window.innerHeight - rect.height);

    box.style.left = newLeft + "px";
    box.style.top = newTop + "px";
  });
}

setInterval(randomDrift, DRIFT_INTERVAL);





// console.log("running.js loaded");

// const boxes = document.querySelectorAll('.box');

// const FLEE_RADIUS = 220;
// const PUSH_STRENGTH = 80;

// function clamp(value, min, max) {
//   return Math.max(min, Math.min(max, value));
// }

// boxes.forEach(box => {
//   const rect = box.getBoundingClientRect();
//   box.style.left = rect.left + 'px';
//   box.style.top = rect.top + 'px';

//   box.dataset.stopped = "false";

//   box.addEventListener('click', () => {
//     box.dataset.stopped = "true";
//     box.style.cursor = "default";
//   });
// });

// window.addEventListener('mousemove', (e) => {
//   const mouseX = e.clientX;
//   const mouseY = e.clientY;

//   boxes.forEach(box => {
//     if (box.dataset.stopped === "true") return;

//     const rect = box.getBoundingClientRect();

//     const boxX = rect.left + rect.width / 2;
//     const boxY = rect.top + rect.height / 2;

//     const dx = boxX - mouseX;
//     const dy = boxY - mouseY;
//     const dist = Math.hypot(dx, dy);

//     if (dist < FLEE_RADIUS) {
//       const nx = dx / (dist || 1);
//       const ny = dy / (dist || 1);

//       const currentLeft = parseFloat(box.style.left);
//       const currentTop  = parseFloat(box.style.top);

//       let newLeft = currentLeft + nx * PUSH_STRENGTH;
//       let newTop  = currentTop  + ny * PUSH_STRENGTH;

//       newLeft = clamp(newLeft, 0, window.innerWidth - rect.width);
//       newTop  = clamp(newTop, 0, window.innerHeight - rect.height);

//       box.style.left = newLeft + 'px';
//       box.style.top  = newTop + 'px';
//     }
//   });
// });
// function randomDrift() {
//   boxes.forEach(box => {
//     if (box.dataset.stopped === "true") return;

//     const rect = box.getBoundingClientRect();

//     let newLeft = parseFloat(box.style.left) + (Math.random() - 0.5) * 40;
//     let newTop  = parseFloat(box.style.top)  + (Math.random() - 0.5) * 40;

//     newLeft = clamp(newLeft, 0, window.innerWidth - rect.width);
//     newTop  = clamp(newTop, 0, window.innerHeight - rect.height);

//     box.style.left = newLeft + "px";
//     box.style.top  = newTop + "px";
//   });
// }





// const boxes = [
//   document.getElementById('box1'),
//   document.getElementById('box2')
// ];

// function moveBox(box) {
//   const x = Math.random() * (window.innerWidth - box.offsetWidth);
//   const y = Math.random() * (window.innerHeight - box.offsetHeight);

//   box.style.left = x + 'px';
//   box.style.top = y + 'px';
// }

// boxes.forEach(box => {
//   box.addEventListener('mouseenter', () => moveBox(box));
// });

// const runawayBtn1 = document.getElementById('runawayBtn1');

// const moveButton = () => {
//   const newX = Math.random() * (window.innerWidth - runawayBtn1.offsetWidth);
//   const newY = Math.random() * (window.innerHeight - runawayBtn1.offsetHeight);

//   runawayBtn1.style.left = `${newX}px`;
//   runawayBtn1.style.top = `${newY}px`;
// };

// runawayBtn1.addEventListener('mouseenter', moveButton);

