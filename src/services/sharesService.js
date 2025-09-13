const dataService = require("./mongodb");
const socketService = require("./socketService");

async function createShare(share, notify = true) {
    const newShare = await dataService.createDocument("shares",share);
    if(notify){
        const payment = await dataService.getDocument("payments", share.paymentId);
        socketService.sendMessage(payment.roomId, {action: 'addShare', share: newShare})
    }
    return newShare;
}


async function updateShare(share, userId) {
    const storedShare = await dataService.getDocument("shares", share.id);
    if(share.balance !== storedShare) {
        if (share.paymentPayer === userId){
            share.confirmedByPayer = true; 
        } else {
            share.confirmedByPayer = false; 
        }
        if([share.payer, share.userId].includes(userId)) {
            share.confirmedByUser = true;
        } else {
            share.confirmedByUser = false
        }
    }
    const updated = await dataService.updateDocument("shares",share );
    socketService.sendMessage(share.roomId, {action: 'updateShare', share: updated})
    return updated
}

async function deleteShare(id) {
    const storedShare = await dataService.getDocument("shares", id);
    await dataService.deleteDocument("shares", id);
    socketService.sendMessage(storedShare.roomId, {action: 'deleteShare', id, paymentId: storedShare.paymentId})
    return true;
}

module.exports = {
    createShare: createShare,
    updateShare: updateShare,
    deleteShare: deleteShare,
};