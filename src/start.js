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

    // Проверка токена: какой бот?
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

    // ⚠️ Исключаем и hash, и signature из набора для подписи
    params.delete('hash');
    params.delete('signature');

    console.log('GIVEN_HASH=', givenHash, 'len=', givenHash?.length);
    console.log('PAIRS_BEFORE_SORT=', [...params.entries()]);

    // 3) собираем data-check-string (базовый вариант)
    const pairs = [];
    for (const [k, v] of params.entries()) {
      pairs.push(`${k}=${v}`);
    }
    pairs.sort();
    const dataCheckString = pairs.join('\n');
    console.log('DATA_CHECK_STRING=\n' + dataCheckString);

    // === DIAG: разные варианты data-check-string и HMAC ======================
    function hmacWebApp(botToken, str) {
      const secretKey = crypto.createHmac('sha256', Buffer.from('WebAppData'))
        .update(Buffer.from(botToken, 'utf8'))
        .digest();
      return crypto.createHmac('sha256', secretKey)
        .update(Buffer.from(str, 'utf8'))
        .digest('hex');
    }

    // 1) Официальный путь: декодированные значения (URLSearchParams), все поля кроме hash/signature, сортировка по ключу
    const entriesDecodedAll = [...params.entries()];
    const D1 = entriesDecodedAll.map(([k, v]) => `${k}=${v}`).sort().join('\n');
    const H1 = hmacWebApp(config.botToken, D1);

    // 2) То же, но без query_id
    const entriesDecodedNoQ = entriesDecodedAll.filter(([k]) => k !== 'query_id');
    const D2 = entriesDecodedNoQ.map(([k, v]) => `${k}=${v}`).sort().join('\n');
    const H2 = hmacWebApp(config.botToken, D2);

    // 3) Сырые пары из raw (без декодирования), исключая hash/signature, с сортировкой
    const rawPairs = raw.split('&').filter(Boolean).map(s => {
      const i = s.indexOf('=');
      return i >= 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, ''];
    });
    const rawEntries = rawPairs.filter(([k]) => k !== 'hash' && k !== 'signature');
    const D3 = rawEntries.map(([k, v]) => `${k}=${v ?? ''}`).sort().join('\n');
    const H3 = hmacWebApp(config.botToken, D3);

    // 4) Сырые пары без query_id
    const rawEntriesNoQ = rawEntries.filter(([k]) => k !== 'query_id');
    const D4 = rawEntriesNoQ.map(([k, v]) => `${k}=${v ?? ''}`).sort().join('\n');
    const H4 = hmacWebApp(config.botToken, D4);

    // 5) Декодированные, без сортировки (как есть)
    const D5 = entriesDecodedAll.map(([k, v]) => `${k}=${v}`).join('\n');
    const H5 = hmacWebApp(config.botToken, D5);

    // 6) Сырые, без сортировки (как есть)
    const D6 = rawEntries.map(([k, v]) => `${k}=${v ?? ''}`).join('\n');
    const H6 = hmacWebApp(config.botToken, D6);

    console.log('— DIAG —');
    console.log('GIVEN_HASH         =', givenHash);
    console.log('H1 dec+sorted      =', H1);
    console.log('H2 dec+sorted -qid =', H2);
    console.log('H3 raw+sorted      =', H3);
    console.log('H4 raw+sorted -qid =', H4);
    console.log('H5 dec no-sort     =', H5);
    console.log('H6 raw no-sort     =', H6);
    console.log('D1\n' + D1);
    console.log('D2\n' + D2);
    console.log('D3\n' + D3);
    console.log('D4\n' + D4);
    console.log('D5\n' + D5);
    console.log('D6\n' + D6);
    // === /DIAG ================================================================

    // 4) считаем подпись (боевой вариант — строго байтами, как в доке)
    const secretKey = crypto
      .createHmac('sha256', Buffer.from('WebAppData'))
      .update(Buffer.from(config.botToken, 'utf8'))
      .digest();

    const calcHashWebApp = crypto
      .createHmac('sha256', secretKey)
      .update(Buffer.from(dataCheckString, 'utf8'))
      .digest('hex');

    console.log('BOT_TOKEN_PREFIX=', (config.botToken || '').slice(0, 10));
    console.log('SECRET_KEY_HEX=', Buffer.from(secretKey).toString('hex'));
    console.log('CALC_HASH_WEBAPP=', calcHashWebApp);
    console.log(3);

    // timing-safe сравнение (для WebApp формулы)
    if (calcHashWebApp.length !== givenHash.length) {
      return res.status(401).json({ error: 'Invalid initData signature (length mismatch)' });
    }
    const ok = crypto.timingSafeEqual(Buffer.from(calcHashWebApp, 'hex'), Buffer.from(givenHash, 'hex'));
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
      try { return JSON.parse(s); } catch { return undefined; }
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
