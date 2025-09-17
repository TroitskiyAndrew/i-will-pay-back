const express = require("express");
const http = require("http");
const cors = require("cors");
const  { parse, isValid } = require("@telegram-apps/init-data-node");

const config = require("./config/config");
const usersController = require("./controllers/usersController");
const membersController = require("./controllers/membersController");
const paymentsController = require("./controllers/paymentsController");
const roomsController = require("./controllers/roomsController");
const sharesController = require("./controllers/sharesController");
const webhookController = require("./controllers/webhookController");
const socketService = require("./services/socketService");

const MAX_AGE_SECONDS = 24 * 60 * 60; // 24 часа

const app = express();
const server = http.createServer(app);

socketService.initSocket(server)

const telegramInitDataMiddleware = (req, res, next) => {
  try {

    if (!config.prod) {
      // ToDo для локального тестирования
      req.telegramData = { user: { id: 111, first_name: 'Тестовый юзер' }, chat: null, params: {} }
      // req.telegramData.params = {
      //   roomId: '68ca60d0d9b5a5738bcde91e',
      //   paymentId: '68ca893b62761dbcf40a4e64'
      // }
      next();
      return;
    }

    // 1) Получаем СЫРУЮ строку initData (как есть, без перекодирования!)
    const raw = (req.get(config.telegrammHeader) || req.body?.initData || '').toString();
    if (!raw) {
      return res.status(401).json({ error: 'initData missing' });
    }
    const isInitDataValid = isValid(
      raw,
      config.botToken,
    );
    if(!isInitDataValid){
      return res.status(401).json({ error: 'initData invalid' });
    }
    const telegramData = parse(raw);
    telegramData.params = (telegramData.start_param || '').split(config.splitParams).reduce((result, param) => {
      const [key, value] = param.split('=');
      result[key] = value;
      return result;
    } , {}) 
    req.telegramData = telegramData;
    next();


  } catch (e) {
    console.log(e)
    return res.status(400).json({ error: 'initData processing error', details: e?.message });
  }
};


app.use(express.json());
app.use(cors({ origin: config.frontURL, credentials: true }));
app.post("/webhook", webhookController.handleWebhook);
app.use(telegramInitDataMiddleware);



app.get("/auth", usersController.auth);
app.get("/users/:userId", usersController.getUser);
app.post("/users", usersController.createUser);
app.put("/users", usersController.updateUser);

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
app.put("/shares", sharesController.updateShare);
app.delete("/shares/:shareId", sharesController.deleteShare);





server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
