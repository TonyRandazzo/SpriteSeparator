document.getElementById("extractButton").addEventListener("click", () => {
  const fileInput = document.getElementById("imageLoader");
  const frameCount = parseInt(document.getElementById("frameCount").value, 10);

  if (!fileInput.files.length || isNaN(frameCount)) {
    alert("Carica un'immagine e inserisci il numero di frame.");
    return;
  }

  const file = fileInput.files[0];
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.src = url;

  img.onload = async () => {
    const frameWidth = img.width / frameCount;
    const frameHeight = img.height;
    const zip = new JSZip();
    const output = document.getElementById("output");
    output.innerHTML = "";

    for (let i = 0; i < frameCount; i++) {
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");

      tempCanvas.width = frameWidth;
      tempCanvas.height = frameHeight;
      tempCtx.drawImage(img, i * frameWidth, 0, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);

      const trimmedData = trimTransparent(tempCanvas);

      if (trimmedData) {
        const trimmedCanvas = document.createElement("canvas");
        trimmedCanvas.width = trimmedData.width;
        trimmedCanvas.height = trimmedData.height;
        const trimmedCtx = trimmedCanvas.getContext("2d");
        trimmedCtx.putImageData(trimmedData.imageData, 0, 0);

        output.appendChild(trimmedCanvas);

        await new Promise(resolve => {
          trimmedCanvas.toBlob(blob => {
            zip.file(`${i}.png`, blob);
            resolve();
          }, "image/png");
        });
      }
    }

    zip.generateAsync({ type: "blob" }).then(function (content) {
      saveAs(content, "frames.zip");
    });

    URL.revokeObjectURL(url);
  };
});

function trimTransparent(canvas) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  let top = null, bottom = null, left = null, right = null;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3];
      if (alpha > 0) {
        if (top === null) top = y;
        bottom = y;
        if (left === null || x < left) left = x;
        if (right === null || x > right) right = x;
      }
    }
  }

  if (top === null) return null;

  const trimmedWidth = right - left + 1;
  const trimmedHeight = bottom - top + 1;
  const trimmedData = ctx.getImageData(left, top, trimmedWidth, trimmedHeight);
  return {
    width: trimmedWidth,
    height: trimmedHeight,
    imageData: trimmedData
  };
}
