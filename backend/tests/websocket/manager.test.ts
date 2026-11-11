import { describe, it, expect, vi } from 'vitest'
import { createWsManager } from '../../src/websocket/manager'

describe('createWsManager', () => {
  it('broadcast does not throw when no clients are connected', () => {
    const { broadcast } = createWsManager()
    expect(() => broadcast('trade:created', {})).not.toThrow()
  })

  it('broadcast sends JSON message to all open clients', () => {
    const { addClient, broadcast } = createWsManager()
    const mockWs = { readyState: 1, send: vi.fn() } as unknown as WebSocket
    addClient(mockWs)
    broadcast('trade:created', { id: 'TRD-100001' })
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'trade:created', payload: { id: 'TRD-100001' } })
    )
  })

  it('broadcast skips clients that are not in OPEN state', () => {
    const { addClient, broadcast } = createWsManager()
    const closedWs = { readyState: 3, send: vi.fn() } as unknown as WebSocket
    addClient(closedWs)
    broadcast('trade:created', {})
    expect(closedWs.send).not.toHaveBeenCalled()
  })

  it('removeClient stops the client from receiving broadcasts', () => {
    const { addClient, removeClient, broadcast } = createWsManager()
    const mockWs = { readyState: 1, send: vi.fn() } as unknown as WebSocket
    addClient(mockWs)
    removeClient(mockWs)
    broadcast('trade:created', {})
    expect(mockWs.send).not.toHaveBeenCalled()
  })
})
