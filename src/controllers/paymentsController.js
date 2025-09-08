const dataService = require("../services/mongodb");
const paymentsService = require("../services/paymentsService");

const createPayment = async (req, res) => {
  try {
    const { user } = req.telegramData;
    const { payment, shares } = req.body;
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
    const { payment, shares } = req.body;
    const storedPayment = await dataService.getDocument("payments", payment.id);
    const storedUser = await dataService.getDocumentByQuery("users", { telegramId: user.id });
    if (storedPayment.payer !== storedUser.id) {
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
    const member = await dataService.getDocumentByQuery("members", { roomId: req.params.roomId, userId: user.id });
    if (!member) {
      res.status(401).send('Вы не состоите в этой группе');
      return;
    }
    if(member.chatMember) {
      const payments = await dataService.getDocuments("payments", {roomId: req.params.roomId});
      res.status(200).send(payments);
      return;
    } else {
      const payments = await dataService.aggregate("payments", [
        // Подтягиваем только те shares, которые относятся к этому платежу и пользователю
        {
          $lookup: {
            from: "shares",
            let: { pid: "$id", uid: userId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$paymentId", "$$pid"] },
                      { $or: [ { $eq: ["$userId", "$$uid"] }, { $eq: ["$payerId", "$$uid"] } ] }
                    ]
                  }
                }
              },
              { $limit: 1 } // достаточно знать, что есть хотя бы одна
            ],
            as: "sharesForUser"
          }
        },
      
        // Оставляем платеж, если payer = userId или есть хоть один share для этого пользователя
        {
          $match: {
            $or: [
              { payer: userId },
              { $expr: { $gt: [ { $size: "$sharesForUser" }, 0 ] } }
            ]
          }
        },
      
        // Убираем служебное поле из выдачи
        { $project: { sharesForUser: 0 } }
      ]);
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
