import express from 'express';
import accountRoutes from './routes/accountRoutes';
import apiRoutes from './routes/apiRoutes';
import { errorHandler } from './middlewares/errorHandler';
import cors from 'cors';
import DatabaseClient from './client/DatabaseClient';
import session from 'express-session';
// import "./websocket"

// Initialize database connection
DatabaseClient.init(); 

const app = express();

app.use(express.json());

app.use(cors({
  origin: 'http://localhost:5173', // allow this frontend origin
  credentials: true // if using cookies/session
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'rivulet-key-aG91c2Vsb29zZX',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,  
    secure: false,     // set true if using HTTPS
    sameSite: 'lax',   // prevents CSRF
  }
}));

// Routes
app.use('/api/account', accountRoutes);
app.use('/api', apiRoutes);

// Global error handler (should be after routes)
app.use(errorHandler);

export default app;
