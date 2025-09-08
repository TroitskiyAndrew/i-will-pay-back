const dataService = require("./mongodb");
const socketService = require("./socketService");

async function createShare(share, notify = true) {
    const newShare = await dataService.createDocument("shares",share);
    if(notify){
        const payment = await dataService.getDocument("payments", share.paymentId);
        socketService.sendMessage(payment.roomId, {action: 'addShare', newShare})
    }
    return newShare;
}


async function updateShare(share, roomId) {
    const updated = await dataService.updateDocument("shares",share );
    socketService.sendMessage(roomId, {action: 'updateShare', updated})
    return updated
}

async function deleteShare(id) {
    const storedShare = await dataService.getDocument("shares", id);
    const payment = await dataService.getDocument("payments", storedShare.paymentId);
    await dataService.deleteDocument("shares", id);
    socketService.sendMessage(payment.roomId, {action: 'deleteShare', id})
    return true;
}

module.exports = {
    createShare: createShare,
    updateShare: updateShare,
    deleteShare: deleteShare,
};