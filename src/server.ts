import app from './app';
import config from './config/config';
import DatabaseClient from './client/DatabaseClient';

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await DatabaseClient.client.end(); // Close the database connection
  process.exit(0);
});