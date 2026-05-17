let currentMode = 'single';
let currentFile = null;
let animRows = [];
let rowIdCounter = 0;

const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const uploadLabel = document.getElementById('uploadLabel');
const previewBox = document.getElementById('previewBox');
const spritePreview = document.getElementById('spritePreview');
const extractBtn = document.getElementById('extractBtn');
const progressWrap = document.getElementById('progressWrap');
const progressFill = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const outputSection = document.getElementById('outputSection');
const output = document.getElementById('output');
const rowList = document.getElementById('rowList');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.style.background = 'var(--color-background-secondary)'; });
uploadZone.addEventListener('dragleave', () => { uploadZone.style.background = ''; });
uploadZone.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });

function loadFile(file) {
  currentFile = file;
  uploadZone.classList.add('has-file');
  uploadLabel.textContent = file.name;
  const url = URL.createObjectURL(file);
  spritePreview.src = url;
  previewBox.style.display = 'block';
}

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    document.getElementById('singleConfig').style.display = currentMode === 'single' ? '' : 'none';
    document.getElementById('multiConfig').style.display = currentMode === 'multi' ? '' : 'none';
    document.getElementById('autoConfig').style.display = currentMode === 'auto' ? '' : 'none';
  });
});

document.getElementById('addRowBtn').addEventListener('click', () => {
  const name = document.getElementById('newRowName').value.trim();
  const frames = parseInt(document.getElementById('newRowFrames').value, 10);
  if (!name || isNaN(frames) || frames < 1) { alert('Inserisci un nome e un numero di frame valido.'); return; }
  const id = rowIdCounter++;
  animRows.push({ id, name, frames });
  document.getElementById('newRowName').value = '';
  document.getElementById('newRowFrames').value = '';
  renderRowList();
});

function renderRowList() {
  rowList.innerHTML = '';
  animRows.forEach((row) => {
    const div = document.createElement('div');
    div.className = 'row-item';
    div.innerHTML = `<i class="ti ti-grip-vertical" style="color:var(--color-text-tertiary)" aria-hidden="true"></i>
      <span class="row-label">${row.name}</span>
      <span class="row-tag">${row.frames} frames</span>
      <button aria-label="Rimuovi riga" onclick="removeRow(${row.id})"><i class="ti ti-x" aria-hidden="true"></i></button>`;
    rowList.appendChild(div);
  });
}

function removeRow(id) {
  animRows = animRows.filter(r => r.id !== id);
  renderRowList();
}

extractBtn.addEventListener('click', async () => {
  const file = currentFile;
  if (!file) { alert('Carica prima uno spritesheet.'); return; }

  if (currentMode === 'single') {
    const fc = parseInt(document.getElementById('frameCount').value, 10);
    if (isNaN(fc) || fc < 1) { alert('Inserisci un numero di frame valido.'); return; }
    await extractSingle(file, fc);
  } else if (currentMode === 'multi') {
    if (animRows.length === 0) { alert('Aggiungi almeno una riga animazione.'); return; }
    await extractMulti(file, animRows);
  } else if (currentMode === 'auto') {
    const padding = parseInt(document.getElementById('autoPadding').value, 10) || 0;
    const minSize = parseInt(document.getElementById('autoMinSize').value, 10) || 4;
    await extractAuto(file, padding, minSize);
  }
});

function setProgress(pct, label) {
  progressWrap.style.display = 'block';
  progressFill.style.width = pct + '%';
  progressLabel.textContent = label;
}

async function loadImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}


async function extractSingle(file, frameCount) {
  extractBtn.disabled = true;
  output.innerHTML = '';
  outputSection.style.display = 'none';
  const img = await loadImage(file);
  const zip = new JSZip();
  const fw = img.width / frameCount;
  const fh = img.height;
  setProgress(0, 'Estrazione frame…');
  const group = document.createElement('div');
  group.className = 'anim-group';
  const grid = document.createElement('div');
  grid.className = 'frame-grid';
  group.appendChild(grid);
  output.appendChild(group);
  outputSection.style.display = 'block';

  for (let i = 0; i < frameCount; i++) {
    const c = makeFrameCanvas(img, i * fw, 0, fw, fh);
    const td = trimTransparent(c);
    if (td) {
      const tc = applyTrim(td);
      tc.className = 'frame-thumb';
      tc.style.maxWidth = '64px';
      tc.style.maxHeight = '64px';
      grid.appendChild(tc);
      await blobToZip(zip, tc, `${i}.png`);
    }
    setProgress(Math.round(((i + 1) / frameCount) * 100), `Frame ${i + 1} / ${frameCount}`);
  }

  await saveZip(zip, 'frames.zip');
  extractBtn.disabled = false;
  progressLabel.textContent = 'Fatto! Download in corso…';
}


async function extractMulti(file, rows) {
  extractBtn.disabled = true;
  output.innerHTML = '';
  outputSection.style.display = 'none';
  const img = await loadImage(file);
  const zip = new JSZip();
  const rowHeight = img.height / rows.length;
  const total = rows.reduce((s, r) => s + r.frames, 0);
  let done = 0;

  outputSection.style.display = 'block';

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const folderName = `animation_${ri + 1}`;
    const folder = zip.folder(folderName);
    const fw = img.width / row.frames;
    const yOffset = ri * rowHeight;

    const group = document.createElement('div');
    group.className = 'anim-group';
    group.innerHTML = `<div class="anim-group-header"><i class="ti ti-folder" aria-hidden="true"></i> ${folderName} <span style="color:var(--color-text-tertiary);font-weight:400">(${row.name})</span><span class="row-tag" style="margin-left:auto">${row.frames} frames</span></div>`;
    const grid = document.createElement('div');
    grid.className = 'frame-grid';
    group.appendChild(grid);
    output.appendChild(group);

    for (let i = 0; i < row.frames; i++) {
      const c = makeFrameCanvas(img, i * fw, yOffset, fw, rowHeight);
      const td = trimTransparent(c);
      if (td) {
        const tc = applyTrim(td);
        tc.className = 'frame-thumb';
        tc.style.maxWidth = '48px';
        tc.style.maxHeight = '48px';
        grid.appendChild(tc);
        await blobToZip(folder, tc, `${i}.png`);
      }
      done++;
      setProgress(Math.round((done / total) * 100), `Animazione ${ri + 1}/${rows.length} — frame ${i + 1}/${row.frames}`);
    }
  }

  await saveZip(zip, 'animations.zip');
  extractBtn.disabled = false;
  progressLabel.textContent = 'Fatto! Download in corso…';
}


async function extractAuto(file, padding, minSize) {
  extractBtn.disabled = true;
  output.innerHTML = '';
  outputSection.style.display = 'none';
  setProgress(0, 'Analisi immagine…');

  const img = await loadImage(file);
  const w = img.width, h = img.height;

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w; srcCanvas.height = h;
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.drawImage(img, 0, 0);
  const imgData = srcCtx.getImageData(0, 0, w, h);
  const px = imgData.data;

  setProgress(5, 'Rilevamento pixel…');

  const fg = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], a = px[i * 4 + 3];
    if (a < 20) continue;
    if (r > 230 && g > 230 && b > 230) continue;
    fg[i] = 1;
  }

  setProgress(15, 'Connessione componenti…');

  const label = new Int32Array(w * h).fill(-1);
  const parent = [];

  function find(x) {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(a, b) {
    a = find(a); b = find(b);
    if (a !== b) parent[b] = a;
  }

  let nextLabel = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!fg[idx]) continue;
      const up = y > 0 ? label[(y - 1) * w + x] : -1;
      const left = x > 0 ? label[y * w + (x - 1)] : -1;

      if (up === -1 && left === -1) {
        label[idx] = nextLabel;
        parent.push(nextLabel);
        nextLabel++;
      } else if (up !== -1 && left === -1) {
        label[idx] = up;
      } else if (up === -1 && left !== -1) {
        label[idx] = left;
      } else {
        label[idx] = up;
        union(up, left);
      }
    }
  }

  setProgress(40, 'Calcolo bounding box…');

  const boxes = new Map();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!fg[idx]) continue;
      const root = find(label[idx]);
      if (!boxes.has(root)) {
        boxes.set(root, { minX: x, maxX: x, minY: y, maxY: y });
      } else {
        const b = boxes.get(root);
        if (x < b.minX) b.minX = x;
        if (x > b.maxX) b.maxX = x;
        if (y < b.minY) b.minY = y;
        if (y > b.maxY) b.maxY = y;
      }
    }
  }

  setProgress(55, 'Fusione componenti vicini…');

  const mergeGap = Math.max(padding + 2, 6);
  let rects = Array.from(boxes.values()).filter(b => {
    return (b.maxX - b.minX + 1) >= minSize && (b.maxY - b.minY + 1) >= minSize;
  });

  let merged = true;
  while (merged) {
    merged = false;
    const next = [];
    const used = new Uint8Array(rects.length);
    for (let i = 0; i < rects.length; i++) {
      if (used[i]) continue;
      let a = rects[i];
      for (let j = i + 1; j < rects.length; j++) {
        if (used[j]) continue;
        const b = rects[j];
        const overlapX = a.minX <= b.maxX + mergeGap && b.minX <= a.maxX + mergeGap;
        const overlapY = a.minY <= b.maxY + mergeGap && b.minY <= a.maxY + mergeGap;
        if (overlapX && overlapY) {
          a = {
            minX: Math.min(a.minX, b.minX),
            maxX: Math.max(a.maxX, b.maxX),
            minY: Math.min(a.minY, b.minY),
            maxY: Math.max(a.maxY, b.maxY)
          };
          used[j] = 1;
          merged = true;
        }
      }
      next.push(a);
    }
    rects = next;
  }

  rects = rects.filter(b =>
    (b.maxX - b.minX + 1) >= minSize && (b.maxY - b.minY + 1) >= minSize
  );

  rects.sort((a, b) => {
    const rowA = Math.round(a.minY / 20), rowB = Math.round(b.minY / 20);
    return rowA !== rowB ? rowA - rowB : a.minX - b.minX;
  });

  setProgress(70, `Trovati ${rects.length} sprite, estrazione…`);

  const zip = new JSZip();
  outputSection.style.display = 'block';

  const group = document.createElement('div');
  group.className = 'anim-group';
  group.innerHTML = `<div class="anim-group-header"><i class="ti ti-scan" aria-hidden="true"></i> Auto-detected <span class="row-tag" style="margin-left:auto">${rects.length} sprites</span></div>`;
  const grid = document.createElement('div');
  grid.className = 'frame-grid';
  group.appendChild(grid);
  output.appendChild(group);

  for (let i = 0; i < rects.length; i++) {
    const b = rects[i];
    const x = Math.max(0, b.minX - padding);
    const y = Math.max(0, b.minY - padding);
    const sw = Math.min(w, b.maxX + padding + 1) - x;
    const sh = Math.min(h, b.maxY + padding + 1) - y;

    const fc = makeFrameCanvas(img, x, y, sw, sh);
    fc.className = 'frame-thumb';
    fc.style.maxWidth = '64px';
    fc.style.maxHeight = '64px';
    grid.appendChild(fc);
    await blobToZip(zip, fc, `${i}.png`);

    if (i % 5 === 0) {
      setProgress(70 + Math.round((i / rects.length) * 28), `Estrazione sprite ${i + 1}/${rects.length}…`);
      await new Promise(r => setTimeout(r, 0));
    }
  }

  await saveZip(zip, 'sprites.zip');
  extractBtn.disabled = false;
  setProgress(100, `Fatto! ${rects.length} sprite estratti.`);
}


function makeFrameCanvas(img, sx, sy, sw, sh) {
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return c;
}

function applyTrim(td) {
  const c = document.createElement('canvas');
  c.width = td.width; c.height = td.height;
  c.getContext('2d').putImageData(td.imageData, 0, 0);
  return c;
}

function blobToZip(zip, canvas, name) {
  return new Promise(res => canvas.toBlob(blob => { zip.file(name, blob); res(); }, 'image/png'));
}

async function saveZip(zip, name) {
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, name);
}

function trimTransparent(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  let top = null, bottom = null, left = null, right = null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 0) {
        if (top === null) top = y;
        bottom = y;
        if (left === null || x < left) left = x;
        if (right === null || x > right) right = x;
      }
    }
  }
  if (top === null) return null;
  const tw = right - left + 1, th = bottom - top + 1;
  return { width: tw, height: th, imageData: ctx.getImageData(left, top, tw, th) };
}