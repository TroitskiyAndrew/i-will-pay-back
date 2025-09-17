const dataService = require("./mongodb");

async function getTelegramId(userId){
    const user = await dataService.getDocument('users', userId);
    return user?.telegramId || null
}

module.exports = {
    getTelegramId: getTelegramId,
  };
  