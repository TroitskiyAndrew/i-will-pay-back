const axios = require("axios");
const { tgApiUrl } = require("../config/config");

async function sendMessage(chat_id, text, reply_markup) {

    await axios.post(`${tgApiUrl}/sendMessage`, {
        chat_id,
        text: text ?? 'Выбери действие:',
        reply_markup
      })
}

module.exports = {
    sendMessage: sendMessage,
};