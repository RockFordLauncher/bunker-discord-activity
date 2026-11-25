/**
 * rooms.js — thin helper layer on top of BunkerGame
 * Keeps track of socket-to-room mapping and exposes
 * convenience methods for the socket.io event handlers.
 */

export class RoomManager {
  constructor(game) {
    this.game = game;
    // socketId → roomCode  (quick reverse lookup)
    this.socketRooms = new Map();
  }

  /** Create a new room, register the host socket. */
  createRoom(socketId, packId = 'base', testMode = false) {
    const { roomCode } = this.game.createRoom(socketId, packId, testMode);
    this.socketRooms.set(socketId, roomCode);
    return roomCode;
  }

  /** Join an existing room. */
  joinRoom(socketId, roomCode, username) {
    const state = this.game.joinRoom(roomCode, socketId, username);
    this.socketRooms.set(socketId, roomCode);
    return state;
  }

  /** Called on socket disconnect / explicit leave. Returns the updated room (or null if deleted). */
  removeSocket(socketId) {
    const roomCode = this.socketRooms.get(socketId);
    if (!roomCode) return null;

    this.socketRooms.delete(socketId);
    return this.game.leaveRoom(roomCode, socketId);
  }

  /** Get the room code for a given socket. */
  getRoomCode(socketId) {
    return this.socketRooms.get(socketId) ?? null;
  }

  /** Get room state from the perspective of a socket. */
  getRoomState(socketId) {
    const roomCode = this.getRoomCode(socketId);
    if (!roomCode) return null;
    return this.game.getRoomState(roomCode, socketId);
  }

  /** Check if a socket is the host of its room. */
  isHost(socketId) {
    const roomCode = this.getRoomCode(socketId);
    if (!roomCode) return false;
    try {
      const state = this.game.getRoomState(roomCode, socketId);
      return state.hostId === socketId;
    } catch {
      return false;
    }
  }

  /** Return stats about all active rooms. */
  stats() {
    return {
      rooms: this.game.rooms.size,
      connectedSockets: this.socketRooms.size,
    };
  }
}
