import { Router } from 'express';
import { fetchPublicNewsCatalog } from '../services/publicCatalogQueries.js';

export const newsRouter = Router();

newsRouter.get('/', async (_req, res, next) => {
  try {
    res.json(await fetchPublicNewsCatalog());
  } catch (e) {
    next(e);
  }
});
