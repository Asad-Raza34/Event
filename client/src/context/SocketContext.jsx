import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { connectSocket, disconnectSocket, SOCKET_EVENTS } from '../lib/socket';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      disconnectSocket();
      setSocket(null);
      setConnected(false);
      setOnlineUsers([]);
      return undefined;
    }

    const instance = connectSocket();
    if (!instance) return undefined;

    setSocket(instance);
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handlePresenceList = ({ online }) => setOnlineUsers(online || []);
    const handlePresenceUpdate = ({ userId, online }) =>
      setOnlineUsers((current) => (online ? [...new Set([...current, String(userId)])] : current.filter((id) => id !== String(userId))));

    instance.on('connect', handleConnect);
    instance.on('disconnect', handleDisconnect);
    instance.on(SOCKET_EVENTS.PRESENCE_LIST, handlePresenceList);
    instance.on(SOCKET_EVENTS.PRESENCE_UPDATE, handlePresenceUpdate);
    setConnected(instance.connected);

    return () => {
      instance.off('connect', handleConnect);
      instance.off('disconnect', handleDisconnect);
      instance.off(SOCKET_EVENTS.PRESENCE_LIST, handlePresenceList);
      instance.off(SOCKET_EVENTS.PRESENCE_UPDATE, handlePresenceUpdate);
    };
  }, [isAuthenticated, user]);

  const value = useMemo(
    () => ({
      socket,
      connected,
      onlineUsers,
      isOnline: (userId) => onlineUsers.includes(String(userId)),
      subscribe: (event, handler) => {
        if (!socket) return () => {};
        socket.on(event, handler);
        return () => socket.off(event, handler);
      },
      emit: (event, payload) => socket?.emit(event, payload),
    }),
    [socket, connected, onlineUsers],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used inside <SocketProvider>');
  return context;
};

export default SocketContext;
