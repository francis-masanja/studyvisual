import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import uploadHandler from '../api/upload';
import materialsHandler from '../api/materials';
import materialHandler from '../api/material';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Mock Vercel req/res objects for the existing handlers
const wrapHandler = (handler: any) => async (req: any, res: any) => {
  try {
    // Vercel handlers expect req.query and req.body to be populated (express does this)
    await handler(req, res);
  } catch (error) {
    console.error("Local Server Error:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

app.post('/api/upload', wrapHandler(uploadHandler));
app.get('/api/materials', wrapHandler(materialsHandler));
app.get('/api/material', wrapHandler(materialHandler));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Local API Server running at http://localhost:${PORT}`);
});
