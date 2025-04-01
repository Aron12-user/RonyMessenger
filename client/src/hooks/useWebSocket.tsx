import { useEffect, useState, useRef, useCallback } from 'react';

type MessageHandler = (data: any) => void;
type WebSocketStatus = 'connecting' | 'open' | 'closed' | 'error';

export default function useWebSocket() {
  const [status, setStatus] = useState<WebSocketStatus>('connecting');
  const socketRef = useRef<WebSocket | null>(null);
  const messageHandlersRef = useRef<Record<string, MessageHandler>>({});

  // Initialize WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;
    
    socket.onopen = () => {
      setStatus('open');
      console.log("WebSocket connection established");
    };
    
    socket.onclose = () => {
      setStatus('closed');
      console.log("WebSocket connection closed");
    };
    
    socket.onerror = (error) => {
      setStatus('error');
      console.error("WebSocket error:", error);
    };
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message && message.type && messageHandlersRef.current[message.type]) {
          messageHandlersRef.current[message.type](message.data);
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };
    
    // Clean up function
    return () => {
      socket.close();
    };
  }, []);

  // Register message handler
  const addMessageHandler = useCallback((type: string, handler: MessageHandler) => {
    messageHandlersRef.current[type] = handler;
    
    // Return function to remove handler
    return () => {
      delete messageHandlersRef.current[type];
    };
  }, []);

  // Send message through WebSocket
  const sendMessage = useCallback((type: string, data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, data }));
      return true;
    }
    return false;
  }, []);

  return {
    status,
    addMessageHandler,
    sendMessage
  };
}
