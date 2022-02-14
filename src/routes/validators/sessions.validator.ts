import { Joi } from 'common/utils';
import { paginationSchema } from './global.validator';

export const createSessionSchema = {
  target: Joi.string().required(),
  start: Joi.date().iso().greater('now').required(),
  end: Joi.date().iso().min(Joi.ref('start')).required(),
};

export const updateSessionSchema = {
  id: Joi.string().required(),
  start: Joi.date().iso().greater('now'),
  end: Joi.date().iso().min(Joi.ref('start')),
};

export const getSessionsSchema = {
  ...paginationSchema,
  start: Joi.date().iso(),
  end: Joi.date().iso().min(Joi.ref('start')),
  target: Joi.string(),
};