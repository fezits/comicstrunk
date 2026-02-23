import http from 'http';
import { createApp } from './create-app';

const app = createApp();

// Start server - Passenger will capture this listen() call in production
const port = process.env.PORT || 3001;
const server = http.createServer(app);
server.listen(port, () => {
  console.log(`API listening on port ${port}`);
});

export default app;
