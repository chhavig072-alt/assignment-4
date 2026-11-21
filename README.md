# Gyan Chat – Socket.IO chat app with personal rooms

## Run
```
npm install
node server.js
```
Open http://localhost:8080 in two or more browser tabs.

## What was added (original code kept intact)
- `server.js`: original events (`gyankibaat`, `join`, `kuchbhi`, `announcement`) untouched; added static hosting of `public/` and chat/room events.
- `public/index.html`: full frontend (login, lobby, rooms, members, typing indicator, unread badges, dark mode, responsive).
- `client.html`: original placeholder client, unchanged.

## Socket events added
| Event (client -> server) | Purpose |
|---|---|
| `register` (name, ack) | Choose a unique username, auto-join the Lobby |
| `room:create` ({name, isPrivate}, ack) | Create a personal room (private = hidden, join by code) |
| `room:join` (code, ack) | Join a room; any number of users can join |
| `room:leave` (id, ack) | Leave a room (empty personal rooms are deleted) |
| `message` ({room, text}, ack) | Send to a room (members only) |
| `typing` ({room, typing}) | Typing indicator |

Server -> client: `message`, `room:members`, `room:list`, `typing`.
