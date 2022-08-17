import { Schema } from 'mongoose';
import {
  INotificationModel,
  INotificationDocument,
  NotificationType,
  NotificationStatus,
} from 'models/types';
import { IBaseSchema } from 'common/types';

const notificationSchema = new IBaseSchema<INotificationDocument, INotificationModel>({
  user: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  type: {
    type: String,
    enum: Object.values(NotificationType),
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(NotificationStatus),
    default: NotificationStatus.Unread,
  },
  meta: {
    session: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
    },
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
    },
    source: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
});

notificationSchema.index({ user: 1, status: 1, type: 1 });

export default notificationSchema;