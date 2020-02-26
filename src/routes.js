import Router from 'express';
import multer from 'multer';
import multerConfig from './config/multer';

import SessionController from './app/controllers/SessionController';
import RecipientsController from './app/controllers/RecipientsController';
import FileController from './app/controllers/FileController';
import DeliverymanController from './app/controllers/DeliverymanController';
import ShipmentsController from './app/controllers/ShipmentsController';
import DeliveriesController from './app/controllers/DeliveriesController';
import DeliveryProblemsController from './app/controllers/DeliveryProblemsController';

import authMiddleware from './app/middlewares/auth';

const routes = new Router();
const upload = multer(multerConfig);

/**
 * auth
 */
routes.post('/sessions', SessionController.store);

/**
 * public routes of deliveries for deliverymen
 */
routes.get(
  '/deliveryman/:deliveryman_id/deliveries',
  DeliveriesController.index
);
routes.put(
  '/deliveryman/:deliveryman_id/deliveries/:delivery_id',
  DeliveriesController.update
);

/**
 * public routes of deliveries for delivery problems
 */
routes.post(
  '/delivery/:delivery_id/problems',
  DeliveryProblemsController.update
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

/**
 * Delivery problems ADMIN ONLY
 */
routes.get('/delivery/problems', DeliveryProblemsController.index);
routes.get('/delivery/:delivery_id/problems', DeliveryProblemsController.index);
routes.delete(
  '/problem/:problem_id/cancel-delivery',
  DeliveryProblemsController.delete
);

routes.post('/files', upload.single('file'), FileController.store);

export default routes;
