import * as Yup from 'yup';
import {
  isBefore,
  isAfter,
  setHours,
  setMinutes,
  setSeconds,
  startOfHour,
  parseISO,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { Op } from 'sequelize';
// import { format, zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

import Deliveries from '../models/Delivery';
import Recipients from '../models/Recipient';
import Deliverymen from '../models/Deliveryman';
import File from '../models/File';

class DeliveriesController {
  async index(req, res) {
    const whereStatement = { canceled_at: null };

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
      start_date: Yup.date().required(),
    });

    await deliverySchema.validate(req.body).catch(err => {
      return res.status(400).json({ error: err.errors });
    });

    const { deliveryman_id, recipient_id, start_date } = req.body;
    const today = new Date();
    const requestedDate = parseISO(start_date);
    /**
     * Check for past dates
     */
    const hourStart = startOfHour(requestedDate);
    if (isBefore(hourStart, today)) {
      return res.status(400).json({ error: 'Past dates are not permitted.' });
    }

    const { OFFICE_HOUR_START } = process.env;
    const [ofshour, ofsminute] = OFFICE_HOUR_START.split(':');
    const officeOpening = setSeconds(
      setMinutes(setHours(requestedDate, ofshour), ofsminute),
      0
    );

    const { OFFICE_HOUR_END } = process.env;
    const [ofehour, ofeminute] = OFFICE_HOUR_END.split(':');
    const officeEnds = setSeconds(
      setMinutes(setHours(requestedDate, ofehour), ofeminute),
      0
    );
    if (
      isBefore(requestedDate, officeOpening) ||
      isAfter(requestedDate, officeEnds)
    ) {
      return res.status(400).json({
        error: `New orders are allowed from ${OFFICE_HOUR_START}:00 to ${OFFICE_HOUR_END}:00`,
      });
    }

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

    const deliveriesOfDay = await Deliveries.findAndCountAll({
      where: {
        deliveryman_id,
        canceled_at: null,
        start_date: {
          [Op.between]: [
            startOfDay(Number(requestedDate)),
            endOfDay(Number(requestedDate)),
          ],
        },
      },
    });

    const maximumDeliveries = process.env.MAX_DELIVERIES_DAY;
    if (deliveriesOfDay.count >= maximumDeliveries) {
      return res
        .status(400)
        .json(
          `Deliveryman ${deliveryman.name} has reached the limit of deliveries ${maximumDeliveries} of the day`
        );
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
          include: [{ model: File, as: 'avatar' }],
        },
      ],
    });

    return res.json(deliveryInfo);
  }

  async update(req, res) {
    const { id } = req.params;

    if (!id) return res.status(400).json({ error: 'Delivery id not received' });

    const deliverySchema = Yup.object().shape({
      product: Yup.string(),
      start_date: Yup.date(),
      end_date: Yup.date(),
      recipient_id: Yup.string(),
      deliveryman_id: Yup.string(),
      signature_id: Yup.string(),
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
      const requestedDate = parseISO(start_date);
      const today = new Date();
      /**
       * Check for past dates
       */
      const hourStart = startOfHour(requestedDate);
      if (isBefore(hourStart, today)) {
        return res.status(400).json({ error: 'Past dates are not permitted.' });
      }

      const { OFFICE_HOUR_START } = process.env;
      const [ofshour, ofsminute] = OFFICE_HOUR_START.split(':');
      const officeOpening = setSeconds(
        setMinutes(setHours(requestedDate, ofshour), ofsminute),
        0
      );

      const { OFFICE_HOUR_END } = process.env;
      const [ofehour, ofeminute] = OFFICE_HOUR_END.split(':');
      const officeEnds = setSeconds(
        setMinutes(setHours(requestedDate, ofehour), ofeminute),
        0
      );
      if (
        isBefore(requestedDate, officeOpening) ||
        isAfter(requestedDate, officeEnds)
      ) {
        return res.status(400).json({
          error: `New orders are allowed from ${OFFICE_HOUR_START}:00 to ${OFFICE_HOUR_END}:00`,
        });
      }

      delivery.start_date = requestedDate;
      delivery.save();
    }

    /**
     * Checks if end_date is after start_date
     */
    if (end_date) {
      // const startdate = parsedelivery.start_date;
      const requestedEndDate = parseISO(end_date);
      if (isBefore(requestedEndDate, delivery.start_date)) {
        return res.status(400).json({
          error: 'Cannot set end date before start date',
        });
      }
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
            `The requested deliveryman ${deliveryman.name} has reached the limit of ${maximumDeliveries} deliveries of the day`
          );
      }
    }

    delivery.update(req.body);

    return res.json(delivery);
  }

  async delete(req, res) {
    return res.json();
  }
}

export default new DeliveriesController();
