const dataService = require("./mongodb");
const socketService = require("./socketService");
const messageService = require("./messageService");
const config = require("../config/config");

async function createShare(share, payment, notify = true) {
    const newShare = await dataService.createDocument("shares", share);
    if (notify) {
        socketService.sendMessage(payment.roomId, { action: 'addShare', share: newShare })
    }
    if (!payment.debt) {
        await senMessageAboutNewShare(newShare.userId, payment, newShare);
        if (newShare.payer !== newShare.userId){
            await senMessageAboutNewShare(newShare.payer, payment, newShare);
        }
    }
    return newShare;
}

async function senMessageAboutNewShare(userId, payment, newShare) {
    const user = await dataService.getDocument('users', userId);
    const memberPayer = await dataService.getDocumentByQuery('members', { userId: payment.payer, roomId: payment.roomId });
    const member = await dataService.getDocumentByQuery('members', { userId, roomId: payment.roomId });
    if (user.telegramId && !member.mute && user.id !== payment.payer) {
        let text = `${memberPayer.name} заплатил ${payment.amount}${payment.comment ? '/' + payment.comment : ''}`
        if (newShare.balance > 0) {
            text += `\nЗа ${member.userId === newShare.userId ? 'меня' : member.name} - ${newShare.balance}`;
        } else {
            text += `\nУкажите, сколько за ${member.userId === newShare.userId ? 'вас' : member.name}`
        }
        const reply_markup = { inline_keyboard: [[
            {
                text: 'Отключить уведомления',
                callback_data: `muteMember=${member.id}`
            }
        ], []] };
        const url = `https://t.me/I_WillPay_bot?startapp=roomId=${payment.roomId}${config.splitParams}paymentId=${payment.id}`
        if (newShare.balance > 0) {
            reply_markup.inline_keyboard[1].push({
                text: 'Посмотреть платеж',
                url,
            })
            reply_markup.inline_keyboard[1].push({
                text: 'Подтвердить сумму',
                callback_data: `acceptShareByUser=${newShare.id}`
            })
        } else {
            reply_markup.inline_keyboard[1].push({
                text: 'Открыть платеж',
                url,
            })
        }
        await messageService.sendMessage(user.telegramId, text, reply_markup)
    }

}


async function updateShare(share, currentUserId) {
    const storedShare = await dataService.getDocument("shares", share.id);
    const payment = await dataService.getDocument("payments", share.paymentId);
    const updated = await dataService.updateDocument("shares", share);
    if (share.balance !== storedShare.balance) {
        if (share.paymentPayer === currentUserId) {
            share.confirmedByPayer = true;
        } else {
            if(storedShare.confirmedByPayer === true){
                await senMessageAboutUpdateShare(share.paymentPayer, payment, updated)
            }
            share.confirmedByPayer = false;
        }
        if ([share.payer, share.userId].includes(currentUserId)) {
            share.confirmedByUser = true;
        } else {
            if(storedShare.confirmedByUser === true){
                if(share.userId !== share.paymentPayer){
                    await senMessageAboutUpdateShare(share.userId, payment, updated);
                }
                if(share.userId !== share.payer && share.payer !== share.paymentPayer){
                    await senMessageAboutUpdateShare(share.payer, payment, updated);
                }
            }
            share.confirmedByUser = false
        }
    }
    
    socketService.sendMessage(share.roomId, { action: 'updateShare', share: updated })
    return updated
}

async function senMessageAboutUpdateShare(userId, payment, share) {
    const user = await dataService.getDocument('users', userId);
    const shareMember = await dataService.getDocumentByQuery('members', { userId: share.userId, roomId: payment.roomId });
    const userMember = await dataService.getDocumentByQuery('members', { userId, roomId: payment.roomId }); 
    if (user.telegramId && !userMember.mute) {
        let text = `${payment.amount}${payment.comment ? '/' + payment.comment : ''} от ${payment.date}`;
        if(userId === payment.payer){
            text = 'В моем платеже ' + text;
            text += `\n${shareMember.userId === userId ? 'моя доля' : 'доля ' + shareMember.name} составляет ${share.balance}`
        } else {
            const paymentMember = await dataService.getDocumentByQuery('members', { userId: payment.payer, roomId: payment.roomId }); 
            text = `В платеже ${paymentMember.name} ` + text;
            text += `\n${shareMember.userId === userId ? 'моя доля' : 'доля ' + shareMember.name} составляет ${share.balance}`
        }
        
        const reply_markup = { inline_keyboard: [[
            {
                text: 'Отключить уведомления',
                callback_data: `muteMember=${userMember.id}`
            }
        ], []] };
        const url = `https://t.me/I_WillPay_bot?startapp=roomId=${payment.roomId}${config.splitParams}paymentId=${payment.id}`
        reply_markup.inline_keyboard[1].push({
            text: 'Посмотреть платеж',
            url,
        })
        if (userId === payment.payer) {
            reply_markup.inline_keyboard[1].push({
                text: 'Подтвердить сумму',
                callback_data: `acceptShareByPayer=${share.id}`
            })
        } else {
            reply_markup.inline_keyboard[1].push({
                text: 'Подтвердить сумму',
                callback_data: `acceptShareByUser=${share.id}`
            })
        }
        await messageService.sendMessage(user.telegramId, text, reply_markup)
    }

}

async function deleteShare(id) {
    const storedShare = await dataService.getDocument("shares", id);
    await dataService.deleteDocument("shares", id);
    socketService.sendMessage(storedShare.roomId, { action: 'deleteShare', id, paymentId: storedShare.paymentId })
    return true;
}

module.exports = {
    createShare: createShare,
    updateShare: updateShare,
    deleteShare: deleteShare,
};