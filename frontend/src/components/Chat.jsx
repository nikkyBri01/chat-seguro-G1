// components/Chat.js
import React from 'react';
import '../styles/chat.css';

const Chat = ({ messages, username }) => {
  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((msg, index) => {
          const isMe = msg.from === 'Tú' || msg.from === username;
          const messageClass = isMe ? 'message-sent' : 'message-received';

          return msg.type === 'file' ? (
            <div key={index} className={`message ${messageClass}`}>
              <div className="message-bubble">
                <strong>{msg.from || 'Tú'}:</strong><br />
                <a href={msg.fileURL} download={msg.fileName}>{msg.fileName}</a>
                <span className="">{msg.time}</span>
              </div>
            </div>
          ) : (
            <div key={index} className={`message ${messageClass}`}>
              <div className="message-bubble">
                <strong>{msg.from}:</strong> {msg.text}
                <span className="message-meta">{msg.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Chat;
