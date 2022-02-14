import Mongoose from 'mongoose';
import pick from 'lodash/pick';
import omit from 'lodash/omit';
import { IAppContext, IQueryPayload } from 'common/types';
import {
  ISendNotificationOptions,
  ISendNotificationPayload,
  NotificationStatus,
} from 'models/types';
import { sendEmail } from './lib/email.module';
import { getAccountRoomName, getEmitter } from './lib/socket.module';
import config from 'common/config';

export async function getNotifications(context: IAppContext, payload: IQueryPayload) {
  const {
    conn: { Notification },
    user,
  } = context;
  const { query = {}, pagination, sort, select } = payload;

  const notificationQuery = {
    ...query,
    user: user.id,
  };

  const countAction = Notification.find(notificationQuery).countDocuments();
  let queryAction = Notification.find(notificationQuery).populate({
    path: 'meta.source',
    select: 'firstName lastName avatar',
  });
  if (sort) {
    queryAction = queryAction.sort(sort);
  }
  if (pagination?.limit !== undefined && pagination?.offset !== undefined) {
    queryAction = queryAction.skip(pagination.offset * pagination.limit).limit(pagination.limit);
  }

  const [total, notifications] = await Promise.all([
    countAction,
    queryAction.lean({ virtuals: true }),
  ]);

  return {
    total,
    data: notifications.map((v) => omit(v, ['_id'])),
  };
}

export async function sendNotification(
  context: IAppContext,
  payload: ISendNotificationPayload,
  options: ISendNotificationOptions
) {
  const {
    conn: { Notification },
    user,
  } = context;

  let notificationEntity;

  if (options.createEntity) {
    const newPayload: ISendNotificationPayload = { ...payload };

    if (user) {
      newPayload.meta = {
        ...payload.meta,
        source: user?.id,
      };
    }

    notificationEntity = await new Notification(newPayload).save();
  }
  if (options.email) {
    // send SMS notification
    const entity = payload.type.split('_')[1].toLowerCase();
    sendEmail({
      body: `
        You have a new ${entity}.
        <br/>
        Visit your dashboard <a href='${config.frontHost}/dashboard'>here</a>
      `,
      recipients: payload.email || user?.email,
      subject: 'New Notification from FirstReach',
    });
  }
  if (options.sms) {
    // send SMS notification
  }
  if (options.inApp) {
    const io = getEmitter();
    const accRoom = getAccountRoomName(payload.user.toString());
    const inAppPayload: any = notificationEntity ? notificationEntity.beautify() : payload;

    if (payload.content) {
      inAppPayload.content = payload.content;
    }

    if ((payload.meta?.source as any)?.firstName) {
      // use payload's meta setting directly if that's already populated
      inAppPayload.meta.source = payload.meta.source;
    } else if (user) {
      // use current user's meta setting if payload meta was not populated
      inAppPayload.meta.source = pick(user, ['firstName', 'lastName']);
    }

    io.of('/').to(accRoom).emit('new_notification', inAppPayload);
  }
}

export async function markAsRead(context: IAppContext, notifications: string[]) {
  const {
    conn: { Notification },
    user,
  } = context;

  const notificationIds = notifications.map((v) => new Mongoose.Types.ObjectId(v));
  await Notification.updateMany(
    {
      user: user.id,
      _id: {
        $in: notificationIds,
      },
    },
    {
      $set: {
        status: NotificationStatus.Read,
      },
    }
  );
}
