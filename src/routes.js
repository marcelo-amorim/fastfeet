import Router from 'express';
import multer from 'multer';
import multerConfig from './config/multer';

import SessionController from './app/controllers/SessionController';
import RecipientsController from './app/controllers/RecipientsController';
import FileController from './app/controllers/FileController';
import DeliverymanController from './app/controllers/DeliverymanController';
import ShipmentsController from './app/controllers/ShipmentsController';
import DeliveriesController from './app/controllers/DeliveriesController';

import authMiddleware from './app/middlewares/auth';

const routes = new Router();
const upload = multer(multerConfig);

/**
 * auth
 */
routes.post('/sessions', SessionController.store);

/**
 * public routes from deliverymen
 */
routes.get(
  '/deliveryman/:deliveryman_id/deliveries',
  DeliveriesController.index
);

routes.put(
  '/deliveryman/:deliveryman_id/deliveries/:delivery_id',
  DeliveriesController.update
);

routes.use(authMiddleware);

/**
 * ADMIN only routes
 */
routes.get('/recipients', RecipientsController.list);
routes.post('/recipients', RecipientsController.store);
routes.put('/recipients/:id', RecipientsController.update);

routes.get('/deliveryman', DeliverymanController.index);
routes.post('/deliveryman', DeliverymanController.store);
routes.put('/deliveryman/:id', DeliverymanController.update);
routes.delete('/deliveryman/:id', DeliverymanController.delete);

/**
 * Deliveries for admin
 */
routes.get('/shipments/:id?', ShipmentsController.index);
routes.post('/shipments', ShipmentsController.store);
routes.put('/shipments/:id', ShipmentsController.update);
routes.delete('/shipments/:id', ShipmentsController.delete);

routes.post('/files', upload.single('file'), FileController.store);

export default routes;
