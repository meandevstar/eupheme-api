import { Schema } from 'mongoose';
import { IMessageModel, IMessageDocument, MessageStatus, MessageType } from 'models/types';
import { IBaseSchema } from 'common/types';

const messageSchema = new IBaseSchema<IMessageDocument, IMessageModel>({
  room: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Room',
  },
  user: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  type: {
    type: String,
    enum: Object.values(MessageType),
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(MessageStatus),
    default: MessageStatus.Unread,
  },
  content: String,
});

messageSchema.index({ room: 1 });

export default messageSchema;
