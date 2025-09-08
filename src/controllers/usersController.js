const dataService = require("../services/mongodb");
const { ObjectId } = require("mongodb");
const membersService = require("../services/membersService");
const sharesService = require("../services/sharesService");
const roomsService = require("../services/roomsService");

const createUser = async (req, res) => {
  try {
    const { name, roomId } = req.body;
    const newUser = await dataService.createDocument("users", { name })
    await membersService.createMember({ userId: newUser.id, roomId, name, isAdmin: false, grantedBy: null, chatMember: false });
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
    if (userFinal && startParam && userFinal.id !== startParam) {
      const guest = await dataService.getDocumentByQuery("users", { _id: new ObjectId(startParam), telegramId: { $exists: false } });
      if (guest) {
        await membersService.updateMembers({ userId: guest.id }, { $set: { userId: userFinal.id } });
        await sharesService.updateDocument({ userId: guest.id }, { $set: { userId: userFinal.id } });
        await dataService.deleteDocument("users", guest.id);
      }
    }
    if (!userFinal && startParam) {
      userFinal = await dataService.getDocumentByQuery("users", { _id: new ObjectId(startParam) });
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
        room = await roomsService.createRoom({ chatId: chat.id, name: chat.title }, { userId: user.id, name: userFinal.name, payer: user.id })
      } else {
        const member = await dataService.getDocumentByQuery("members", { userId: userFinal.id, roomId: room.id });
        if (!member) {
          await membersService.createMember({
            userId: userFinal.id,
            roomId: room.id,
            name: userFinal.name,
            isAdmin: false,
            grantedBy: null,
            chatMember: true,
            payer: userFinal.id
          })
        } else if(!member.chatMember) {
          await dataService.updateDocument("members", {...member, chatMember: true})
        }
      }
      roomId = room?.id || null
    }
    res.status(200).send({ user, roomId });
    return;
  } catch (error) {
    res.status(500).send(error);
    return;
  }
};

module.exports = {
  createUser: createUser,
  auth: auth,
};
