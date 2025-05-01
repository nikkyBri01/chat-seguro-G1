import React from 'react';

const Files = ({ setSelectedFile }) => {
  const FileSelect = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
  };

  return (
    <div>
      <input type="file" onChange={FileSelect} />
    </div>
  );
};

export default Files;

