import type { VercelRequest, VercelResponse } from '@vercel/node';
import uploadHandler from './_legacy/upload.js';
import materialsHandler from './_legacy/materials.js';
import materialHandler from './_legacy/material.js';
import dailyChallengeHandler from './_legacy/daily-challenge.js';
import deleteMaterialHandler from './_legacy/delete-material.js';
import categoriesHandler from './_legacy/categories.js';
import createCategoryHandler from './_legacy/create-category.js';
import recordAttemptHandler from './_legacy/record-attempt.js';
import pingHandler from './_legacy/ping.js';
import updateProgressHandler from './_legacy/update-progress.js';
import userStatsHandler from './_legacy/user-stats.js';
import challengeSessionHandler from './_legacy/challenge-session.js';
import quizResultsHandler from './_legacy/quiz-results.js';
import questionsHandler from './_legacy/questions.js';
import aiGenerateHandler from './_legacy/ai-generate.js';
import aiExplainHandler from './_legacy/ai-explain.js';
import aiChatHandler from './_legacy/ai-chat.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fullUrl = req.url?.startsWith('http') ? req.url : `http://localhost${req.url ?? ''}`;
  const url = new URL(fullUrl);
  const path = url.pathname.replace(/^\/api\//, ''); // strip leading /api/

  switch (path) {
    case 'upload':
      return uploadHandler(req, res);
    case 'materials':
      return materialsHandler(req, res);
    case 'material':
      return materialHandler(req, res);
    case 'daily-challenge':
      return dailyChallengeHandler(req, res);
    case 'delete-material':
      return deleteMaterialHandler(req, res);
    case 'categories':
      return categoriesHandler(req, res);
    case 'create-category':
      return createCategoryHandler(req, res);
    case 'record-attempt':
      return recordAttemptHandler(req, res);
    case 'ping':
      return pingHandler(req, res);
    case 'update-progress':
      return updateProgressHandler(req, res);
    case 'user-stats':
      return userStatsHandler(req, res);
    case 'challenge-session':
      return challengeSessionHandler(req, res);
    case 'quiz-results':
      return quizResultsHandler(req, res);
    case 'questions':
      return questionsHandler(req, res);
    case 'ai-generate':
      return aiGenerateHandler(req, res);
    case 'ai-explain':
      return aiExplainHandler(req, res);
    case 'ai-chat':
      return aiChatHandler(req, res);
    default:
      return res.status(404).json({ error: 'Not found' });
  }
}
