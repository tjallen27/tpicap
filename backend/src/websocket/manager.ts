export interface WsManager {
  addClient(ws: WebSocket): void
  removeClient(ws: WebSocket): void
  broadcast(event: string, payload: unknown): void
}

export function createWsManager(): WsManager {
  const clients = new Set<WebSocket>()

  return {
    addClient(ws) {
      clients.add(ws)
    },
    removeClient(ws) {
      clients.delete(ws)
    },
    broadcast(event, payload) {
      const message = JSON.stringify({ event, payload })
      for (const ws of clients) {
        if (ws.readyState === 1) {
          ws.send(message)
        }
      }
    },
  }
}

export const wsManager = createWsManager()
