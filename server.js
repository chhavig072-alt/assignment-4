// npm init -y
// npm i socket.io
const express = require("express");
const http = require("http");
const path = require("path");

const { Server } = require("socket.io");

const app = express();
const httpserver = http.createServer(app);

const io = new Server(httpserver);

// ---------- ADDED: serve the frontend from /public ----------
app.use(express.static(path.join(__dirname, "public")));

// ---------- ADDED: in-memory state for chat + rooms ----------
const LOBBY = "lobby"; // everyone is in the lobby (public chat)
// rooms: id -> { id, name, isPrivate, owner, members: Map<socketId, username> }
const rooms = new Map();
rooms.set(LOBBY, {
  id: LOBBY,
  name: "Lobby",
  isPrivate: false,
  owner: null,
  members: new Map(),
});

const clean = (s, max) => String(s ?? "").trim().slice(0, max);

function newRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id;
  do {
    id = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(id));
  return id;
}

function roomInfo(r) {
  return { id: r.id, name: r.name, isPrivate: r.isPrivate, count: r.members.size };
}

function broadcastRoomList() {
  // Only public rooms are listed; private rooms are joined by code
  io.emit(
    "room:list",
    [...rooms.values()].filter((r) => !r.isPrivate).map(roomInfo)
  );
}

function broadcastMembers(roomId) {
  const r = rooms.get(roomId);
  if (!r) return;
  io.to(roomId).emit("room:members", {
    room: roomId,
    members: [...r.members.values()],
  });
}

function systemMsg(roomId, text) {
  io.to(roomId).emit("message", {
    room: roomId,
    system: true,
    text,
    time: Date.now(),
  });
}

function leaveRoom(socket, roomId) {
  const r = rooms.get(roomId);
  if (!r || !r.members.has(socket.id)) return;
  const name = r.members.get(socket.id);
  r.members.delete(socket.id);
  socket.leave(roomId);
  if (roomId !== LOBBY && r.members.size === 0) {
    rooms.delete(roomId); // empty personal rooms disappear
  } else {
    systemMsg(roomId, `${name} left`);
    broadcastMembers(roomId);
  }
  broadcastRoomList();
}

function joinRoom(socket, roomId) {
  const r = rooms.get(roomId);
  if (!r || r.members.has(socket.id)) return r;
  r.members.set(socket.id, socket.data.username);
  socket.join(roomId);
  systemMsg(roomId, `${socket.data.username} joined`);
  broadcastMembers(roomId);
  broadcastRoomList();
  return r;
}

let count = 0;
io.on("connection", (socket) => {
  count++;
  console.log("Active user: ", count);

  // Sending
  socket.emit("gyankibaat", "welcome to socket.io server");

  socket.broadcast.emit("join", "New User Joined");

  //   Reading
  socket.on("kuchbhi", (msg) => {
    console.log(msg);
  });

  // ---------- ADDED: chat + personal rooms ----------

  // 1. Choose a username (must be done before anything else)
  socket.on("register", (username, cb = () => {}) => {
    const name = clean(username, 20);
    if (!name) return cb({ ok: false, error: "Enter a name" });
    const taken = [...io.sockets.sockets.values()].some(
      (s) => s.id !== socket.id && s.data.username?.toLowerCase() === name.toLowerCase()
    );
    if (taken) return cb({ ok: false, error: "That name is already in use" });

    socket.data.username = name;
    joinRoom(socket, LOBBY);
    cb({
      ok: true,
      username: name,
      room: roomInfo(rooms.get(LOBBY)),
      rooms: [...rooms.values()].filter((r) => !r.isPrivate).map(roomInfo),
    });
  });

  // 2. Create a personal room (public = listed, private = join by code only)
  socket.on("room:create", ({ name, isPrivate } = {}, cb = () => {}) => {
    if (!socket.data.username) return cb({ ok: false, error: "Register first" });
    const roomName = clean(name, 30);
    if (!roomName) return cb({ ok: false, error: "Room needs a name" });
    const id = newRoomId();
    rooms.set(id, {
      id,
      name: roomName,
      isPrivate: !!isPrivate,
      owner: socket.id,
      members: new Map(),
    });
    joinRoom(socket, id);
    cb({ ok: true, room: roomInfo(rooms.get(id)) });
  });

  // 3. Join an existing room by id / code (multiple users can join)
  socket.on("room:join", (id, cb = () => {}) => {
    if (!socket.data.username) return cb({ ok: false, error: "Register first" });
    const roomId = clean(id, 10).toUpperCase() || LOBBY;
    const key = roomId === "LOBBY" ? LOBBY : roomId;
    const r = rooms.get(key);
    if (!r) return cb({ ok: false, error: "Room not found" });
    joinRoom(socket, key);
    cb({ ok: true, room: roomInfo(r) });
  });

  // 4. Leave a room
  socket.on("room:leave", (id, cb = () => {}) => {
    if (id === LOBBY) return cb({ ok: false, error: "Can't leave the lobby" });
    leaveRoom(socket, id);
    cb({ ok: true });
  });

  // 5. Send a message to a room (only members may send)
  socket.on("message", ({ room, text } = {}, cb = () => {}) => {
    const r = rooms.get(room);
    const body = clean(text, 1000);
    if (!r || !r.members.has(socket.id)) return cb({ ok: false, error: "Not in that room" });
    if (!body) return cb({ ok: false, error: "Empty message" });
    io.to(room).emit("message", {
      room,
      from: socket.data.username,
      fromId: socket.id,
      text: body,
      time: Date.now(),
    });
    cb({ ok: true });
  });

  // 6. Typing indicator
  socket.on("typing", ({ room, typing } = {}) => {
    const r = rooms.get(room);
    if (!r || !r.members.has(socket.id)) return;
    socket.to(room).emit("typing", { room, user: socket.data.username, typing: !!typing });
  });

  socket.on("disconnect", () => {
    count--;
    console.log("Active user: ", count);
    // ADDED: remove user from every room they were in
    for (const id of [...rooms.keys()]) leaveRoom(socket, id);
  });

  io.emit("announcement", "Today is last time we study web dev -3");
});

httpserver.listen(8080, () => {
  console.log("Server started");
});
