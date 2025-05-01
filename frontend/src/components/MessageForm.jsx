// components/MessageForm.js
import React, { useState } from 'react';
import { generateAESKey, encryptAESKey, encryptMessageWithAES, encryptFileWithAES, bufferToBase64 }  from '../assets/crypto';
import Files from './Files';
import '../styles/MessageForm.css'; 

const MessageForm = ({ username, receiver, setMessages, socket }) => {
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null); 

  const sendMessage = async () => {
    if (!message && !selectedFile) return; // Si no hay nada que enviar
  
    // Enviar mensaje si hay
    if (message) {
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
          return [...prev, 
            { from: "Tú", 
              text: message, 
              time: new Date().toLocaleTimeString() 
            }
          ];
        }
        return prev;
      });
  
      setMessage("");
    }
  
    // Enviar archivo si se selecciona
    if (selectedFile) {
      const aesKey = await generateAESKey();
      const aesRaw = await crypto.subtle.exportKey("raw", aesKey);
      const encryptedFile = await encryptFileWithAES(aesKey, selectedFile);
  
      const res = await fetch(`http://localhost:5000/get_public_key/${receiver}`);
      const { public_key } = await res.json();
      const encryptedKey = await encryptAESKey(aesRaw, public_key);
      console.log("--- Encriptación del Archivo ---");
      console.log("Nombre del archivo:", selectedFile.name);
      console.log("Tipo del archivo:", selectedFile.type);
      console.log("Clave AES (ArrayBuffer):", aesRaw);
      console.log("Clave AES (Base64):", bufferToBase64(aesRaw));
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
  
      setMessages(prev => [
        ...prev,
        {
          from: "Tú",
          type: "file",
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileURL: URL.createObjectURL(new Blob([selectedFile])),
          time: new Date().toLocaleTimeString()
        }
      ]);
  
      setSelectedFile(null); // Limpiar archivo tras envío
    }
  };
  
  return (
    <div className='message-form-container'>
      
      <input
        type="text"
        value={message}
        placeholder="Escribe un mensaje"
        onChange={e => setMessage(e.target.value)}
      />

      <div className="file-upload">
        <Files
              setSelectedFile={setSelectedFile}
        />
      </div>
      <button className='send-button' onClick={sendMessage} disabled={!message && !selectedFile}><i className="fa fa-paper-plane" style={{ fontSize: '24px', color: '#0f3d11' }}></i></button>
    </div>
  );
};

export default MessageForm;
