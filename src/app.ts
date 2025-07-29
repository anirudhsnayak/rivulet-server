import express from 'express';
import itemRoutes from './routes/itemRoutes';
import loginRoutes from './routes/loginRoutes';
import { errorHandler } from './middlewares/errorHandler';
import cors from 'cors';

const app = express();

app.use(express.json());

app.use(cors({
  origin: 'http://localhost:5173', // allow this frontend origin
  credentials: true // if using cookies/session
}));

// Routes
app.use('/api/login', loginRoutes);
app.use('/api/items', itemRoutes);

// Global error handler (should be after routes)
app.use(errorHandler);

export default app;