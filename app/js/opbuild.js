// opbuild.js — helpers for generating a standalone operator file from inside the
// Building Area Manager editor, in the browser (no Python/build step). The editor
// build embeds the operator HTML as a string with two placeholder tokens; here we
// fill them with the current site's seed data + inlined background images, and we
// read loaded image files into base64 data URIs (down-scaling oversized ones).

// Placeholder tokens the build writes into OPERATOR_TEMPLATE in place of the real
// SEED_DATA / BG_IMAGE_DATA_URIS values. Quoted so the un-filled template stays
// valid JS; the whole quoted token (quotes included) is replaced.
export const SEED_TOKEN = '"__BAM_SEED_DATA__"';
export const BG_TOKEN = '"__BAM_BG_IMAGE_DATA_URIS__"';

// Fill the operator template with a site's seed + background data URIs.
// IMPORTANT: the replacement values are passed as *functions*, not strings, so
// JSON containing `$&`, `$$`, `$1`, … is inserted verbatim (String.prototype
// .replace gives `$` special meaning only in a string replacement).
export function fillOperatorTemplate(template, { seed, bgUris }) {
  return template
    .replace(SEED_TOKEN, () => JSON.stringify(seed))
    .replace(BG_TOKEN, () => JSON.stringify(bgUris || {}));
}

// Read an image File into a base64 data: URI. Images wider than maxWidth are
// down-scaled through a canvas to keep the generated operator file small enough
// to email; smaller images keep their original bytes (and compression).
// Resolves { dataUri, width, height } (width/height are the natural, pre-scale
// dimensions — the region grid is defined against those).
export function readImageDataUrl(file, maxWidth = 2000) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      try {
        if (w <= maxWidth) {
          // Keep original bytes/mime — best fidelity for line-art floor plans.
          const reader = new FileReader();
          reader.onload = () => { URL.revokeObjectURL(url); resolve({ dataUri: reader.result, width: w, height: h }); };
          reader.onerror = () => { URL.revokeObjectURL(url); reject(reader.error || new Error('read failed')); };
          reader.readAsDataURL(file);
          return;
        }
        const scale = maxWidth / w;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const mime = (file.type && file.type.startsWith('image/')) ? file.type : 'image/png';
        const dataUri = canvas.toDataURL(mime);
        URL.revokeObjectURL(url);
        resolve({ dataUri, width: w, height: h });
      } catch (err) { URL.revokeObjectURL(url); reject(err); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not decode image')); };
    img.src = url;
  });
}

// Rough byte size of a base64 data: URI's payload (for user-facing size hints).
export function dataUriBytes(dataUri) {
  const i = String(dataUri).indexOf(',');
  if (i < 0) return 0;
  const b64 = dataUri.slice(i + 1);
  return Math.floor(b64.length * 3 / 4);
}
