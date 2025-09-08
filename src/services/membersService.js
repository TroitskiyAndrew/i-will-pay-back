const dataService = require("./mongodb");
const socketService = require("./socketService");


async function createMember(member) {
    const newMember = await dataService.createDocument("members",member);
    socketService.sendMessage(newMember.roomId, {action: 'addMember', newMember})
    return newMember;
}

async function updateMembers(query, update) {
    const updated = await dataService.updateDocuments("members", query, update );
    if(updated){
        updated.forEach(updatedMember => socketService.sendMessage(updatedMember.roomId, {action: 'updateMember', updatedMember}))
    }
    return updated;
}



module.exports = {
    createMember: createMember,
    updateMembers: updateMembers,
};