import * as Yup from 'yup';
import { Op } from 'sequelize';
import {
  startOfDay,
  endOfDay,
  setSeconds,
  setMinutes,
  setHours,
  parseISO,
  isBefore,
  isAfter,
  differenceInSeconds,
} from 'date-fns';

import Deliveries from '../models/Delivery';
import Deliveryman from '../models/Deliveryman';
import Recipients from '../models/Recipient';
import File from '../models/File';

class DeliveriesController {
  async index(req, res) {
    const { deliveryman_id } = req.params;

    const deliveryman = await Deliveryman.findByPk(deliveryman_id);
    if (!deliveryman) {
      return res.status(404).json({ error: `Deliveryman not found` });
    }

    const whereStatement = {
      deliveryman_id,
      canceled_at: null,
      end_date: null,
    };
    const { delivered } = req.query;
    if (typeof delivered !== 'undefined' && delivered) {
      whereStatement.end_date = { [Op.not]: null };
    }

    const deliveries = await Deliveries.findAll({
      where: whereStatement,
      attributes: ['product', 'start_date', 'end_date'],
      include: [
        {
          model: Recipients,
          as: 'recipient',
          attributes: { exclude: ['id', 'createdAt', 'updatedAt'] },
        },
        {
          model: Deliveryman,
          as: 'deliveryman',
          attributes: ['name', 'email'],
          include: [{ model: File, as: 'avatar', attributes: ['path'] }],
        },
        {
          model: File,
          as: 'signature',
          attributes: ['path'],
        },
      ],
    });

    return res.json(deliveries);
  }

  async update(req, res) {
    const deliverySchema = Yup.object().shape({
      start_date: Yup.date(),
      end_date: Yup.date(),
      signature_id: Yup.number(),
    });

    await deliverySchema.validate(req.body).catch(err => {
      return res.status(400).json({ error: err.errors });
    });

    const { delivery_id, deliveryman_id } = req.params;
    const { start_date, end_date, signature_id } = req.body;

    const delivery = await Deliveries.findOne({
      where: { id: delivery_id, deliveryman_id, canceled_at: null },
      include: [
        {
          model: Deliveryman,
          as: 'deliveryman',
          attributes: ['name', 'email'],
          include: [{ model: File, as: 'avatar', attributes: ['path'] }],
        },
      ],
    });
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    /**
     * Delivery START: Checks for start_date and validate it to the current date
     */
    if (start_date) {
      if (delivery.start_date)
        return res
          .status(400)
          .json({ error: `Delivery has already been started` });

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
          error: `New deliveries are allowed from ${OFFICE_HOUR_START} to ${OFFICE_HOUR_END}`,
        });
      }

      /**
       * Checks if deliveryman exceeded maximum of deliveries
       */
      const deliveriesOfDay = await Deliveries.findAndCountAll({
        where: {
          deliveryman_id,
          canceled_at: null,
          start_date: {
            [Op.between]: [
              startOfDay(Number(startingDate)),
              endOfDay(Number(startingDate)),
            ],
          },
        },
      });
      const maximumDeliveries = process.env.MAX_DELIVERIES_DAY;
      if (deliveriesOfDay.count >= maximumDeliveries) {
        return res
          .status(400)
          .json(
            `Deliveryman ${delivery.deliveryman.name} has reached the limit of ${maximumDeliveries} deliveries per the day`
          );
      }

      /**
       * Checks for tolerance in start date
       */
      const today = new Date();
      const toleranceInSeconds = 60;
      const difference = differenceInSeconds(today, startingDate);
      if (Math.abs(difference) > toleranceInSeconds) {
        return res.status(400).json({
          err: `Past dates are not permitted`,
          difference,
        });
      }

      delivery.start_date = startingDate;
      delivery.save();

      return res.json({ message: `Delivery started successfully` });
    }

    /**
     * Delivery END: checks for signature and its date
     */
    if (end_date) {
      if (delivery.end_date) {
        return res
          .status(400)
          .json({ error: `Delivery has already been done` });
      }
      /**
       * Checks if delivery has already started
       */
      const endingDate = parseISO(end_date);
      if (!isBefore(delivery.start_date, endingDate)) {
        return res
          .status(400)
          .json({ error: `Ending date cannot be earlier than starting date` });
      }

      const signature = await File.findByPk(signature_id);
      if (!signature) {
        return res
          .status(400)
          .json({ error: `No signature was found to finish the delivery` });
      }

      delivery.end_date = endingDate;
      delivery.signature_id = signature.id;
      delivery.save();

      return res.json({ message: `Delivery done!` });
    }

    return res
      .status(500)
      .json({ error: `Could not start or finish delivery` });
  }
}

export default new DeliveriesController();
