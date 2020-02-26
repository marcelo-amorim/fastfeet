import * as Yup from 'yup';

import Delivery from '../models/Delivery';
import DeliveryProblems from '../models/DeliveryProblem';
import Deliveryman from '../models/Deliveryman';
import Recipient from '../models/Recipient';
import File from '../models/File';

import Mail from '../../lib/Mail';

class DeliveryProblemsController {
  async index(req, res) {
    const { delivery_id } = req.params;
    const statements = {
      where: delivery_id ? { delivery_id } : {},
      attributes: ['id', 'description'],
      include: [
        {
          model: Delivery,
          as: 'delivery',
          attributes: ['product', 'start_date', 'end_date'],
          include: [
            {
              model: Recipient,
              as: 'recipient',
              attributes: { exclude: ['id', 'createdAt', 'updatedAt'] },
            },
            {
              model: Deliveryman,
              as: 'deliveryman',
              attributes: ['name', 'email'],
              include: [{ model: File, as: 'avatar', attributes: ['path'] }],
            },
          ],
        },
      ],
    };
    const problems = await DeliveryProblems.findAll(statements);
    return res.json(problems);
  }

  async update(req, res) {
    const { delivery_id } = req.params;
    const { description: problemDescription } = req.body;

    const problemSchema = Yup.object().shape({
      description: Yup.string()
        .min('10')
        .required(),
    });

    await problemSchema.validate(req.body).catch(err => {
      return res.status(400).json({ error: err.errors });
    });

    const delivery = await Delivery.findByPk(delivery_id);
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found.' });
    }

    const { id, description } = await DeliveryProblems.create({
      delivery_id,
      description: problemDescription,
    });

    return res.json({
      id,
      description,
    });
  }

  async delete(req, res) {
    const { problem_id } = req.params;

    const problem = await DeliveryProblems.findByPk(problem_id);
    if (!problem) {
      return res.status(404).json({ error: `Problem not found` });
    }

    // return res.json(problem);

    const delivery = await Delivery.findByPk(problem.delivery_id, {
      include: {
        model: Deliveryman,
        as: 'deliveryman',
        attributes: ['name', 'email'],
      },
    });

    if (!delivery) {
      return res
        .status(404)
        .json({ error: `Delivery was not found to cancel.` });
    }

    delivery.canceled_at = new Date();
    delivery.save();

    /**
     * Notifies deliveryman he has a new shipment to deliver
     */
    Mail.sendMail({
      to: `${delivery.deliveryman.name} <${delivery.deliveryman.email}>`,
      subject: `Entrega cancelada!`,
      text: `Hello ${delivery.deliveryman.name}, the deliver #${delivery.id} was cancelled because of: ${problem.description}`,
    });

    return res.status(200).json();
  }
}

export default new DeliveryProblemsController();
