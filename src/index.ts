import express from 'express';
import subjectsRouter from './routes/subjects';
import cors from 'cors';
import securityMiddleware from './middleware/security';
import { toNodeHandler } from "better-auth/node";
import { auth } from './lib/auth';

const app = express();
const PORT = Number(process.env.PORT) || 8000


const FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL && process.env.NODE_ENV === 'production') {
  throw new Error('FRONTEND_URL is required in production');
}

app.use(cors({
  origin: FRONTEND_URL ?? 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

app.use(securityMiddleware)

app.use('/api/subjects', subjectsRouter)

app.get('/', (req, res) => {
  res.send('Welcome to the Classroom Backend!');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});