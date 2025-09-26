const axios = require("axios");
const { tgApiUrl } = require("../config/config");

async function sendMessage(chat_id, text, reply_markup) {
    if(chat_id === 111){
        return;
    }
    try {
        await axios.post(`${tgApiUrl}/sendMessage`, {
            chat_id,
            text: text ?? 'Выбери действие:',
            reply_markup
          })
        
    } catch (error) {
        console.error('__fail_to_send_message',chat_id ,error.message);

    }
}

module.exports = {
    sendMessage: sendMessage,
};