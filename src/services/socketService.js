const { Server } = require("socket.io");
const config = require("../config/config");

let io;

const initSocket = function (server) {
    io = new Server(server, {
        cors: { origin: config.frontURL, credentials: true },
    });
    io.use((socket, next) => {
        socket.roomIds = socket.handshake.auth.roomIds;
        socket.userId = socket.handshake.auth.userId;
        next();
    });
    io.on('connection', (socket) => {
        console.log('Client connected:', socket.userId);
        if (socket.roomIds) {
            socket.roomIds.forEach(roomId => {
                socket.join(roomId);
            });            
        }
        if (socket.userId) {
            socket.join(socket.userId);           
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