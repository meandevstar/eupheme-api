import { Joi } from 'common/utils';
import { RelationType } from 'models/types';

export const relationCreateSchema = {
  target: Joi.string().required(),
  type: Joi.string().valid(...Object.values(RelationType)),
};
