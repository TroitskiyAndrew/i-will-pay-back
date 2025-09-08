const dataService = require("../services/mongodb");
const paymentsService = require("../services/paymentsService");

const createPayment = async (req, res) => {
  try {
    const { user } = req.telegramData;
    const {payment, shares}  = req.body;
    payment.payer = user.id;
    await paymentsService.createPayment(payment, shares || []);
    res.status(200).send(true);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

const updatePayment = async (req, res) => {
  try {
    const { user } = req.telegramData;
    const {payment, shares}  = req.body;
    const storedPayment = await dataService.getDocument("payments", payment.id);
    const storedUser = await dataService.getDocumentByQuery("users", { telegramId: user.id });
    if(storedPayment.payer !== storedUser.id) {
      throw new Error('Нельзя редактировать чужие платежи')
    }
    payment.payer = user.id;
    await paymentsService.updatePayment(payment, shares || []);
    res.status(200).send(true);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

const deletePayment = async (req, res) => {
  try {
    const { user } = req.telegramData;
    const storedPayment = await dataService.getDocument("payments", req.params.paymentId);
    if(!storedPayment) {
      res.status(404).send('Платеж не найден');
      return;
    }
    const storedUser = await dataService.getDocumentByQuery("users", { telegramId: user.id });
    if(storedPayment.payer !== storedUser.id) {
      throw new Error('Нельзя удалять чужие платежи')
    }
    await paymentsService.deletePayment(req.params.paymentId);
    res.status(200).send(true);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};


module.exports = {
  createPayment: createPayment,
  updatePayment: updatePayment,
  deletePayment: deletePayment,
};
