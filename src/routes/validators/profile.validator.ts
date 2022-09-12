import { Joi } from 'common/utils';

export const mediaRegistrationSchema = {
  name: Joi.string().max(255, 'utf8'),
  description: Joi.string().max(500, 'utf8'),
  file: Joi.any().required(),
  public: Joi.boolean(),
};
