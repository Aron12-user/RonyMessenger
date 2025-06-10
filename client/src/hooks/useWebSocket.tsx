import { useEffect, useState, useRef, useCallback } from 'react';

type MessageHandler = (data: any) => void;
type WebSocketStatus = 'connecting' | 'open' | 'closed' | 'error';

export default function useWebSocket() {
  const [status, setStatus] = useState<WebSocketStatus>('connecting');
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const maxReconnectAttempts = 5;
  const reconnectAttempts = useRef(0);

  const reconnect = useCallback(() => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }
    
    reconnectAttempts.current += 1;
    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('Attempting to reconnect...');
      initializeWebSocket();
    }, 2000 * Math.pow(2, reconnectAttempts.current));
  }, []);
  const messageHandlersRef = useRef<Record<string, MessageHandler>>({});

  // Initialize WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const port = window.location.port || (protocol === "wss:" ? "443" : "80");
    const wsUrl = `${protocol}//${window.location.hostname}:${port}/ws`;
    
    console.log("Trying to connect to WebSocket at:", wsUrl);
    
    try {
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
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setStatus('error');
      return () => {};
    }
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
