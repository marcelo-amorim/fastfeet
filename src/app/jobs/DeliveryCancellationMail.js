import Mail from '../../lib/Mail';

class DeliveryCancellationMail {
  get key() {
    return 'DeliveryCancellationMail';
  }

  async handle({ data }) {
    const { delivery } = data;
    await Mail.sendMail({
      to: `${delivery.deliveryman.name} <${delivery.deliveryman.email}>`,
      subject: `Entrega cancelada!`,
      text: `Hello ${delivery.deliveryman.name}, the deliver #${delivery.id} was cancelled due to: ${problem.description}`,
    });
  }
}

export default new DeliveryCancellationMail();
