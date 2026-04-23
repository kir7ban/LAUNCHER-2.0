/**
 * Orchestrator API client for connecting to the backend.
 * 
 * Provides:
 * - WebSocket connection for real-time streaming
 * - REST fallback for sync operations
 * - Event handling with callbacks
 */

// Backend URL configuration
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
const WS_URL = BACKEND_URL.replace(/^http/, 'ws');

/**
 * Event types from the orchestrator
 */
export const EventType = {
  THINK: 'think',
  ACT: 'act',
  OBSERVE: 'observe',
  DELEGATE: 'delegate',
  STREAM: 'stream',
  ANSWER: 'answer',
  ERROR: 'error',
  STATUS: 'status',
  CLARIFY: 'clarify',
};

/**
 * WebSocket-based orchestrator client for real-time events
 */
export class OrchestratorClient {
  constructor(clientId) {
    this.clientId = clientId || `client-${Date.now()}`;
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnects = 3;
    this.connected = false;
  }

  /**
   * Connect to the orchestrator WebSocket
   */
  connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = `${WS_URL}/ws/${this.clientId}`;
      console.log('[Orchestrator] Connecting to:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Orchestrator] Connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onclose = (event) => {
        console.log('[Orchestrator] Disconnected:', event.code, event.reason);
        this.connected = false;
        this._handleDisconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[Orchestrator] WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        this._handleMessage(event.data);
      };
    });
  }

  /**
   * Disconnect from the orchestrator
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  /**
   * Send a query to the orchestrator
   */
  sendQuery(question, queryId = null) {
    if (!this.connected || !this.ws) {
      console.error('[Orchestrator] Not connected, cannot send query');
      return false;
    }

    const message = {
      question,
      query_id: queryId || `q-${Date.now()}`,
    };

    this.ws.send(JSON.stringify(message));
    return message.query_id;
  }

  /**
   * Send clarification answers back to the orchestrator.
   */
  sendClarifyResponse(queryId, answers) {
    if (!this.connected || !this.ws) {
      console.error('[Orchestrator] Not connected, cannot send clarify_response');
      return false;
    }
    this.ws.send(JSON.stringify({
      type: 'clarify_response',
      query_id: queryId,
      answers,
    }));
    return true;
  }

  /**
   * Register an event listener
   */
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  /**
   * Remove an event listener
   */
  off(eventType, callback) {
    if (this.listeners.has(eventType)) {
      const callbacks = this.listeners.get(eventType);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  _handleMessage(data) {
    try {
      const event = JSON.parse(data);
      console.log('[Orchestrator] Event:', event.type, event);

      // Notify listeners
      if (this.listeners.has(event.type)) {
        for (const callback of this.listeners.get(event.type)) {
          callback(event);
        }
      }

      // Also notify catch-all listeners
      if (this.listeners.has('*')) {
        for (const callback of this.listeners.get('*')) {
          callback(event);
        }
      }
    } catch (e) {
      console.error('[Orchestrator] Failed to parse message:', e);
    }
  }

  /**
   * Handle disconnection with auto-reconnect
   */
  _handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnects) {
      this.reconnectAttempts++;
      const delay = 1000 * Math.pow(2, this.reconnectAttempts);
      console.log(`[Orchestrator] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch((e) => {
          console.error('[Orchestrator] Reconnect failed:', e);
        });
      }, delay);
    } else {
      console.error('[Orchestrator] Max reconnect attempts reached');
    }
  }
}

/**
 * REST API client for synchronous operations
 */
export const api = {
  /**
   * Get all agents
   */
  async getAgents() {
    const response = await fetch(`${BACKEND_URL}/agents`);
    if (!response.ok) throw new Error(`Failed to fetch agents: ${response.statusText}`);
    return response.json();
  },

  /**
   * Get a specific agent
   */
  async getAgent(agentId) {
    const response = await fetch(`${BACKEND_URL}/agents/${agentId}`);
    if (!response.ok) throw new Error(`Failed to fetch agent: ${response.statusText}`);
    return response.json();
  },

  /**
   * Health check
   */
  async healthCheck() {
    const response = await fetch(`${BACKEND_URL}/health`);
    if (!response.ok) throw new Error(`Health check failed: ${response.statusText}`);
    return response.json();
  },

  /**
   * Execute query synchronously (no streaming)
   */
  async query(question, queryId = null) {
    const response = await fetch(`${BACKEND_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, query_id: queryId }),
    });
    if (!response.ok) throw new Error(`Query failed: ${response.statusText}`);
    return response.json();
  },

  /**
   * Stream query via SSE (alternative to WebSocket)
   */
  async *streamQuery(question, queryId = null) {
    const response = await fetch(`${BACKEND_URL}/query/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, query_id: queryId }),
    });

    if (!response.ok) throw new Error(`Stream query failed: ${response.statusText}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          yield JSON.parse(data);
        }
      }
    }
  },
};

// Singleton client instance
let clientInstance = null;

/**
 * Get or create the orchestrator client
 */
export function getClient(clientId = null) {
  if (!clientInstance) {
    clientInstance = new OrchestratorClient(clientId);
  }
  return clientInstance;
}

export default OrchestratorClient;
