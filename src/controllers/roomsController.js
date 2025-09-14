const dataService = require("../services/mongodb");
const roomsService = require("../services/roomsService");

const createRoom = async (req, res) => {
  try {
    const { user } = req.telegramData;
    const storedUser = await dataService.getDocumentByQuery("users", { telegramId: user.id });
    const newRoom = await roomsService.createRoom({ name: req.body.name }, { userId: storedUser.id, name: storedUser.name, payer: storedUser.id })
    res.status(200).send(newRoom);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

const updateRoom = async (req, res) => {
  try {
    await roomsService.updateRoom(req.body.room)
    res.status(200).send(true);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

const getRooms = async (req, res) => {
  try {
    const { user } = req.telegramData;
    const storedUser = await dataService.getDocumentByQuery("users", { telegramId: user.id });
    
    const rooms = await dataService.aggregate("members", [
      { $match: { userId: storedUser.id } },
      {
        $lookup: {
          from: "rooms",
          let: { rid: "$roomId" }, // строковый roomId из members
          pipeline: [
            {
              $match: {
                $expr: {
                  // сравниваем как строки: toString(_id) === toString(rid)
                  $eq: [ { $toString: "$_id" }, { $toString: "$$rid" } ]
                }
              }
            }
          ],
          as: "room"
        }
      },
      { $unwind: "$room" },
      { $replaceRoot: { newRoot: "$room" } }
    ])
    res.status(200).send(rooms);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

const getRoomState = async (req, res) => {
  try {
    const { user } = req.telegramData;
    const storedUser = await dataService.getDocumentByQuery("users", {telegramId: user.id})
    const roomId = req.params.roomId
    const payments = await dataService.getDocuments("payments", {roomId});
    const shares = await dataService.getDocuments("shares", {roomId});
    const userBalances = new Map();
    const paymentsMap = new Map();
    payments.forEach(payment => {
      const payerBalance = userBalances.get(payment.payer) || 0
      userBalances.set(payment.payer, payerBalance + payment.amount);
      paymentsMap.set(payment.id, {amount: payment.amount, currentUserPayment: payment.payer === storedUser.id, shared: payment.shared, unchecked: false})
    })
    shares.forEach(share => {
      const payerBalance = userBalances.get(share.payer) || 0
      userBalances.set(share.payer, payerBalance - share.balance);
      const payment = paymentsMap.get(share.paymentId);
      if(!payment.unchecked){
        if((payment.currentUserPayment && !share.confirmedByPayer) || ([share.payer, share.userId].includes(storedUser.id)  && !share.confirmedByUser)){
          payment.unchecked = true;
        }
      }
      paymentsMap.set(share.paymentId, payment);
    });
    const {owners, debtors} = [...userBalances.entries()].reduce((res, user) => {
      const [id, balance] = user;
      if(balance > 0){
        res.owners.push({id, balance, toCover: balance})
      } else if(balance < 0){
        res.debtors.push({id, balance, toCover: -1 * balance})
      }
      return res;
    }, {owners : [], debtors: []});
    const result = [];
    owners.forEach(owner => {
      let i = 0;
      while (owner.toCover > 0 && i < debtors.length){
        const debtor = debtors[i];
        if(debtor.toCover <= owner.toCover){
          result.push({owner: owner.id, debtor: debtor.id, amount: debtor.toCover});
          owner.toCover -= debtor.toCover;
          debtor.toCover = 0;

        } else {
          result.push({owner: owner.id, debtor: debtor.id, amount: owner.toCover});
          debtor.toCover -= owner.toCover;
          owner.toCover = 0;
        }
        i++;
      }
    })
    const debts = result.filter(res => [res.owner, res.debtor].includes(storedUser.id));
    
    let hasUnsharedPayment = false;
    let unchecked = false;
    for (const payment of [...paymentsMap.values()]){
      if(hasUnsharedPayment && unchecked) {
        break;
      }
      if(!unchecked && payment.unchecked){
        unchecked = true;
      }
      if(payment.currentUserPayment && !hasUnsharedPayment && payment.amount !== payment.shared){
        hasUnsharedPayment = true;
      }
    }
    res.status(200).send({debts, hasUnsharedPayment, unchecked});
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

module.exports = {
  createRoom: createRoom,
  updateRoom: updateRoom,
  getRooms: getRooms,
  getRoomState: getRoomState,
};
