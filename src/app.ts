import express from 'express';
import loginRoutes from './routes/loginRoutes';
import signupRoutes from './routes/signupRoutes';
import userRoutes from './routes/userRoutes';
import { errorHandler } from './middlewares/errorHandler';
import cors from 'cors';
import DatabaseClient from './db/DatabaseClient';
import session from 'express-session';

// Initialize database connection
DatabaseClient.init(); 

const app = express();

app.use(express.json());


app.use(cors({
  origin: 'http://localhost:5173', // allow this frontend origin
  credentials: true // if using cookies/session
}));

app.use(session({
  secret: 'rivulet-key-aG91c2Vsb29zZX',   // use env var in production
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,        // set true if using HTTPS
    sameSite: 'strict'   // prevents CSRF
    // no maxAge → session cookie
  }
}));

// Routes
app.use('/api/login', loginRoutes);
app.use('/api/signup', signupRoutes);
app.use('/api/user', userRoutes);

// Global error handler (should be after routes)
app.use(errorHandler);

export default app;