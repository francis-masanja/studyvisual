import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import uploadHandler from '../api/upload.js';
import materialsHandler from '../api/materials.js';
import materialHandler from '../api/material.js';
import dailyChallengeHandler from '../api/daily-challenge.js';
import deleteMaterialHandler from '../api/delete-material.js';
import categoriesHandler from '../api/categories.js';
import createCategoryHandler from '../api/create-category.js';
import recordAttemptHandler from '../api/record-attempt.js';
import pingHandler from '../api/ping.js';
import updateProgressHandler from '../api/update-progress.js';
import userStatsHandler from '../api/user-stats.js';
import challengeSessionHandler from '../api/challenge-session.js';
import quizResultsHandler from '../api/quiz-results.js';
import questionsHandler from '../api/questions.js';
import aiGenerateHandler from '../api/ai-generate.js';
import aiExplainHandler from '../api/ai-explain.js';
import aiChatHandler from '../api/ai-chat.js';

const app = express();
app.use(cors());
app.use(express.json());

// Log all requests for debugging
app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Mock Vercel req/res objects for the existing handlers
type VercelHandler = (req: VercelRequest, res: VercelResponse) => unknown;

const wrapHandler = (handler: VercelHandler) => async (req: Request, res: Response) => {
  try {
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
  } catch (error) {
    console.error("Local Server Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

app.post('/api/upload', wrapHandler(uploadHandler));
app.get('/api/materials', wrapHandler(materialsHandler));
app.get('/api/material', wrapHandler(materialHandler));
app.get('/api/daily-challenge', wrapHandler(dailyChallengeHandler));
app.delete('/api/delete-material', wrapHandler(deleteMaterialHandler));
app.get('/api/categories', wrapHandler(categoriesHandler));
app.post('/api/create-category', wrapHandler(createCategoryHandler));
app.post('/api/record-attempt', wrapHandler(recordAttemptHandler));
app.post('/api/update-progress', wrapHandler(updateProgressHandler));
app.get('/api/ping', wrapHandler(pingHandler));
app.get('/api/user-stats', wrapHandler(userStatsHandler));
app.post('/api/user-stats', wrapHandler(userStatsHandler));
app.get('/api/challenge-session', wrapHandler(challengeSessionHandler));
app.post('/api/challenge-session', wrapHandler(challengeSessionHandler));
app.get('/api/quiz-results', wrapHandler(quizResultsHandler));
app.post('/api/quiz-results', wrapHandler(quizResultsHandler));
app.get('/api/questions', wrapHandler(questionsHandler));
app.post('/api/ai-generate', wrapHandler(aiGenerateHandler));
app.post('/api/ai-explain', wrapHandler(aiExplainHandler));
app.post('/api/ai-chat', wrapHandler(aiChatHandler));

const PORT = 3000;
const HOST = '127.0.0.1'; // Force IPv4
app.listen(PORT, HOST, () => {
  console.log(`Local API Server running at http://${HOST}:${PORT}`);
});
