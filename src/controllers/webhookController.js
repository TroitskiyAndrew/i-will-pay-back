const dataService = require("../services/mongodb");
const sharesService = require("../services/sharesService");
const membersService = require("../services/membersService");
const config = require("../config/config");
const axios = require("axios");

const handleWebhook = async (req, res) => {
  try {
    const update = req.body;

    if (update.callback_query) {
      const cq = update.callback_query;
      const data = cq.data;
      console.log(cq.message.reply_markup)
      const chat_id = cq.message.chat.id;
      const [action, value] = data.split('=');
      const user = await dataService.getDocumentByQuery("users", { telegramId: cq.from.id });
      if (action === 'acceptShareByPayer') {
        const share = await dataService.getDocument("shares", value);
        if (!share.confirmedByPayer) {
          share.confirmedByPayer = true;
          await sharesService.updateShare(share, user.id)
        }
      }
      if (action === 'acceptShareByUser') {
        const share = await dataService.getDocument("shares", value);
        if (!share.confirmedByUser) {
          share.confirmedByUser = true;
          await sharesService.updateShare(share, user.id)
        }
      }
      if (action === 'muteMember') {
        const member = await dataService.getDocument("members", value);
        if (!member.mute) {
          member.mute = true;
          await membersService.updateMembers([member])
          const reply_markup = cq.message.reply_markup;
          reply_markup.inline_keyboard[0][0] = {
            text: 'Включить уведомления',
            callback_data: `unmuteMember=${member.id}`
          }
          await axios.post(`${config.tgApiUrl}/editMessageText`, {
            chat_id,
            message_id: cq.message.message_id,
            reply_markup,
          });
        };
      }
      if (action === 'unmuteMember') {
        const member = await dataService.getDocument("members", value);
        if (member.mute) {
          member.mute = false;
          await membersService.updateMembers([member]);
          reply_markup.inline_keyboard[0][0] = {
            text: 'Отключить уведомления',
            callback_data: `muteMember=${member.id}`
          }
          await axios.post(`${TG_API}/editMessageText`, {
            chat_id,
            message_id: cq.message.message_id,
            reply_markup,
          });
        }
      }

      await axios.post(`${config.tgApiUrl}/answerCallbackQuery`, {
        callback_query_id: cq.id,
        text: 'Спасибо!'
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
