"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const { WebSocketServer, WebSocket } = require("ws");

const port = Number(process.env.PORT || 3000);
const allowedOrigin = process.env.ALLOWED_ORIGIN;
const rooms = new Map();

const server = http.createServer((request, response) => {
  if (request.url !== "/health") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
server.on("upgrade", (request, socket, head) => {
  if (request.url !== "/duel" || (allowedOrigin && request.headers.origin !== allowedOrigin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
});

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function roomCode() {
  let code;
  do { code = crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase(); }
  while (rooms.has(code));
  return code;
}

function cleanName(value) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, 18) || "Oʼyinchi";
}

function snapshot(room) {
  return {
    type: "state",
    roomId: room.code,
    started: room.started,
    startAt: room.startAt,
    distance: Math.floor(room.distance),
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      lane: player.lane,
      lives: player.lives,
      invulnerable: player.invulnerableUntil > Date.now()
    })),
    obstacles: room.obstacles.map((obstacle) => ({ lane: obstacle.lane, at: obstacle.at }))
  };
}

function broadcast(room, message) {
  for (const player of room.players) if (player) send(player.socket, message);
}

function finish(room) {
  if (room.finished) return;
  room.finished = true;
  const defeated = room.players.map((player) => player.lives <= 0);
  const winnerIndex = defeated[0] && defeated[1] ? -1 : defeated[0] ? 1 : defeated[1] ? 0 : -1;
  const winnerId = winnerIndex < 0 ? null : room.players[winnerIndex].id;
  broadcast(room, {
    type: "result",
    matchId: room.matchId,
    winnerId,
    reward: winnerId ? 250 : 0,
    distance: Math.floor(room.distance),
    players: snapshot(room).players
  });
  room.finishedAt = Date.now();
}

function tick(room, now) {
  if (room.finished || room.players.some((player) => !player)) return;
  if (!room.started) {
    if (now >= room.startAt) {
      room.started = true;
      room.lastTick = now;
      room.nextObstacleAt = 60;
    }
    broadcast(room, snapshot(room));
    return;
  }

  const dt = Math.min(.1, Math.max(0, (now - room.lastTick) / 1000));
  room.lastTick = now;
  const speed = 20 + Math.min(10, room.distance / 450);
  room.distance += speed * dt;
  if (room.distance >= room.nextObstacleAt - 40) {
    room.obstacles.push({
      lane: crypto.randomInt(0, 3),
      at: room.nextObstacleAt,
      passed: [false, false]
    });
    room.nextObstacleAt += Math.max(30, 45 - Math.floor(room.distance / 600));
  }

  room.obstacles.forEach((obstacle) => {
    if (room.distance < obstacle.at) return;
    room.players.forEach((player, index) => {
      if (obstacle.passed[index]) return;
      obstacle.passed[index] = true;
      if (player.lane === obstacle.lane && player.invulnerableUntil <= now && player.lives > 0) {
        player.lives--;
        player.invulnerableUntil = now + 1400;
      }
    });
  });
  room.obstacles = room.obstacles.filter((obstacle) => room.distance - obstacle.at < 5);
  if (room.players.some((player) => player.lives <= 0)) {
    finish(room);
    return;
  }
  broadcast(room, snapshot(room));
}

function closeRoom(room, reason) {
  if (!rooms.has(room.code)) return;
  rooms.delete(room.code);
  for (const player of room.players) {
    if (player && player.socket.readyState === WebSocket.OPEN) {
      send(player.socket, { type: "error", message: reason });
      player.socket.close(1000, "Room closed");
    }
  }
}

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); }
    catch {
      send(socket, { type: "error", message: "Notoʼgʼri xabar formati." });
      return;
    }
    if (!message || typeof message.type !== "string") {
      send(socket, { type: "error", message: "Notoʼgʼri soʼrov." });
      return;
    }

    if (message.type === "create") {
      if (socket.player) {
        send(socket, { type: "error", message: "Siz allaqachon xonadasiz." });
        return;
      }
      const code = roomCode();
      const player = { id: crypto.randomUUID(), name: cleanName(message.name), socket, lane: 1, lives: 3, invulnerableUntil: 0 };
      const room = {
        code, players: [player, null], started: false, finished: false,
        startAt: 0, lastTick: 0, nextObstacleAt: 60, distance: 0, obstacles: [],
        matchId: crypto.randomUUID(), createdAt: Date.now()
      };
      socket.player = player;
      socket.room = room;
      socket.index = 0;
      rooms.set(code, room);
      send(socket, { type: "created", roomId: code, playerId: player.id });
      send(socket, { type: "waiting" });
      return;
    }

    if (message.type === "join") {
      if (socket.player) {
        send(socket, { type: "error", message: "Siz allaqachon xonadasiz." });
        return;
      }
      const room = rooms.get(String(message.roomId || "").toUpperCase());
      if (!room || room.finished || room.players[1]) {
        send(socket, { type: "error", message: "Xona topilmadi yoki toʼlgan." });
        return;
      }
      const player = { id: crypto.randomUUID(), name: cleanName(message.name), socket, lane: 1, lives: 3, invulnerableUntil: 0 };
      room.players[1] = player;
      room.startAt = Date.now() + 3500;
      socket.player = player;
      socket.room = room;
      socket.index = 1;
      for (const member of room.players) send(member.socket, { type: "matched", roomId: room.code, startAt: room.startAt });
      broadcast(room, snapshot(room));
      return;
    }

    if (message.type === "move") {
      const player = socket.player;
      const room = socket.room;
      if (!player || !room || !room.started || room.finished || ![-1, 1].includes(message.direction)) return;
      const now = Date.now();
      if (now - (player.lastMoveAt || 0) < 115) return;
      player.lastMoveAt = now;
      player.lane = Math.max(0, Math.min(2, player.lane + message.direction));
      return;
    }

    if (message.type === "leave" && socket.room) {
      closeRoom(socket.room, "Oʼyinchi xonadan chiqdi. Duel yakunlandi.");
    }
  });

  socket.on("close", () => {
    if (socket.room && !socket.room.finished) closeRoom(socket.room, "Oʼyinchi aloqani uzdi. Duel yakunlandi.");
  });
  socket.on("error", (error) => console.error("WebSocket client error:", error.message));
});

const timer = setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (!room.started && !room.players[1] && now - room.createdAt > 120000) {
      closeRoom(room, "Kutish vaqti tugadi. Yangi xona oching.");
    } else if (room.finished && now - room.finishedAt > 30000) {
      closeRoom(room, "Duel yakunlandi.");
    } else {
      tick(room, now);
    }
  }
}, 100);
timer.unref();

server.listen(port, "0.0.0.0", () => {
  console.log(`Duel server listening on port ${port}`);
});
