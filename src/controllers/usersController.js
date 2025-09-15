const dataService = require("../services/mongodb");
const { ObjectId } = require("mongodb");
const membersService = require("../services/membersService");
const sharesService = require("../services/sharesService");
const roomsService = require("../services/roomsService");
const socketService = require("../services/socketService");

const createUser = async (req, res) => {
  try {
    const { name, roomId } = req.body;
    const newUser = await dataService.createDocument("users", { name })
    await membersService.createMember({ userId: newUser.id, roomId, name, isAdmin: false, grantedBy: null, isGuest: true });
    res.status(200).send(true);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

const updateUser = async (req, res) => {
  try {
    const { user } = req.body;
    const { user: tgUser } = req.telegramData;
    const storedUser = await dataService.getDocumentByQuery("users", { telegramId: tgUser.id });
    if(user.id !== storedUser.id){
      res.status(401).send('Нельзя менять других юзеров');
      return;
    }
    const updatedUser = await dataService.updateDocument("users", user);
    socketService.sendMessage(updatedUser.id, {action: 'updateUser', user: updatedUser})
    res.status(200).send(true);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

const auth = async (req, res) => {
  try {
    const { user, chat, startParam } = req.telegramData;
    let userFinal = null;
    userFinal = await dataService.getDocumentByQuery("users", { telegramId: user.id });
    if (userFinal && startParam?.userId && userFinal.id !== startParam.userId) {
      const guest = await dataService.getDocumentByQuery("users", { _id: new ObjectId(startParam.userId), telegramId: { $exists: false } });
      if (guest) {
        await membersService.updateMembers({ userId: guest.id }, { $set: { userId: userFinal.id } });
        await sharesService.updateDocument({ userId: guest.id }, { $set: { userId: userFinal.id } });
        await dataService.deleteDocument("users", guest.id);
      }
    }
    if (!userFinal && startParam?.userId) {
      userFinal = await dataService.getDocumentByQuery("users", { _id: new ObjectId(startParam.userId) });
      if (userFinal) {
        userFinal.telegramId = user.id
        await dataService.updateDocument("users", userFinal)
      }
    }
    if (!userFinal) {
      userFinal = await dataService.createDocument("users", { telegramId: user.id, name: user.username || user.first_name })
    }
    let roomId = null;
    if (chat) {
      let room = await dataService.getDocumentByQuery("rooms", { chatId: chat.id })
      if (!room) {
        room = await roomsService.createRoom({ chatId: chat.id, name: chat.title }, { userId: userFinal.id, name: userFinal.name, payer: userFinal.id })
      } else {
        const member = await dataService.getDocumentByQuery("members", { userId: userFinal.id, roomId: room.id });
        if (!member) {
          await membersService.createMember({
            userId: userFinal.id,
            roomId: room.id,
            name: userFinal.name,
            isAdmin: false,
            grantedBy: null,
            isGuest: false,
            payer: userFinal.id
          })
        } else if(member.isGuest) {
          await dataService.updateDocument("members", {...member, isGuest: false})
        }
      }
      roomId = room?.id || null
    }
    res.status(200).send({ user: userFinal, roomId });
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

module.exports = {
  updateUser: updateUser,
  createUser: createUser,
  auth: auth,
};
