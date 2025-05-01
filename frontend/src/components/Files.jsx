import React, { useRef } from 'react';
import 'font-awesome/css/font-awesome.min.css'; // Asegúrate de importar el archivo CSS de Font Awesome

const Files = ({ setSelectedFile }) => {
  const fileInputRef = useRef(null);

  const FileSelect = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
  };

  const handleIconClick = () => {
    fileInputRef.current.click(); // Activar el input file
  };

  return (
    <div>
      <button onClick={handleIconClick} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <i className="fa fa-paperclip" style={{ fontSize: '24px' }}></i> {/* Ícono de clip de Font Awesome */}
      </button>
      <input type="file" ref={fileInputRef} onChange={FileSelect} style={{ display: 'none' }} // Ocultar el input de tipo file
      />
    </div>
  );
};

export default Files;

