// Entry point: loads settings from server/.env, then starts the HTTP server.
import 'dotenv/config';
import { app } from './app.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
