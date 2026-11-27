// Shared binary encoding and content digest; independent of retired archives.
export const encodeBytes = (bytes) => {
  const CHUNK = 32766; // divisible by three: concatenated base64 chunks stay valid
  let out = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const piece = bytes.subarray(i, i + CHUNK);
    let ascii = "";
    for (const n of piece) ascii += String.fromCharCode(n);
    out += btoa(ascii);
  }
  return out;
};
export const sha256 = async (bytes) => {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
};
