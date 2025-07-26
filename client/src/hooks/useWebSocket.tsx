import { useEffect, useState, useRef, useCallback } from 'react';

type MessageHandler = (data: any) => void;
type WebSocketStatus = 'connecting' | 'open' | 'closed' | 'error';

export default function useWebSocket() {
  const [status, setStatus] = useState<WebSocketStatus>('connecting');
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const maxReconnectAttempts = 5;
  const reconnectAttempts = useRef(0);

  const initializeWebSocket = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const port = window.location.port || (protocol === "wss:" ? "443" : "80");
    const wsUrl = `${protocol}//${window.location.hostname}:${port}/ws`;
    
    console.log("Attempting WebSocket connection to:", wsUrl);
    
    try {
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      setStatus('connecting');
    
      socket.onopen = () => {
        setStatus('open');
        reconnectAttempts.current = 0; // Reset attempts on successful connection
        console.log("WebSocket connection established");
      };
      
      socket.onclose = () => {
        setStatus('closed');
        console.log("WebSocket connection closed, attempting reconnect...");
        reconnect();
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
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setStatus('error');
      reconnect();
    }
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      setStatus('error');
      return;
    }
    
    reconnectAttempts.current += 1;
    const delay = 2000 * Math.pow(2, reconnectAttempts.current);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      initializeWebSocket();
    }, delay);
  }, [initializeWebSocket]);
  const messageHandlersRef = useRef<Record<string, MessageHandler>>({});

  // Initialize WebSocket connection
  useEffect(() => {
    initializeWebSocket();
    
    // Clean up function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [initializeWebSocket]);

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
