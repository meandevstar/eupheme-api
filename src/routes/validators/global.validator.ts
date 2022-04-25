import { Joi } from 'common/utils';

export const paginationSchema = {
  offset: Joi.number().integer().min(0).when('limit', {
    is: Joi.exist(),
    then: Joi.exist(),
  }),
  limit: Joi.number().integer().min(1),
  sort: Joi.string(),
};

export const emailSchema = Joi.string().email().max(255, 'utf8');
export const passwordSchema = Joi.string().min(8).max(255, 'utf8');
export const timezoneSchema = Joi.string().max(50, 'utf8');
export const mongooseIdSchema = Joi.string().max(24, 'utf8');
