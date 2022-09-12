import { Joi } from 'common/utils';
import { MessageType } from 'models/types';
import { paginationSchema } from './global.validator';

export const getOrCreateRoomSchema = {
  participants: Joi.array().items(Joi.string()),
  id: Joi.string().when('participants', {
    is: null,
    then: Joi.required(),
  }),
};

export const sendMessageSchema = {
  id: Joi.string().required(),
  type: Joi.string().allow(...Object.values(MessageType)).required(),
  content: Joi.string().required(),
};

export const getMessageSchema = {
  ...paginationSchema,
  id: Joi.string().required(),
};

export const markAsReadSchema = {
  rooms: Joi.array().items(Joi.string()).required(),
};
