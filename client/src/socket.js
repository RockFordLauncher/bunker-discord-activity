import { io } from "socket.io-client";

// In production / deployed environment, connect to the same host that serves the frontend
const SERVER_URL = import.meta.env.VITE_SERVER_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3001");

export const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

