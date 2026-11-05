import { Server } from 'socket.io';
import userModel from './src/models/user.model.js';
import DoctorModel from './src/models/doctor.model.js';

let io;

export function initializeSocket(server) {
    io = new Server(server, {
        cors: {
            origin: '*',
            methods: [ 'GET', 'POST' ]
        }
    });

    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);
        socket.on('join', async (data) => {
            const { userId, userType } = data;

            if (userType === 'user') {
                await userModel.findByIdAndUpdate(userId, { socketId: socket.id });
            } else if (userType === 'captain') {
                await DoctorModel.findByIdAndUpdate(userId, { socketId: socket.id });
            }
        });
        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
        });
    });
}

export function notifyDoctorRegistration() {
    io?.emit('doctor:registered');
}