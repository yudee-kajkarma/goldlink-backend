import http from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { initSocket } from './sockets/index.js';
import { initJobs } from './jobs/reminders.job.js';
const server = http.createServer(app);
// Initialize Socket.io
initSocket(server);
// Initialize Cron Jobs
initJobs();
// Connect to Database and start server
connectDB().then(() => {
    server.listen(env.PORT, () => {
        console.log(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    });
});
//# sourceMappingURL=index.js.map