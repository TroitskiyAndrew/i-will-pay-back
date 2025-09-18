const dataService = require("../services/mongodb");
const sharesService = require("../services/sharesService");
const membersService = require("../services/membersService");
const config = require("../config/config");
const axios = require("axios");
const { ObjectId } = require("mongodb");

const handleWebhook = async (req, res) => {
  try {
    const update = req.body;
    console.log(update)
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
    if (update.message && update.message.text === "/start") {
      await fetch(`${config.tgApiUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: update.message.chat.id,
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
