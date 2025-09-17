const dataService = require("../services/mongodb");
const { ObjectId } = require("mongodb");
const membersService = require("../services/membersService");
const config = require("../config/config");

const handleWebhook = async (req, res) => {
  try {
    const update = req.body;

    if (update.callback_query) {
      const cq = update.callback_query;
      const data = cq.data;
      console.log(cq)
      const chat_id = cq.message.chat.id;

      await axios.post(`${config.tgApiUrl}/answerCallbackQuery`, {
        callback_query_id: cq.id,
        text: 'Спасибо! '
      });

      // await axios.post(`${TG_API}/editMessageText`, {
      //   chat_id,
      //   message_id: cq.message.message_id,
      //   text: `Ваш выбор: ${data === 'like' ? 'Нравится' : 'Не нравится'}`
      // });
    }

    res.json({ ok: true });
  }  catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

module.exports = {
  handleWebhook: handleWebhook,
};
