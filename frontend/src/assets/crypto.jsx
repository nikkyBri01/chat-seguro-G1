import { io } from 'socket.io-client';

const socket = io("http://localhost:5000");

function bufferToBase64(buf) {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64) {
  // Eliminar caracteres no válidos y saltos de línea
  let cleanBase64 = b64.replace(/[^A-Za-z0-9+/=]/g, '');

  // Asegurar que la longitud sea múltiplo de 4, rellenando con '=' si es necesario
  const padding = cleanBase64.length % 4;
  if (padding !== 0) {
    cleanBase64 += '='.repeat(4 - padding); // Rellenar con '=' solo si la longitud no es un múltiplo de 4
  }

  // Convertir base64 a buffer (Uint8Array)
  return Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
}

// Genera par de claves RSA para el navegador
async function generateRSAKeys() {
  return await crypto.subtle.generateKey({
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256"
  }, true, ["encrypt", "decrypt"]);
}

// Exporta la clave pública (formato SPKI -> base64)
async function exportPublicKey(key) {
  const spki = await crypto.subtle.exportKey("spki", key);
  return bufferToBase64(spki);
}

// Cifra la clave AES con la clave pública del receptor
async function encryptAESKey(aesKeyRaw, receiverPublicKeyB64) {
  const pubBuf = base64ToBuffer(receiverPublicKeyB64);
  const key = await crypto.subtle.importKey("spki", pubBuf, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  return await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, aesKeyRaw);
}

// Genera clave AES-GCM
async function generateAESKey() {
  return await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

// Cifra el mensaje con AES-GCM
async function encryptMessageWithAES(key, message) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(message);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc);
  return { ciphertext: new Uint8Array(cipher), iv };
}

// Cifra un archivo con AES-GCM
async function encryptFileWithAES(key, file) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileData = new Uint8Array(await file.arrayBuffer());
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, fileData);
  return { ciphertext: new Uint8Array(cipher), iv };
}
async function decryptFileWithAES(ciphertext, encryptedKey, nonce, privateKey) {
  // Descifrar la clave AES con la clave privada RSA
  const aesKeyRaw = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToBuffer(encryptedKey)
  );

  // Importar la clave AES para usarla con AES-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    aesKeyRaw,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Convertir nonce de base64 a buffer
  const iv = base64ToBuffer(nonce);

  // Descifrar el archivo
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext
  );

  return new Uint8Array(decrypted);
}

export {
    socket,
    bufferToBase64,
    base64ToBuffer,
    generateRSAKeys,
    exportPublicKey,
    encryptAESKey,
    generateAESKey,
    encryptMessageWithAES,
    encryptFileWithAES,
    decryptFileWithAES
  };
  