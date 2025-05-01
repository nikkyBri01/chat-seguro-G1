// components/Login.js
import React from 'react';
import { toast } from 'react-toastify';
import { generateRSAKeys, exportPublicKey } from '../assets/crypto';

const Login = ({ username, setUsername, setRsaKeys, socket, isLogin}) => {
  
  const handleLogin = async () => {
    const keys = await generateRSAKeys();
    const pubKey = await exportPublicKey(keys.publicKey);
    socket.emit("register_public_key", { username, public_key: pubKey });
    socket.emit("join", { username });
    setRsaKeys(keys);
    toast.success(`¡Bienvenido, ${username}! Inicio de sesión exitoso.`);
  };

  return (
    <div>
      <input
        type="text"
        value={username}
        placeholder="Nombre de usuario"
        onChange={e => setUsername(e.target.value)}
      />
      {!isLogin && (<button onClick={handleLogin}>Iniciar sesión</button>)}

    </div>
  );
};

export default Login;
