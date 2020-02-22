import * as Yup from 'yup';

import Recipient from '../models/Recipient';

class RecipientsController {
  async list(req, res) {
    const recipients = await Recipient.findAll();
    return res.json(recipients);
  }

  async store(req, res) {
    const recipientSchema = Yup.object().shape({
      name: Yup.string()
        .min(3, 'Name is to short (Min. 3 chars).')
        .required('Name field is required.'),
      address: Yup.string()
        .min(4, 'Address field is too short.')
        .required('Address field is required.'),
      street_number: Yup.string().required(
        'Street number field cannot be blank.'
      ),
      complement: Yup.string(),
      city: Yup.string().required('City field is required.'),
      state: Yup.string().required('State field is required'),
      postal_code: Yup.string().required('Postal code field is required.'),
    });

    await recipientSchema.validate(req.body).catch(err => {
      return res.status(400).json({ errors: err.errors });
    });

    const recipient = await Recipient.create(req.body);

    return res.json(recipient);
  }

  async update(req, res) {
    const recipientSchema = Yup.object().shape({
      name: Yup.string().min(3, 'Name is to short (Min. 3 chars).'),
      address: Yup.string().min(4, 'Address field is too short.'),
      street_number: Yup.string(),
      complement: Yup.string(),
      city: Yup.string(),
      state: Yup.string(),
      postal_code: Yup.string(),
    });

    await recipientSchema.validate(req.body).catch(err => {
      return res.status(400).json({ errors: err.errors });
    });

    const { id } = req.params;
    const recipient = await Recipient.findByPk(id);

    if (!recipient) {
      return res.status(400).json({ errors: ['Recipient not found.'] });
    }

    await recipient.update(req.body);

    return res.json(recipient);
  }
}

export default new RecipientsController();
