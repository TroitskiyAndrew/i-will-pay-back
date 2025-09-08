const express = require("express");
const http = require("http");
const cors = require("cors");

const config = require("./config/config");
const usersController = require("./controllers/usersController");
const membersController = require("./controllers/membersController");
const paymentsController = require("./controllers/paymentsController");
const roomsController = require("./controllers/roomsController");
const sharesController = require("./controllers/sharesController");
const socketService = require("./services/socketService");

const app = express();
const server = http.createServer(app);

socketService.initSocket(server)

const  telegramInitDataMiddleware = (req, res, next) => {
  try {
    // 1) достаём сырые данные (из заголовка или, на всякий, из body.initData)
    const raw = (req.header(config.telegrammHeader) || req.body?.initData || '').toString();
    if (!raw) return res.status(401).json({ error: 'initData missing' });

    // 2) парсим URLSearchParams
    const params = new URLSearchParams(raw);
    const givenHash = params.get('hash');
    if (!givenHash) return res.status(401).json({ error: 'hash missing' });
    params.delete('hash');

    // 3) собираем data-check-string
    const pairs = [];
    for (const [k, v] of params.entries()) {
      pairs.push(`${k}=${v}`);
    }
    pairs.sort();
    const dataCheckString = pairs.join('\n');

    // 4) считаем подпись
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
                            .update(config.botToken)
                            .digest();
    const calcHash = crypto.createHmac('sha256', secretKey)
                           .update(dataCheckString)
                           .digest('hex');

    // timing-safe сравнение
    const ok = crypto.timingSafeEqual(Buffer.from(calcHash), Buffer.from(givenHash));
    if (!ok) return res.status(401).json({ error: 'Invalid initData signature' });

    // 5) проверяем «свежесть»
    const authDate = Number(params.get('auth_date') || 0);
    if (!authDate || (Math.floor(Date.now()/1000) - authDate) > MAX_AGE_SECONDS) {
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

    const user      = parseJson('user');
    const chat      = parseJson('chat');
    const receiver  = parseJson('receiver');
    const chatType  = params.get('chat_type');
    const startParam= params.get('start_param');

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

    next();
  } catch (e) {
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

app.post("/shares", sharesController.createShare);
app.put("/shares", sharesController.updateShare);
app.delete("/shares/:shareId", sharesController.deleteShare);



server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
