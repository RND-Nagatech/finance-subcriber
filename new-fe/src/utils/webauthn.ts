//
// utils untuk WebAuthn (WAJIB ADA)
//

/**
 * Convert base64URL string → ArrayBuffer
 */
export function base64URLToBuffer(base64url: string) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + pad)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const uintArray = new Uint8Array(buffer);

  for (let i = 0; i < raw.length; i++) {
    uintArray[i] = raw.charCodeAt(i);
  }

  return buffer;
}

/**
 * Convert ArrayBuffer → base64URL string
 */
export function bufferToBase64URL(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;

  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });

  const base64 = window.btoa(binary);

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
