const { Server } = require("socket.io");
const config = require("../config/config");

let io;

const initSocket = function (server) {
    io = new Server(server, {
        cors: { origin: config.frontURL, credentials: true },
    });
    io.use((socket, next) => {
        const roomId = socket.handshake.auth.roomId;
        socket.roomId = roomId;
        next();
    });
    io.on('connection', (socket) => {
        console.log('Client connected:', socket.roomId);
        if (socket.roomId) {
            socket.join(socket.roomId);
        }

        socket.on('disconnect', () => {
            console.log('Client disconnected');
        });
    });
};


const sendMessage = function (roomId, data) {
    if (io) {
        io.to(roomId).emit("messageToClient", data);

    }
};
module.exports = {
    initSocket: initSocket,
    sendMessage: sendMessage
};