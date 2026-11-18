import {createServer} from 'node:http';
import { readFile } from 'node:fs';
import { join, extname, sep } from 'node:path';
import { WebSocketServer } from 'ws';


const hostname = process.env.RENDER ? '0.0.0.0' : '127.0.0.1';
const port = process.env.PORT || 3000;
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer((req, res) => {
  const publicDir = join(import.meta.dirname, 'public');

  const { pathname } = new URL(req.url, 'http://localhost');
  let thisFile = pathname === '/' ? 'index.html' : pathname;
  let thisPath = join(publicDir, thisFile)


  if(!thisPath.startsWith(publicDir + sep)){
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  readFile(thisPath, (err,data) => {
    if(err){
      res.setHeader('Content-Type', 'text/plain')
      res.statusCode = 404;
      res.end('Not found\n' + err);
    }else{
      const type = mimeTypes[extname(thisPath)] || 'application/octet-stream';
      res.setHeader('Content-Type', type);
      res.statusCode = 200;
      res.end(data);
    }
  });

});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

const wss = new WebSocketServer({ server });
const rooms = new Map();


function makeRoomCode() {
  const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ2345679';
  let code = '';
  for (let i = 0; i < 4; i++) code += codeChars[Math.floor(Math.random() * codeChars.length)];
  return rooms.has(code) ? makeRoomCode() : code; // retry on collision
}

function send(socket, data) {
  if (socket.readyState === 1) socket.send(JSON.stringify(data)); // 1 = OPEN
}

function broadcast(room, data, except = null) {
  for (const s of rooms.get(room) ?? []) {
    if (s !== except) send(s, data);
  }
}

function leaveRoom(socket) {
  const room = socket.room;
  if (!room || !rooms.has(room)) return;
  rooms.get(room).delete(socket);
  if (rooms.get(room).size === 0) rooms.delete(room); // clean up empty rooms
  else broadcast(room, { type: 'player_left' });
  socket.room = null;
}

wss.on('connection', (socket) => {
  socket.isAlive = true;
  socket.on('pong', () => { socket.isAlive = true; });

  socket.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return; // ignore garbage
    }

    if (msg.type === 'create') {
      const code = makeRoomCode();
      rooms.set(code, new Set([socket]));
      socket.room = code;
      send(socket, { type: 'created', room: code });

    } else if (msg.type === 'join') {
      const code = String(msg.room || '').toUpperCase();
      if (!rooms.has(code)) return send(socket, { type: 'error', message: 'Room not found' });
      leaveRoom(socket);
      rooms.get(code).add(socket);
      socket.room = code;
      send(socket, { type: 'joined', room: code });
      broadcast(code, { type: 'player_joined' }, socket);

    } else if (msg.type === 'action' && socket.room) {
      // relay game moves to everyone else in the room
      broadcast(socket.room, { type: 'action', data: msg.data }, socket);
    }
  });

  socket.on('close', () => leaveRoom(socket));
  socket.on('error', console.error);
});

// Heartbeat: keeps Render's proxy from dropping idle connections
setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.isAlive) { socket.terminate(); continue; }
    socket.isAlive = false;
    socket.ping();
  }
}, 25000);