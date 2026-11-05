import { createServer } from 'node:http';
import app from './app.js';
import connectToDb from './src/config/db.js';
import { initializeSocket } from './socket.js';

const port = process.env.PORT || 3000;

async function startServer() {
    await connectToDb();
    const server = createServer(app);
    initializeSocket(server);
    server.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exitCode = 1;
});
