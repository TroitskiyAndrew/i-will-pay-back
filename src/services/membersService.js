const { ObjectId } = require("mongodb");
const dataService = require("./mongodb");
const socketService = require("./socketService");


async function createMember(member) {
    const newMember = await dataService.createDocument("members",member);
    const room = await dataService.getDocumentByQuery("rooms", {_id: new ObjectId(newMember.roomId)})
    socketService.sendMessage(newMember.roomId, {action: 'addMember', member: newMember})
    socketService.sendMessage(newMember.userId, {action: 'addRoom', room})
    return newMember;
}

async function updateMembers(query, update) {
    const updated = await dataService.updateDocuments("members", query, update );
    if(updated){
        updated.forEach(updatedMember => socketService.sendMessage(updatedMember.roomId, {action: 'updateMember', member: updatedMember}))
    }
    return updated
}



module.exports = {
    createMember: createMember,
    updateMembers: updateMembers,
};