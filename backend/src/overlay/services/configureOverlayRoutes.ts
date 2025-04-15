import { Express } from 'express'
import overlayRoutes from '../../routes/overlayRoutes.js'

export default function configureOverlayRoutes (app: Express): void {
  app.use('/overlay', overlayRoutes)
}
