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

    // 1) Получаем СЫРУЮ строку initData (как есть, без перекодирования!)
    const raw = (req.get(config.telegrammHeader) || req.body?.initData || '').toString();
    if (!raw) {
      return res.status(401).json({ error: 'initData missing' });
    }

    // 2) Разбираем параметры (query-string)
    const params = new URLSearchParams(raw);

    const givenHash = params.get('hash');
    if (!givenHash) {
      return res.status(401).json({ error: 'hash missing' });
    }

    // По инструкции в подпись идут "все полученные поля".
    // На практике `hash` (и встречающееся у некоторых клиентов `signature`) нужно исключить.
    // params.delete('hash');
    // params.delete('signature');

    // 3) Строим data_check_string: key=value, отсортировано по ключу, разделитель '\n'
    const pairs = [];
    for (const [k, v] of params.entries()) {
      pairs.push(`${k}=${v}`);
    }
    pairs.sort(); // лексикографически по ключу
    const dataCheckString = pairs.join('\n');

    // 4) Секретный ключ и расчёт подписи по инструкции
    // secret_key = HMAC_SHA256(key="WebAppData", msg=<BOT_TOKEN>)
    const secretKey = crypto
      .createHmac('sha256', Buffer.from('WebAppData'))
      .update(Buffer.from(config.botToken, 'utf8'))
      .digest(); // Buffer

    // calcHash = hex(HMAC_SHA256(key=secret_key, msg=data_check_string))
    const calcHash = crypto
      .createHmac('sha256', secretKey)
      .update(Buffer.from(dataCheckString, 'utf8'))
      .digest('hex');

    // 5) Сравнение подписи (времязащищённое)
    if (calcHash.length !== givenHash.length) {
      return res.status(401).json({ error: 'Invalid initData signature (length mismatch)' });
    }
    const ok = crypto.timingSafeEqual(
      Buffer.from(calcHash, 'hex'),
      Buffer.from(givenHash, 'hex')
    );
    if (!ok) {
      return res.status(401).json({ error: 'Invalid initData signature' });
    }

    // 6) Доп. защита: проверка «свежести» по auth_date
    const authDate = Number(params.get('auth_date') || 0);
    const nowSec = Math.floor(Date.now() / 1000);
    if (!authDate || nowSec - authDate > MAX_AGE_SECONDS) {
      return res.status(401).json({ error: 'initData expired' });
    }

    // 7) Разбор сложных полей (user/chat/receiver) — это JSON-строки
    const parseJson = (key) => {
      const s = params.get(key);
      if (!s) return undefined;
      try { return JSON.parse(s); } catch { return undefined; }
    };

    const user = parseJson('user');
    const chat = parseJson('chat');
    const receiver = parseJson('receiver');
    const chatType = params.get('chat_type') || null;
    const startParam = params.get('start_param') || null;

    // 8) Сохраняем данные в req и идём дальше
    const flatParams = {};
    for (const [k, v] of params.entries()) flatParams[k] = v;

    req.telegramData = {
      raw,                // исходная строка initData
      user,               // объект user (если был)
      chat,               // объект chat (если был)
      receiver,           // объект receiver (если был)
      chatType,           // chat_type (если был)
      startParam,         // start_param (если был)
      authDate,           // UNIX-время из initData
      params: flatParams, // все пары, кроме hash/signature
    };

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
