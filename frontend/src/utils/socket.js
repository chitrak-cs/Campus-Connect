import { io } from 'socket.io-client';

const apiUrl = import.meta.env.VITE_API_URL || '/api';
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || new URL(apiUrl, window.location.origin).origin;

let socket = null;

export const connectSocket = (token) => {
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
