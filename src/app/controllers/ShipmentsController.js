import * as Yup from 'yup';
import {
  isBefore,
  isAfter,
  setHours,
  setMinutes,
  setSeconds,
  parseISO,
  startOfDay,
  endOfDay,
} from 'date-fns';
// import pt from 'date-fns/locale/pt';

import { Op } from 'sequelize';
// import { format, zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

import Deliveries from '../models/Delivery';
import Recipients from '../models/Recipient';
import Deliverymen from '../models/Deliveryman';
import File from '../models/File';

import Mail from '../../lib/Mail';

class ShipmentsController {
  async index(req, res) {
    // const whereStatement = { canceled_at: null };
    const whereStatement = {};

    if (req.params.id) whereStatement.id = req.params.id;

    const orders = await Deliveries.findAll({
      where: whereStatement,
    });

    return res.json(orders);
  }

  async store(req, res) {
    const deliverySchema = Yup.object().shape({
      recipient_id: Yup.string().required(),
      deliveryman_id: Yup.string().required(),
      product: Yup.string().required(),
      // start_date: Yup.date().required(),
    });

    await deliverySchema.validate(req.body).catch(err => {
      return res.status(400).json({ error: err.errors });
    });

    const { deliveryman_id, recipient_id } = req.body;
    /**
     * Checks for recipient and if it's already in another delivery
     */
    const recipient = await Recipients.findByPk(recipient_id);
    if (!recipient) {
      return res.status(404).json({ error: `Recipient not found` });
    }

    /**
     * Checks for deliveryman and if he exceeds maximum deliveries
     */
    const deliveryman = await Deliverymen.findByPk(deliveryman_id);
    if (!deliveryman) {
      return res.status(404).json({ error: `Deliveryman not found` });
    }

    const delivery = await Deliveries.create(req.body);
    const deliveryInfo = await Deliveries.findByPk(delivery.id, {
      attributes: ['id', 'start_date', 'product', 'canceled_at'],
      include: [
        {
          model: Recipients,
          as: 'recipient',
          attributes: { exclude: ['id', 'createdAt', 'updatedAt'] },
        },
        {
          model: Deliverymen,
          as: 'deliveryman',
          attributes: ['name', 'email'],
          include: [{ model: File, as: 'avatar', attributes: ['path'] }],
        },
      ],
    });

    /**
     * Notifies deliveryman he has a new shipment to deliver
     */
    Mail.sendMail({
      to: `${deliveryman.name} <${deliveryman.email}>`,
      subject: `Olá ${deliveryman.name}, você tem uma nova entrega!`,
      text: 'Você tem uma nova entrega a ser realizada.',
    });

    return res.json(deliveryInfo);
  }

  async update(req, res) {
    const { id } = req.params;

    const deliverySchema = Yup.object().shape({
      product: Yup.string(),
      start_date: Yup.date(),
      end_date: Yup.date(),
      recipient_id: Yup.number(),
      deliveryman_id: Yup.number(),
      signature_id: Yup.number(),
    });

    await deliverySchema.validate(req.body).catch(err => {
      return res.status(400).json({ error: err.errors });
    });

    const delivery = await Deliveries.findByPk(id);
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const { start_date, end_date, deliveryman_id } = req.body;

    /**
     * Checks for start_date and validate it to the current date
     */
    if (start_date) {
      const startingDate = parseISO(start_date);
      const { OFFICE_HOUR_START } = process.env;
      const [ofshour, ofsminute] = OFFICE_HOUR_START.split(':');
      const officeOpening = setSeconds(
        setMinutes(setHours(startingDate, ofshour), ofsminute),
        0
      );

      const { OFFICE_HOUR_END } = process.env;
      const [ofehour, ofeminute] = OFFICE_HOUR_END.split(':');
      const officeEnds = setSeconds(
        setMinutes(setHours(startingDate, ofehour), ofeminute),
        0
      );
      if (
        isBefore(startingDate, officeOpening) ||
        isAfter(startingDate, officeEnds)
      ) {
        return res.status(400).json({
          error: `New orders are allowed from ${OFFICE_HOUR_START}:00 to ${OFFICE_HOUR_END}:00`,
        });
      }

      delivery.start_date = startingDate;
      // delivery.save();
    }

    /**
     * Checks if end_date is after start_date
     */
    if (end_date) {
      // const startdate = parsedelivery.start_date;
      const requestedEndDate = parseISO(end_date);
      if (isBefore(requestedEndDate, delivery.start_date)) {
        return res.status(400).json({
          error: 'Cannot set ending date before start date',
        });
      }

      delivery.end_date = requestedEndDate;
      // delivery.save();
      // return res.json({ message: `Delivery ending date updated.` });
    }

    /**
     * Checks for deliveryman and its availability
     */
    if (deliveryman_id && deliveryman_id !== delivery.deliveryman_id) {
      const deliveryman = await Deliverymen.findByPk(deliveryman_id);
      if (!deliveryman) {
        return res
          .status(404)
          .json({ error: `Requested deliveryman not found` });
      }

      const deliveriesOfDay = await Deliveries.findAndCountAll({
        where: {
          deliveryman_id,
          canceled_at: null,
          start_date: {
            [Op.between]: [
              startOfDay(Number(delivery.start_date)),
              endOfDay(Number(delivery.start_date)),
            ],
          },
        },
      });

      const maximumDeliveries = process.env.MAX_DELIVERIES_DAY;
      if (deliveriesOfDay.count >= maximumDeliveries) {
        return res
          .status(400)
          .json(
            `The requested deliveryman ${deliveryman.name} has reached the limit of ${maximumDeliveries} deliveries per day`
          );
      }
      delivery.deliveryman_id = deliveryman_id;

      /**
       * Notifies deliveryman he has a new shipment to deliver
       */
      Mail.sendMail({
        to: `${deliveryman.name} <${deliveryman.email}>`,
        subject: `Hello ${deliveryman.name}, You've got a new delivery!`,
        text: `You've got a new delivery to be made.`,
      });
    }

    delivery.update(req.body);

    return res.json(delivery);
  }

  async delete(req, res) {
    const { id } = req.params;

    if (!id) return res.status(400).json({ error: 'Delivery id not received' });

    const delivery = await Deliveries.findByPk(id);
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    delivery.canceled_at = new Date();
    delivery.save();
    return res.status(200).json();
  }
}

export default new ShipmentsController();
