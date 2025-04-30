from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Guardamos las claves públicas temporalmente
user_keys = {}
@app.route('/')
def home():
    return "Servidor de chat seguro corriendo correctamente"

# Ruta para obtener la clave pública de otro usuario
@app.route("/get_public_key/<username>")
def get_public_key(username):
    key = user_keys.get(username)
    return jsonify({"public_key": key}) if key else ("Not found", 404)

# Evento WebSocket para registrar clave pública
@socketio.on("register_public_key")
def handle_register(data):
    username = data["username"]
    pubkey = data["public_key"]
    user_keys[username] = pubkey
    print(f"[INFO] Public key registered for {username}")

# Evento WebSocket para recibir un mensaje y reenviarlo
@socketio.on("send_message")
def handle_send_message(data):
    receiver = data["receiver"]
    emit("receive_message", data, room=receiver)

# Evento WebSocket para unir al usuario a su sala privada
@socketio.on("join")
def on_join(data):
    username = data["username"]
    join_room(username)
    print(f"[INFO] {username} joined their private room")

@socketio.on('send_file')
def handle_file(data):
    receiver = data.get("receiver")
    emit("receive_file", data, room=receiver)
    print(f"Archivo enviado de {data.get('sender')} a {receiver}")





if __name__ == '__main__':
    socketio.run(app, host="127.0.0.1", port=5000, debug=True)