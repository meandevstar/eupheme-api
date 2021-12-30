import { Joi } from 'common/utils';
import { UserStatus, UserType } from 'models/types';
import { emailSchema, mongooseIdSchema, paginationSchema, passwordSchema, timezoneSchema } from './global.validator';

export const userRegisterSchema = {
  email: emailSchema.required(),
  username: Joi.string().max(50, 'utf8').required(),
  name: Joi.string().max(255, 'utf8').required(),
  dob: Joi.date().iso().required(),
  password: passwordSchema.required(),
  timezone: timezoneSchema.required(),
  phone: Joi.string(),
  idUrl: Joi.string().required(),
};

export const userLoginSchema = {
  email: emailSchema,
  password: passwordSchema.required(),
  timezone: timezoneSchema.required(),
  user: mongooseIdSchema.when('email', {
    is: null,
    then: Joi.required(),
  }),
};

export const userUpdateSchema = {
  name: Joi.string(),
  email: Joi.string(),
  dob: Joi.string(),
  phone: Joi.string(),
  avatar: Joi.string(),
};

export const getUsersSchema = {
  ...paginationSchema,
  search: Joi.string().max(50, 'utf8'),
  type: Joi.string().valid(...Object.values(UserType)),
  status: Joi.string().valid(...Object.values(UserStatus)),
}