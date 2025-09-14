const dataService = require("../services/mongodb");
const paymentsService = require("../services/paymentsService");

const createPayment = async (req, res) => {
  try {
    const { user } = req.telegramData;
    const { payment, shares } = req.body;
    const storedUser = await dataService.getDocumentByQuery("users", { telegramId: user.id });
    await paymentsService.createPayment(payment, shares || [], storedUser.id);
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
    const { payment, shares } = req.body;
    const storedPayment = await dataService.getDocument("payments", payment.id);
    const storedUser = await dataService.getDocumentByQuery("users", { telegramId: user.id });
    if (payment.amount !== storedPayment.amount && storedPayment.payer !== storedUser.id) {
      throw new Error('Нельзя редактировать чужие платежи')
    }
    await paymentsService.updatePayment(payment, shares || [], storedUser.id);
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
    if (!storedPayment) {
      res.status(404).send('Платеж не найден');
      return;
    }
    const storedUser = await dataService.getDocumentByQuery("users", { telegramId: user.id });
    if (storedPayment.payer !== storedUser.id) {
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

const getPayments = async (req, res) => {
  try {
    const { user } = req.telegramData;
    const storedUser = await dataService.getDocumentByQuery("users", { telegramId: user.id });
    const member = await dataService.getDocumentByQuery("members", { roomId: req.params.roomId, userId: storedUser.id });
    if (!member) {
      res.status(401).send('Вы не состоите в этой группе');
      return;
    }
    if(!member.isAdmin) {
      const payments = await dataService.aggregate("payments", [
        {
          $lookup: {
            from: "shares",
            let: { pid: "$_id", uid: storedUser.id },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      // shares.paymentId (string) == toString(payments._id)
                      { $eq: ["$paymentId", { $toString: "$$pid" }] },
                      { $or: [
                        { $eq: ["$userId", "$$uid"] },
                        { $eq: ["$payerId", "$$uid"] },
                        { $eq: ["$paymentPayer", "$$uid"] }
                      ] }
                    ]
                  }
                }
              },
              { $limit: 1 }
            ],
            as: "sharesForUser"
          }
        },
        {
          $match: {
            $or: [
              { payer: storedUser.id },
              { $expr: { $gt: [ { $size: "$sharesForUser" }, 0 ] } }
            ]
          }
        },
        { $project: { sharesForUser: 0 } }
      ]);
      res.status(200).send(payments);
      return;
    } else {
      const payments = await dataService.getDocuments("payments", {roomId: req.params.roomId});
      res.status(200).send(payments);
      return;
      
    }
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
  getPayments: getPayments,
};
