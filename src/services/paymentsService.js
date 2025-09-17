const dataService = require("./mongodb");
const sharesService = require("./sharesService");
const socketService = require("./socketService");

async function createPayment(payment, shares, userId) {
    const newPayment = await dataService.createDocument("payments", payment);
    await handleShares(shares, newPayment, userId, false);
    socketService.sendMessage(newPayment.roomId, {action: 'addPayment', payment: newPayment})
    return newPayment;
}

async function updatePayment(payment, shares, userId) {
    const updatedPayment = await dataService.updateDocument("payments", payment);
    await handleShares(shares,updatedPayment, userId );
    socketService.sendMessage(updatedPayment.roomId, {action: 'updatePayment', payment: updatedPayment})
    return updatedPayment;
}

async function handleShares(shares, payment, userId, notify = true) {
    for (const share of shares){
        share.paymentId = payment.id;
        share.roomId = payment.roomId;
        share.paymentPayer = payment.payer;
        const isEmpty = share.share === null && share.amount === null;
        if(share.id){
            if(isEmpty){
                await sharesService.deleteShare(share.id)
            } else {
                await sharesService.updateShare(share, userId)
            }
        } else if(!isEmpty){
            await sharesService.createShare(share, payment, notify)
        }
        
    }
}

async function deletePayment(id) {
    const payment = await dataService.getDocument("payments", id);
    await dataService.deleteDocumentsByQuery("shares", {paymentId: id});
    await dataService.deleteDocument("payments", id);
    socketService.sendMessage(payment.roomId, {action: 'deletePayment', id})
    return true;
}



module.exports = {
    createPayment: createPayment,
    updatePayment: updatePayment,
    deletePayment: deletePayment,
};