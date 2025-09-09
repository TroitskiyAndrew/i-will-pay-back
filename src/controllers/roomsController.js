const dataService = require("../services/mongodb");

const createRoom = async (req, res) => {
  try {
    const { user } = req.telegramData;
    const storedUser = await dataService.getDocumentByQuery("users", { telegramId: user.id });
    const newRoom = await roomsService.createRoom({ name: req.body.name }, { userId: user.id, name: storedUser.name, payer: user.id })
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
    ]).toArray()
    await Promise.all(rooms.map(async (room) => {
      const payments = await dataService.getDocuments("payments", {roomId: room.id, payer: user.id});
      const shares = await dataService.getDocuments("shares", {roomId: room.id, payer: user.id});
      room.balance = payments.reduce((res, payment) => res+= payment.amount, 0 ) - shares.reduce((res, share) => res+= share.balance, 0 )
    }))
    res.status(200).send(rooms);
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
};
