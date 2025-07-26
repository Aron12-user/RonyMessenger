import { useEffect, useState, useRef, useCallback } from 'react';

type MessageHandler = (data: any) => void;
type WebSocketStatus = 'connecting' | 'open' | 'closed' | 'error';

export default function useWebSocket() {
  const [status, setStatus] = useState<WebSocketStatus>('connecting');
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout>();
  const maxReconnectAttempts = 5;
  const reconnectAttempts = useRef(0);
  const userIdRef = useRef<number | null>(null);
  const messageBufferRef = useRef<any[]>([]);

  // Setup heartbeat to maintain connection
  const setupHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    
    heartbeatTimeoutRef.current = setTimeout(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'ping' }));
        setupHeartbeat(); // Schedule next heartbeat
      }
    }, 30000); // Heartbeat every 30 seconds
  }, []);

  const initializeWebSocket = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const port = window.location.port || (protocol === "wss:" ? "443" : "80");
    const wsUrl = `${protocol}//${window.location.hostname}:${port}/ws`;
    
    console.log("[WebSocket] Initializing connection to:", wsUrl);
    
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
        console.log("[WebSocket] Connection established");
        
        // Auto-identify user if we have userId
        if (userIdRef.current) {
          socket.send(JSON.stringify({ 
            type: 'identify', 
            userId: userIdRef.current 
          }));
          console.log("[WebSocket] Auto-identified user:", userIdRef.current);
        }
        
        // Send any buffered messages
        if (messageBufferRef.current.length > 0) {
          console.log("[WebSocket] Sending", messageBufferRef.current.length, "buffered messages");
          messageBufferRef.current.forEach(msg => {
            socket.send(JSON.stringify(msg));
          });
          messageBufferRef.current = [];
        }
        
        // Setup heartbeat
        setupHeartbeat();
      };
      
      socket.onclose = () => {
        setStatus('closed');
        console.log("[WebSocket] Connection closed, attempting reconnect...");
        
        // Clear heartbeat
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }
        
        reconnect();
      };
      
      socket.onerror = (error) => {
        setStatus('error');
        console.error("[WebSocket] Error:", error);
        
        // Clear heartbeat on error
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle pong response
          if (message.type === 'pong') {
            console.log("[WebSocket] Heartbeat pong received");
            return;
          }
          
          // Process message through handlers
          if (message && message.type && messageHandlersRef.current[message.type]) {
            console.log("[WebSocket] Processing message type:", message.type);
            messageHandlersRef.current[message.type](message.data);
          } else {
            console.warn("[WebSocket] No handler for message type:", message.type);
          }
        } catch (err) {
          console.error("[WebSocket] Error parsing message:", err);
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

  // Send message with buffering if disconnected
  const sendMessage = useCallback((message: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      console.log("[WebSocket] Message sent:", message.type);
    } else {
      console.log("[WebSocket] Connection not ready, buffering message:", message.type);
      messageBufferRef.current.push(message);
    }
  }, []);

  // Set user ID for identification
  const setUserId = useCallback((userId: number) => {
    userIdRef.current = userId;
    
    // If connected, identify immediately
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ 
        type: 'identify', 
        userId: userId 
      }));
      console.log("[WebSocket] User identified:", userId);
    }
  }, []);

  // Cleanup function
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  return {
    status,
    addMessageHandler,
    sendMessage,
    setUserId
  };
}
