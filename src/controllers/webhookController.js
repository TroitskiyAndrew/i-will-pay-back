const dataService = require("../services/mongodb");
const sharesService = require("../services/sharesService");
const roomsService = require("../services/roomsService");
const membersService = require("../services/membersService");
const config = require("../config/config");
const axios = require("axios");
const { ObjectId } = require("mongodb");
const { sendMessage } = require("../services/messageService");

const handleWebhook = async (req, res) => {
  try {
    const update = req.body;

    if (update._sendMessage) {
      res.json({ ok: true });
      console.log(req.body)
      sendMessage(req.body.chat_id, req.body.text, req.body.reply_markup)
      return;
    }

    if (update.callback_query) {
      const cq = update.callback_query;
      const data = cq.data;
      const chat_id = cq.message.chat.id;
      const reply_markup = cq.message.reply_markup;
      const [action, value] = data.split('=');
      const user = await dataService.getDocumentByQuery("users", { telegramId: cq.from.id });
      let responseText = 'Спасибо'
      if (action === 'acceptShareByPayer') {
        const share = await dataService.getDocument("shares", value);
        if (!share.confirmedByPayer) {
          share.confirmedByPayer = true;
          await sharesService.updateShare(share, user.id);
        }
        reply_markup.inline_keyboard[1] = [reply_markup.inline_keyboard[1][0]]
        await axios.post(`${config.tgApiUrl}/editMessageText`, {
          chat_id,
          message_id: cq.message.message_id,
          text: cq.message.text,
          reply_markup,
        });
        responseText = 'Сумма подтверждена'
      }
      if (action === 'acceptShareByUser') {
        const share = await dataService.getDocument("shares", value);
        if (!share.confirmedByUser) {
          share.confirmedByUser = true;
          await sharesService.updateShare(share, user.id);
        }
        reply_markup.inline_keyboard[1] = [reply_markup.inline_keyboard[1][0]]
        await axios.post(`${config.tgApiUrl}/editMessageText`, {
          chat_id,
          message_id: cq.message.message_id,
          text: cq.message.text,
          reply_markup,
        });
        responseText = 'Сумма подтверждена'
      }
      if (action === 'muteMember') {
        const member = await dataService.getDocument("members", value);
        if (!member.mute) {
          await membersService.updateMembers({ _id: new ObjectId(value) }, { $set: { mute: true } })
        };

        reply_markup.inline_keyboard[0][0] = {
          text: 'Включить уведомления',
          callback_data: `unmuteMember=${member.id}`
        }
        await axios.post(`${config.tgApiUrl}/editMessageText`, {
          chat_id,
          message_id: cq.message.message_id,
          text: cq.message.text,
          reply_markup,
        });
        responseText = 'Уведомления отключены'
      }
      if (action === 'unmuteMember') {
        const member = await dataService.getDocument("members", value);
        if (member.mute) {
          await membersService.updateMembers({ _id: new ObjectId(value) }, { $set: { mute: false } })
        }
        reply_markup.inline_keyboard[0][0] = {
          text: 'Отключить уведомления',
          callback_data: `muteMember=${member.id}`
        }
        await axios.post(`${config.tgApiUrl}/editMessageText`, {
          chat_id,
          message_id: cq.message.message_id,
          text: cq.message.text,
          reply_markup,
        });
        responseText = 'Уведомления включены'
      }

      await axios.post(`${config.tgApiUrl}/answerCallbackQuery`, {
        callback_query_id: cq.id,
        text: responseText
      });


    }
    const message = update.message
    if (message && message.text === "/start") {
      await fetch(`${config.tgApiUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: message.chat.id,
          text: "Добро пожаловать!",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Открыть приложение",
                  web_app: { url: "https://i-will-pay-front.vercel.app" }
                }
              ]
            ]
          }
        })
      });

    }
    console.log(update)
    if (message && message.new_chat_member && message.new_chat_member.id === 8420107013) {
      const chat = message.chat;
      if (chat.type.endsWith("group")) {
        let userFinal = null;
        userFinal = await dataService.getDocumentByQuery("users", { telegramId: message.from.id });
        if (!userFinal) {
          userFinal = await dataService.createDocument("users", { telegramId: message.from.id, name: message.from.username || message.from.first_name })
        }
        let room = await dataService.getDocumentByQuery("rooms", { chatId: chat.id })
        if (!room) {
          room = await roomsService.createRoom({ chatId: chat.id, name: chat.title }, { userId: userFinal.id, name: userFinal.name, payer: userFinal.id })
        } else {
          const member = await dataService.getDocumentByQuery("members", { userId: userFinal.id, roomId: room.id });
          if (!member) {
            await membersService.createMember({
              userId: userFinal.id,
              roomId: room.id,
              name: userFinal.name,
              isAdmin: false,
              grantedBy: null,
              isGuest: false,
              payer: userFinal.id
            })
          } else if (member.isGuest) {
            await dataService.updateDocument("members", { ...member, isGuest: false })
          }
        }
        await fetch(`${config.tgApiUrl}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chat.id,
            text: `Создана группа\n${room.name}`,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Присоединиться к группе",
                    url: `https://t.me/I_WillPay_bot?startapp=roomId=${room.id}`
                  },
                  {
                    text: "Создать платеж",
                    url: `https://t.me/I_WillPay_bot?startapp=roomId=${room.id}${config.splitParams}paymentId=newPaymentId`
                  }
                ]
              ]
            }
          })
        });
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

module.exports = {
  handleWebhook: handleWebhook,
};
