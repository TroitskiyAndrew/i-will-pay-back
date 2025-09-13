const express = require("express");
const http = require("http");
const cors = require("cors");
const crypto = require('crypto');

const config = require("./config/config");
const usersController = require("./controllers/usersController");
const membersController = require("./controllers/membersController");
const paymentsController = require("./controllers/paymentsController");
const roomsController = require("./controllers/roomsController");
const sharesController = require("./controllers/sharesController");
const socketService = require("./services/socketService");

const MAX_AGE_SECONDS = 24 * 60 * 60; // 24 часа

const app = express();
const server = http.createServer(app);

socketService.initSocket(server)

const telegramInitDataMiddleware = (req, res, next) => {
  try {
    if (!config.prod) {
      // ToDo для локального тестирования
      req.telegramData = { user: { id: 888, first_name: 'Test 2' }, chat: { id: 555, title: 'test' }, startParam: null }
      next();
      return;
    }

    // middleware: verify Telegram initData and attach req.telegramData
    // Требует: config.telegrammHeader, config.botToken, MAX_AGE_SECONDS, crypto, URLSearchParams

    console.log('BOT_TOKEN_LEN=', (config.botToken || '').length);
    console.log('BOT_TOKEN_VISIBLE=', JSON.stringify(config.botToken || ''));
    console.log('BOT_TOKEN_HEX=', Buffer.from(config.botToken || '').toString('hex'));

    // Проверка: какой бот по этому токену
    fetch(`https://api.telegram.org/bot${config.botToken}/getMe`)
      .then(r => r.json())
      .then(x => console.log('BOT getMe:', x))
      .catch(e => console.error('getMe failed:', e));

    console.log(1);

    // 1) достаём сырые данные (из заголовка или, на всякий, из body.initData)
    const raw = (req.header(config.telegrammHeader) || req.body?.initData || '').toString();
    if (!raw) return res.status(401).json({ error: 'initData missing' });
    console.log('RAW_INITDATA=', raw); // Сравните с window.Telegram.WebApp.initData на фронте
    console.log(2);

    // 2) парсим URLSearchParams
    const params = new URLSearchParams(raw);
    const givenHash = params.get('hash');
    if (!givenHash) return res.status(401).json({ error: 'hash missing' });

    // ⚠️ ВАЖНО: исключаем и hash, и signature из набора для подписи
    params.delete('hash');
    params.delete('signature');

    console.log('GIVEN_HASH=', givenHash, 'len=', givenHash?.length);
    console.log('PAIRS_BEFORE_SORT=', [...params.entries()]);

    // 3) собираем data-check-string
    const pairs = [];
    for (const [k, v] of params.entries()) {
      pairs.push(`${k}=${v}`);
    }
    pairs.sort();
    const dataCheckString = pairs.join('\n');

    console.log('DATA_CHECK_STRING=\n' + dataCheckString);

    // 4) считаем подпись (вариант для WebApp — правильный)
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(config.botToken)
      .digest();
    const calcHashWebApp = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // 4.1) Доп. диагностика: альтернативная формула (для Login Widget) — ДОЛЖНА НЕ СОВПАДАТЬ
    const secretKeyLogin = crypto.createHash('sha256')
      .update(config.botToken)
      .digest();
    const calcHashLogin = crypto.createHmac('sha256', secretKeyLogin)
      .update(dataCheckString)
      .digest('hex');

    console.log('BOT_TOKEN_PREFIX=', (config.botToken || '').slice(0, 10));
    console.log('SECRET_KEY_HEX=', Buffer.from(secretKey).toString('hex'));
    console.log('CALC_HASH_WEBAPP=', calcHashWebApp);
    console.log('CALC_HASH_LOGIN =', calcHashLogin);
    console.log(3);

    // timing-safe сравнение (для WebApp формулы)
    if (calcHashWebApp.length !== givenHash.length) {
      return res.status(401).json({ error: 'Invalid initData signature (length mismatch)' });
    }
    const ok = crypto.timingSafeEqual(Buffer.from(calcHashWebApp), Buffer.from(givenHash));
    if (!ok) return res.status(401).json({ error: 'Invalid initData signature' });
    console.log(4);

    // 5) проверяем «свежесть»
    const authDate = Number(params.get('auth_date') || 0);
    if (!authDate || (Math.floor(Date.now() / 1000) - authDate) > MAX_AGE_SECONDS) {
      return res.status(401).json({ error: 'initData expired' });
    }

    // 6) извлекаем полезные поля (если есть)
    const asRecord = {};
    for (const [k, v] of params.entries()) asRecord[k] = v;

    const parseJson = (key) => {
      const s = params.get(key);
      if (!s) return undefined;
      try { return JSON.parse(s) } catch { return undefined; }
    };

    const user = parseJson('user');
    const chat = parseJson('chat');
    const receiver = parseJson('receiver');
    const chatType = params.get('chat_type');
    const startParam = params.get('start_param');

    // 7) кладём в req и идём дальше
    req.telegramData = {
      raw,
      user,
      authDate,
      startParam: startParam ?? null,
      chatType: chatType ?? null,
      chat: chat ?? null,
      receiver: receiver ?? null,
      params: asRecord,
    };
    console.log(5);

    next();


  } catch (e) {
    console.log(e)
    return res.status(400).json({ error: 'initData processing error', details: e?.message });
  }
};


app.use(express.json());
app.use(cors({ origin: config.frontURL, credentials: true }));
app.use(telegramInitDataMiddleware);

app.get("/auth", usersController.auth);
app.post("/users", usersController.createUser);

app.get("/members/:roomId", membersController.getMembers);
app.post("/members", membersController.createMember);
app.put("/members", membersController.updateMember);
app.put("/role", membersController.changeRole);

app.get("/payments/:roomId", paymentsController.getPayments);
app.post("/payments", paymentsController.createPayment);
app.put("/payments", paymentsController.updatePayment);
app.delete("/payments/:paymentId", paymentsController.deletePayment);

app.get("/rooms", roomsController.getRooms);
app.post("/rooms", roomsController.createRoom);
app.put("/rooms", roomsController.updateRoom);
app.get("/state/:roomId", roomsController.getRoomState);

app.get("/shares/:paymentId", sharesController.getShares);
app.post("/shares", sharesController.createShare);
app.put("/shares", sharesController.updateShare);
app.delete("/shares/:shareId", sharesController.deleteShare);



server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
