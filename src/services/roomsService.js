const dataService = require("./mongodb");
const membersService = require("./membersService");
const socketService = require("./socketService");

async function createRoom(room, member) {
    const newRoom = await dataService.createDocument("rooms", room);
    await membersService.createMember({...member, roomId: newRoom.id, isAdmin: true, grantedBy: null, chatMember: true});
    return newRoom;
}

async function updateRoom(room) {  
    delete room.balance;  
    const updatedRoom = await dataService.updateDocument("rooms", room);
    socketService.sendMessage(room.id, {action: 'updateRoom', updatedRoom})
    return updatedRoom;
}



module.exports = {
    createRoom: createRoom,
    updateRoom: updateRoom,
};