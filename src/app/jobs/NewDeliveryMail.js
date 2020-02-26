import Mail from '../../lib/Mail';

class NewDeliveryMail {
  get key() {
    return 'NewDeliveryMail';
  }

  handle({ data }) {
    const { deliveryman } = data;
    Mail.sendMail({
      to: `${deliveryman.name} <${deliveryman.email}>`,
      subject: `Olá ${deliveryman.name}, você tem uma nova entrega!`,
      text: 'Você tem uma nova entrega a ser realizada.',
    });
  }
}

export default new NewDeliveryMail();
