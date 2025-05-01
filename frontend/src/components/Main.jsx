// App.js
import React, { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './loginForm';
import Chat from './Chat';
import MessageForm from './MessageForm';
import '../styles/Main.css'

import { socket, base64ToBuffer, decryptFileWithAES }  from '../assets/crypto';

function Main() {
  const [rsaKeys, setRsaKeys] = useState(null);
  const [username, setUsername] = useState('');
  const [receiver, setReceiver] = useState('');
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!rsaKeys) return;

    socket.on("receive_message", async data => {
      const { sender, ciphertext, encrypted_key, nonce } = data;

      try {
        console.log(`Mensaje recibido de ${sender}`);
        console.log("Texto cifrado:", ciphertext);
        console.log("Nonce (IV):", nonce);

        const encryptedKeyBuf = base64ToBuffer(encrypted_key);
        const nonceBuf = base64ToBuffer(nonce);
        const ciphertextBuf = base64ToBuffer(ciphertext);

        const aesKey = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, rsaKeys.privateKey, encryptedKeyBuf);
        const aesImportedKey = await crypto.subtle.importKey("raw", aesKey, { name: "AES-GCM" }, false, ["decrypt"]);

        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonceBuf }, aesImportedKey, ciphertextBuf);
        const messageText = new TextDecoder().decode(decrypted);

        setMessages(prev => [...prev, { from: sender, text: messageText, time: new Date().toLocaleTimeString() }]);
      } catch (err) {
        console.error("Error al descifrar mensaje:", err);
      }
    });

    socket.on("receive_file", async data => {
      try {
        const fileBuffer = base64ToBuffer(data.fileData);
        const decryptedFileBuffer = await decryptFileWithAES(fileBuffer, data.encrypted_key, data.nonce, rsaKeys.privateKey);
        const fileBlob = new Blob([decryptedFileBuffer], { type: data.fileType });
        const fileURL = URL.createObjectURL(fileBlob);

        setMessages(prev => [...prev, {
          type: "file",
          fileURL,
          fileName: data.fileName,
          fileType: data.fileType,
          from: data.sender,
          time: new Date().toLocaleTimeString()
        }]);
      } catch (error) {
        console.error("Error al descifrar archivo:", error);
      }
    });

    socket.on("join", username => {
      socket.join(username); // se une a una sala con su nombre
    });

    return () => {
      socket.off("receive_message");
      socket.off("receive_file");
    };
  }, [rsaKeys]);

  return (
    <div className='main'>
      <ToastContainer />
      <div className="input-container">
        <Login 
          username={username} 
          setUsername={setUsername} 
          setRsaKeys={setRsaKeys} 
          socket={socket} 
          isLogin={!!rsaKeys}
        />
        {rsaKeys && (<label htmlFor="">Para: </label>)}
        {rsaKeys && (
          <input 
            className='inputDest'
            type="text"
            placeholder="Destinatario"
            value={receiver}
            onChange={e => setReceiver(e.target.value)}
          />
        )}
      </div>

      {rsaKeys && (
        <div className="chat-wrapper">
          <div className="chat-box">
            <Chat messages={messages} />
          </div>
          <div className="message-container">
            <MessageForm
              username={username}
              receiver={receiver}
              setMessages={setMessages}
              socket={socket}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default Main;
