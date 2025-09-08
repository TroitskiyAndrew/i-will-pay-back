const dataService = require("./mongodb");
const sharesService = require("./sharesService");
const socketService = require("./socketService");

async function createPayment(payment, shares) {
    const newPayment = await dataService.createDocument("payments", payment);
    if(shares){
        for (const share of shares){
            await sharesService.createShare(share, false)
        }
    }
    socketService.sendMessage(newPayment.roomId, {action: 'addPayment', newPayment})
    return newPayment;
}

async function updatePayment(payment, shares) {
    const updatedPayment = await dataService.updateDocument("payments", payment);
    if(shares){
        for (const share of shares){
            await sharesService.updateShare(share, updatedPayment.roomId)
        }        
    }
    socketService.sendMessage(updatedPayment.roomId, {action: 'updatePayment', updatedPayment})
    return updatedPayment;
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