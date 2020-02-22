import * as Yup from 'yup';

import Deliveryman from '../models/Deliveryman';

class DeliverymanController {
  async index(req, res) {
    const deliverymen = await Deliveryman.findAll();
    return res.json(deliverymen);
  }

  async store(req, res) {
    const DeliverymanSchema = Yup.object().shape({
      name: Yup.string()
        .min(2)
        .required(),
      email: Yup.string()
        .email()
        .required(),
    });

    await DeliverymanSchema.validate(req.body).catch(err => {
      return res.status(400).json({ errors: err.errors });
    });

    const deliveryman = await Deliveryman.create(req.body);

    return res.json(deliveryman);
  }

  async update(req, res) {
    const DeliverymanSchema = Yup.object().shape({
      name: Yup.string().min(2),
      email: Yup.string().email(),
      avatar_id: Yup.number(),
    });

    await DeliverymanSchema.validate(req.body).catch(err => {
      return res.status(400).json({ error: err.errors });
    });

    const deliveryman = await Deliveryman.findByPk(req.params.id);
    if (!deliveryman) {
      return res.status(404).json({ error: 'Deliveryman not found.' });
    }

    await deliveryman.update(req.body);

    return res.json(deliveryman);
  }

  async delete(req, res) {
    const deliveryman = await Deliveryman.findByPk(req.params.id);

    if (!deliveryman) {
      return res.status(404).json({ erro: 'Deliveryman not found.' });
    }
    deliveryman.destroy();

    return res.status(200).json();
  }
}

export default new DeliverymanController();
