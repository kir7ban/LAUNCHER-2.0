/**
 * Tests for orchestrator client.
 * 
 * Run with: npm test
 * Or: npx vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen({ type: 'open' });
    }, 10);
  }

  send(data) {
    this._lastSent = data;
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code: 1000, reason: 'Normal closure' });
  }

  // Test helper to simulate message
  _receiveMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  // Test helper to simulate error
  _triggerError(error) {
    if (this.onerror) this.onerror(error);
  }
}

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;
global.WebSocket = MockWebSocket;

describe('OrchestratorClient', () => {
  let OrchestratorClient;
  let client;

  beforeEach(async () => {
    vi.resetModules();
    mockFetch.mockReset();
    
    // Dynamic import to pick up mocks
    const module = await import('../orchestratorClient.js');
    OrchestratorClient = module.OrchestratorClient;
    client = new OrchestratorClient('test-client');
  });

  afterEach(() => {
    if (client && client.ws) {
      client.disconnect();
    }
  });

  describe('constructor', () => {
    it('should create client with default ID', async () => {
      const module = await import('../orchestratorClient.js');
      const autoClient = new module.OrchestratorClient();
      
      expect(autoClient.clientId).toMatch(/^client-\d+$/);
    });

    it('should create client with custom ID', () => {
      expect(client.clientId).toBe('test-client');
    });

    it('should not be connected initially', () => {
      expect(client.connected).toBe(false);
    });
  });

  describe('connect', () => {
    it('should connect via WebSocket', async () => {
      await client.connect();
      
      expect(client.connected).toBe(true);
    });

    it('should create WebSocket with correct URL', async () => {
      await client.connect();
      
      expect(client.ws.url).toContain('/ws/test-client');
    });

    it('should reset reconnect attempts on success', async () => {
      client.reconnectAttempts = 3;
      await client.connect();
      
      expect(client.reconnectAttempts).toBe(0);
    });
  });

  describe('disconnect', () => {
    it('should close WebSocket', async () => {
      await client.connect();
      client.disconnect();
      
      expect(client.connected).toBe(false);
      expect(client.ws).toBe(null);
    });

    it('should handle disconnect when not connected', () => {
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe('sendQuery', () => {
    it('should send query via WebSocket', async () => {
      await client.connect();
      const queryId = client.sendQuery('Test question');
      
      expect(queryId).toMatch(/^q-\d+$/);
      expect(client.ws._lastSent).toBeDefined();
      
      const sent = JSON.parse(client.ws._lastSent);
      expect(sent.question).toBe('Test question');
    });

    it('should use custom query ID when provided', async () => {
      await client.connect();
      const queryId = client.sendQuery('Test', 'custom-id');
      
      expect(queryId).toBe('custom-id');
    });

    it('should return false when not connected', () => {
      const result = client.sendQuery('Test');
      
      expect(result).toBe(false);
    });
  });

  describe('event listeners', () => {
    it('should register event listener', () => {
      const callback = vi.fn();
      client.on('answer', callback);
      
      expect(client.listeners.has('answer')).toBe(true);
    });

    it('should call listener on matching event', async () => {
      const callback = vi.fn();
      client.on('answer', callback);
      
      await client.connect();
      client.ws._receiveMessage({ type: 'answer', answer: 'Test answer' });
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'answer', answer: 'Test answer' })
      );
    });

    it('should call catch-all listener', async () => {
      const callback = vi.fn();
      client.on('*', callback);
      
      await client.connect();
      client.ws._receiveMessage({ type: 'think', reasoning: 'Thinking...' });
      
      expect(callback).toHaveBeenCalled();
    });

    it('should remove listener with off()', async () => {
      const callback = vi.fn();
      client.on('answer', callback);
      client.off('answer', callback);
      
      await client.connect();
      client.ws._receiveMessage({ type: 'answer' });
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('message handling', () => {
    it('should parse JSON messages', async () => {
      const callback = vi.fn();
      client.on('status', callback);
      
      await client.connect();
      client.ws._receiveMessage({ type: 'status', message: 'Starting...' });
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Starting...' })
      );
    });

    it('should handle invalid JSON gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await client.connect();
      
      // Simulate invalid JSON
      client.ws.onmessage({ data: 'not valid json' });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

describe('api', () => {
  let api;

  beforeEach(async () => {
    mockFetch.mockReset();
    const module = await import('../orchestratorClient.js');
    api = module.api;
  });

  describe('getAgents', () => {
    it('should fetch agents list', async () => {
      const mockAgents = [{ id: 'agent-1', name: 'Agent 1' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgents),
      });

      const result = await api.getAgents();

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/agents'));
      expect(result).toEqual(mockAgents);
    });

    it('should throw on error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(api.getAgents()).rejects.toThrow('Failed to fetch agents');
    });
  });

  describe('getAgent', () => {
    it('should fetch specific agent', async () => {
      const mockAgent = { id: 'agent-1', name: 'Agent 1' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgent),
      });

      const result = await api.getAgent('agent-1');

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/agents/agent-1'));
      expect(result).toEqual(mockAgent);
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const mockHealth = { status: 'ok', agents_connected: 3 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHealth),
      });

      const result = await api.healthCheck();

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/health'));
      expect(result.status).toBe('ok');
    });
  });

  describe('query', () => {
    it('should post query and return result', async () => {
      const mockResult = { answer: 'Test answer', confidence: 0.9 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResult),
      });

      const result = await api.query('What is testing?');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/query'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('What is testing?'),
        })
      );
      expect(result.answer).toBe('Test answer');
    });

    it('should include query ID when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await api.query('Test', 'custom-id');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.query_id).toBe('custom-id');
    });
  });
});

describe('EventType', () => {
  it('should have all event types', async () => {
    const { EventType } = await import('../orchestratorClient.js');

    expect(EventType.THINK).toBe('think');
    expect(EventType.ACT).toBe('act');
    expect(EventType.OBSERVE).toBe('observe');
    expect(EventType.DELEGATE).toBe('delegate');
    expect(EventType.STREAM).toBe('stream');
    expect(EventType.ANSWER).toBe('answer');
    expect(EventType.ERROR).toBe('error');
    expect(EventType.STATUS).toBe('status');
  });
});

describe('getClient', () => {
  it('should return singleton instance', async () => {
    const { getClient } = await import('../orchestratorClient.js');

    const client1 = getClient('test');
    const client2 = getClient('test');

    expect(client1).toBe(client2);
  });
});

describe('Edge Cases', () => {
  let client;

  beforeEach(async () => {
    const module = await import('../orchestratorClient.js');
    client = new module.OrchestratorClient('edge-test');
  });

  afterEach(() => {
    if (client) client.disconnect();
  });

  it('should handle empty event data', async () => {
    const callback = vi.fn();
    client.on('*', callback);

    await client.connect();
    client.ws._receiveMessage({});

    expect(callback).toHaveBeenCalled();
  });

  it('should handle Unicode in messages', async () => {
    const callback = vi.fn();
    client.on('answer', callback);

    await client.connect();
    client.ws._receiveMessage({
      type: 'answer',
      answer: '日本語のテスト 🧪',
    });

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ answer: '日本語のテスト 🧪' })
    );
  });

  it('should handle very long messages', async () => {
    const callback = vi.fn();
    client.on('answer', callback);

    const longAnswer = 'x'.repeat(100000);
    await client.connect();
    client.ws._receiveMessage({
      type: 'answer',
      answer: longAnswer,
    });

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ answer: longAnswer })
    );
  });

  it('should handle special characters', async () => {
    const callback = vi.fn();
    client.on('answer', callback);

    await client.connect();
    client.ws._receiveMessage({
      type: 'answer',
      answer: 'Test with "quotes" and <tags>',
    });

    expect(callback).toHaveBeenCalled();
  });
});
