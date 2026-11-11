import { FastifyInstance } from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import { wsManager } from './manager'

export async function registerWsPlugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifyWebsocket)

  app.get('/ws', { websocket: true }, (socket) => {
    wsManager.addClient(socket as unknown as WebSocket)
    socket.on('close', () => wsManager.removeClient(socket as unknown as WebSocket))
  })
}
