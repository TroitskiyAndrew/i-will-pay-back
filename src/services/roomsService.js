const dataService = require("./mongodb");
const membersService = require("./membersService");
const socketService = require("./socketService");

async function createRoom(room, member) {
    const newRoom = await dataService.createDocument("rooms", room);
    await membersService.createMember({...member, roomId: newRoom.id, isAdmin: true, grantedBy: null, isGuest: false});
    return newRoom;
}

async function updateRoom(room) {  
    delete room.balance;  
    const updatedRoom = await dataService.updateDocument("rooms", room);
    socketService.sendMessage(room.id, {action: 'updateRoom', room: updatedRoom})
    return updatedRoom;
}



module.exports = {
    createRoom: createRoom,
    updateRoom: updateRoom,
};