import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// FEAM
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// FEC

const socket = io("http://localhost:5000");

// Conversiones binario <-> base64
/*function bufferToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
*/
function bufferToBase64(buf) {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
async function exportAndConvertKey(key) {
  if (!(key instanceof CryptoKey)) {
    throw new Error("El argumento no es una CryptoKey válida.");
  }

  if (!key.extractable) {
    throw new Error("La clave no es exportable.");
  }

  const base64Key = await exportCryptoKey(key);  // Exporta la clave en base64
  const buffer = base64ToBuffer(base64Key);      // Convierte base64 a Uint8Array

  return buffer;
}
async function exportCryptoKey(key) {
  const exportedKey = await crypto.subtle.exportKey("pkcs8", key);
  return arrayBufferToBase64(exportedKey);
}
function base64ToBuffer(b64) {
  //console.log('Tipo de b64:', typeof b64);
  //console.log('Valor de b64:', b64);
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


// Componente principal
function App() {
  const [rsaKeys, setRsaKeys] = useState(null);
  const [username, setUsername] = useState('');
  const [receiver, setReceiver] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (!rsaKeys) return;
    socket.on("receive_message", async data => {
      const { sender, ciphertext, encrypted_key, nonce } = data;

      try {
        // Log de entrada: mensaje cifrado recibido
        console.log(`Mensaje recibido de ${sender}`);
        console.log("Texto cifrado (base64):", ciphertext);
        console.log("Nonce (IV) en base64:", nonce);
        const encryptedKeyBuf = base64ToBuffer(encrypted_key);
        const nonceBuf = base64ToBuffer(nonce);
        const ciphertextBuf = base64ToBuffer(ciphertext);

        const aesKey = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, rsaKeys.privateKey, encryptedKeyBuf);
        const aesImportedKey = await crypto.subtle.importKey("raw", aesKey, { name: "AES-GCM" }, false, ["decrypt"]);

        const decrypted = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: nonceBuf },
          aesImportedKey,
          ciphertextBuf
        );

        const decoder = new TextDecoder();
        const messageText = decoder.decode(decrypted);
        console.log(`Mensaje recibido de ${sender}`);
        console.log("Texto cifrado (base64):", ciphertext);
        console.log("Texto descifrado:", messageText);
        console.log("Nonce (IV) en base64:", nonce);

        setMessages(prev => [...prev, {
          from: sender,
          text: messageText,
          time: new Date().toLocaleTimeString()
        }]);
      } catch (err) {
        console.error("Error al descifrar:", err);
      }
    });

socket.on("receive_file", async (data) => {
  console.log("Archivo recibido:", data);
  try {
    const fileBuffer = base64ToBuffer(data.fileData);
    const decryptedFileBuffer = await decryptFileWithAES(
      fileBuffer,
      data.encrypted_key, // Usar la clave AES cifrada recibida
      data.nonce,         // Usar el nonce recibido
      rsaKeys.privateKey
    );

    // Crea un Blob para descargar el archivo
    const fileBlob = new Blob([decryptedFileBuffer], { type: data.fileType });
    const fileURL = URL.createObjectURL(fileBlob);

    setMessages(prevMessages => [
      ...prevMessages,
      { type: "file", fileURL, fileName: data.fileName, fileType: data.fileType, time: new Date().toLocaleTimeString() }
    ]);
  } catch (error) {
    console.error("Error al descifrar el archivo:", error);
  }
});

    return () => {
      socket.off("receive_message");
      socket.off("receive_file");
    };
  }, [rsaKeys]);

  const handleLogin = async () => {
    const keys = await generateRSAKeys();
    const pubKey = await exportPublicKey(keys.publicKey);
    socket.emit("register_public_key", { username, public_key: pubKey });
    socket.emit("join", { username });
    setRsaKeys(keys);
    toast.success(`¡Bienvenido, ${username}! Inicio de sesión exitoso.`);
  };

  const sendMessage = async () => {
    const aesKey = await generateAESKey();
    const aesRaw = await crypto.subtle.exportKey("raw", aesKey);

    const res = await fetch(`http://localhost:5000/get_public_key/${receiver}`);
    const { public_key } = await res.json();

    const encryptedKey = await encryptAESKey(aesRaw, public_key);
    const { ciphertext, iv } = await encryptMessageWithAES(aesKey, message);

    socket.emit("send_message", {
      sender: username,
      receiver,
      encrypted_key: bufferToBase64(encryptedKey),
      nonce: bufferToBase64(iv),
      ciphertext: bufferToBase64(ciphertext)
    });

    setMessages(prev => {
      if (!prev.some(msg => msg.text === message && msg.from === "Tú")) {
        return [...prev, { from: "Tú", text: message, time: new Date().toLocaleTimeString() }];
      }
      return prev;
    });

    setMessage('');
  };

  const [isSending, setIsSending] = useState(false);

  const handleFileSelect = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const sendFile = async () => {
    if (!selectedFile || isSending) return;

    setIsSending(true);

    const aesKey = await generateAESKey();
    const aesRaw = await crypto.subtle.exportKey("raw", aesKey);

    const reader = new FileReader();
    reader.onload = async () => {
      //const encryptedFile = await encryptFileWithAES(aesRaw, selectedFile);
      const encryptedFile = await encryptFileWithAES(aesKey, selectedFile);
      const res = await fetch(`http://localhost:5000/get_public_key/${receiver}`);
      const { public_key } = await res.json();
      const encryptedKey = await encryptAESKey(aesRaw, public_key);
    console.log("--- Encriptación del Archivo ---");
    console.log("Nombre del archivo:", selectedFile.name);
    console.log("Tipo del archivo:", selectedFile.type);
    console.log("Clave AES (raw, ArrayBuffer):", aesRaw);
    console.log("Clave AES (raw, Base64):", bufferToBase64(aesRaw));
    console.log("Vector de Inicialización (IV, ArrayBuffer):", encryptedFile.iv);
    console.log("Archivo Encriptado (ciphertext, ArrayBuffer):", encryptedFile.ciphertext);

    console.log("Clave AES Cifrada con RSA (ArrayBuffer):", encryptedKey);

    console.log("--- Fin de Encriptación del Archivo ---");

      socket.emit("send_file", {
        sender: username,
        receiver: receiver,
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileData: bufferToBase64(encryptedFile.ciphertext),
        encrypted_key: bufferToBase64(encryptedKey),
        nonce: bufferToBase64(encryptedFile.iv),
      });

      setMessages(prevMessages => [
        ...prevMessages.filter(msg => msg.fileName !== selectedFile.name),
        {
          from: "Tú",
          type: "file",
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileData: URL.createObjectURL(new Blob([selectedFile])),
          time: new Date().toLocaleTimeString()
        }
      ]);

      setIsSending(false);
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Chat Seguro</h2>
      <input placeholder="Usuario" onChange={e => setUsername(e.target.value)} />
      <button onClick={handleLogin}>Iniciar sesión</button>
      <hr />
      <input placeholder="Enviar a..." onChange={e => setReceiver(e.target.value)} />
      <textarea placeholder="Mensaje" value={message} onChange={e => setMessage(e.target.value)} />
      <button onClick={sendMessage}>Enviar</button>
      <input type="file" onChange={handleFileSelect} />
      {selectedFile && <p>Archivo seleccionado: {selectedFile.name}</p>}
      <button onClick={sendFile}>Enviar archivo</button>

      <hr />
      <div style={{ marginTop: 20, padding: 10, backgroundColor: "#f1f1f1", height: 300, overflowY: "auto", borderRadius: 10 }}>
        <h4>Historial de mensajes:</h4>
        {messages.length === 0 ? (
          <p style={{ fontStyle: 'italic' }}>No hay mensajes aún.</p>
        ) : (
          messages.map((msg, i) => {
            const isMine = msg.from === "Tú";
            return (
              <div key={i} style={{
                display: 'flex',
                justifyContent: isMine ? 'flex-end' : 'flex-start',
                padding: '4px 0'
              }}>
                <div style={{
                  backgroundColor: isMine ? '#d1e7dd' : '#e2e3e5',
                  color: '#000',
                  borderRadius: 12,
                  padding: '8px 12px',
                  maxWidth: '60%',
                  textAlign: 'left',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '0.9em', marginBottom: 4 }}>
                    <strong>{isMine ? "Tú" : msg.from}</strong>
                  </div>

                  <div>{msg.text}</div>
                  {msg.type === "file" ? (
                    <div>

                        <p>envió un archivo:</p>
                      <a href={msg.fileURL} download={msg.fileName}>{msg.fileName}</a>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <ToastContainer />
    </div>
  );
}

export default App;
