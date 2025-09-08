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
      {
        $match: { userId: storedUser.id } // фильтруем участников
      },
      {
        $lookup: {
          from: "rooms",          // имя коллекции с комнатами
          localField: "roomId",   // поле в members
          foreignField: "id",     // поле в rooms
          as: "room"              // куда положить найденные комнаты
        }
      },
      {
        $unwind: "$room" // развернуть массив, чтобы был один объект
      },
      {
        $replaceRoot: { newRoot: "$room" } // вернуть только сами объекты комнат
      }
    ])
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
