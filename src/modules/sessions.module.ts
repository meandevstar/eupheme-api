import { DateTime } from 'luxon';
import omitBy from 'lodash/omitBy';
import isNil from 'lodash/isNil';
import omit from 'lodash/omit';
import * as opentok from './lib/opentok.module';
import logger from './lib/logger.module';
import { IAppContext, IQueryPayload, StatusCode } from 'common/types';
import { checkWithinWorkingHours, cleanSeconds, createError } from 'common/utils';
import {
  ISendNotificationPayload,
  ISendSessionNotificationPayload,
  ISession,
  ISessionCreatePayload,
  NotificationType,
  SessionStatus,
  UserType,
} from 'models/types';
import config from 'common/config';
import { sendEmail } from './lib/email.module';
import { sendNotification } from './notifications.module';
import { getEmitter, getAccountRoomName } from './lib/socket.module';

const MODULE = 'SESSION';

export async function createSession(context: IAppContext, payload: ISessionCreatePayload) {
  const {
    conn: { Session, User },
    user,
  } = context;

  if (user.id === payload.target) {
    throw createError(StatusCode.BAD_REQUEST, 'You can not make appointment to yourself');
  }

  const target = await User.findById(payload.target)
    .select('username email status type timezone email')
    .lean({ virtuals: true });
  if (!target) {
    throw createError(StatusCode.BAD_REQUEST, 'Target does not exists');
  }
  if (target.type === user.type) {
    throw createError(StatusCode.BAD_REQUEST, 'Target type is wrong');
  }

  const lStartTime = cleanSeconds(DateTime.fromISO(payload.start, { setZone: true }));
  const lEndTime = cleanSeconds(DateTime.fromISO(payload.end, { setZone: true }));
  const startTime = lStartTime.toJSDate();
  const endTime = lEndTime.toJSDate();

  const { total: totalSessions } = await getSessions(
    context,
    {
      query: {
        startTime,
        endTime,
        status: {
          $ne: SessionStatus.Canceled,
        },
        $or: [{ user: target.id }, { target: target.id }],
      },
      select: {
        _id: 1,
      },
    },
    true
  );

  // check available hours
  const workingHours = checkWithinWorkingHours(
    lStartTime,
    lEndTime,
    // TODO: update if admin has availability setting
    target.type === UserType.Creator ? target.workingHours : null
  );
  if (totalSessions > 0 || workingHours.length === 0) {
    throw createError(StatusCode.BAD_REQUEST, 'Creator does not have available time slots');
  }

  // TODO: check if we need to run a cron job and create sessions right before the meeting starts, to avoid overheads
  let session;
  try {
    // create dedicated video call session
    const otSession = await opentok.createSession();
    session = new Session({
      participants: [user.id, target.id],
      start: startTime,
      end: endTime,
      otId: otSession.sessionId,
    });

    await session.save();
  } catch (error) {
    const serverMsg = 'Something went wrong while creating session';
    logger.log(serverMsg, { MODULE, error });
    throw createError(StatusCode.INTERNAL_SERVER_ERROR, serverMsg);
  }

  // send notification
  sendSessionNotification(context, {
    type: 'create',
    target,
    startTime: lStartTime,
    endTime: lEndTime,
    sessionId: session.id,
  });

  return omit(session.beautify(), ['id']);
}

export async function getSessions(
  context: IAppContext,
  payload: IQueryPayload,
  skipSelfQuery?: boolean
) {
  const {
    conn: { Session },
    user,
  } = context;

  const { query = {}, pagination, sort, select, populate } = payload;
  let sessionQuery: any = query;

  if (query.startTime) {
    sessionQuery.startTime = {
      $gte: query.startTime,
    };
  }
  if (query.endTime) {
    sessionQuery.startTime = {
      ...(sessionQuery.startTime || {}),
      $lte: query.endTime,
    };
    delete sessionQuery.endTime;
  }
  if (!skipSelfQuery) {
    sessionQuery.participants = {
      $elemMatch: {
        $in: [user.id],
      },
    };
  }
  if (query.target) {
    if (skipSelfQuery) {
      sessionQuery.participants = {
        $elemMatch: {
          $in: [query.target],
        },
      };
    } else {
      sessionQuery.participants.$elemMatch.$in.push(query.target);
    }

    delete sessionQuery.target;
  }

  sessionQuery = omitBy(sessionQuery, isNil);

  const countAction = Session.find(sessionQuery).countDocuments();
  let queryAction = Session.find(sessionQuery);
  if (sort) {
    queryAction = queryAction.sort(sort);
  }
  if (pagination?.limit !== undefined && pagination?.offset !== undefined) {
    queryAction = queryAction.skip(pagination.offset * pagination.limit).limit(pagination.limit);
  }
  if (populate) {
    queryAction = queryAction.populate(populate);
  }
  if (select) {
    queryAction = queryAction.select(select);
  }

  const [total, sessions] = await Promise.all([countAction, queryAction.lean({ virtuals: true })]);

  return {
    total,
    data: sessions.map((v) => omit(v, ['_id'])),
  };
}

export async function getUpcomingSessions(context: IAppContext, payload: IQueryPayload) {
  const { user: sessionUser } = context;
  const newPayload = { ...payload };
  newPayload.query = {
    ...payload.query,
    status: SessionStatus.Pending,
    startTime: new Date(),
    $or: [{ user: sessionUser.id }, { provider: sessionUser.id }],
  };

  // setting default values for pagination
  newPayload.pagination = {
    limit: 10,
    offset: 0,
    ...payload.pagination,
  };
  newPayload.populate = [
    {
      path: 'participants',
      select: 'username avatar',
    },
  ];

  const { total, data } = await getSessions(context, newPayload, true);
  return {
    total,
    data,
  };
}

export async function updateSession(
  context: IAppContext,
  sessionId: string,
  payload: Partial<ISession>
) {
  const {
    conn: { Session },
    user,
  } = context;

  const session = await Session.findById(sessionId);
  if (!session) {
    throw createError(StatusCode.BAD_REQUEST, 'Session does not exist');
  }

  const isValid = session.participants.some((participant) => participant.equals(user.id));
  if (!isValid) {
    throw createError(StatusCode.BAD_REQUEST, 'Session does not exists');
  }

  // update session
  Object.assign(session, payload);

  await session.save();

  // send notification
  if (payload.start && payload.end) {
    const populatedSession = await session.populate({
      path: 'participants',
      select: 'username email notifications',
    });

    // send notification
    const target: any = populatedSession.participants.find(
      (participant) => !participant._id.equals(user.id)
    );
    sendSessionNotification(context, {
      type: 'reschedule',
      target,
      startTime: DateTime.fromJSDate(session.start as Date),
      endTime: DateTime.fromJSDate(session.end as Date),
      sessionId: session._id,
    });
  }
}

export async function cancelSession(context: IAppContext, sessionId: string) {
  const {
    conn: { Session },
    user,
  } = context;

  const session = await Session.findById(sessionId)
    .populate({
      path: 'participants',
      select: 'username email notifications',
    })

  if (!session) {
    throw createError(StatusCode.BAD_REQUEST, 'Session does not exist');
  }
  if (session.status !== SessionStatus.Pending) {
    throw createError(StatusCode.BAD_REQUEST, 'Session is not in valid status');
  }

  const isValid = session.participants.some((participant) => participant.equals(user.id));
  if (!isValid) {
    throw createError(StatusCode.BAD_REQUEST, 'Session does not exists');
  }
  if (DateTime.fromJSDate(session.start as Date).diff(DateTime.now(), 'minutes').minutes < 1) {
    throw createError(StatusCode.BAD_REQUEST, 'You cannot cancel 1 minutes before the meeting');
  }

  session.status = SessionStatus.Canceled;
  await session.save();

  // send notification
  const target: any = session.participants.find(
    (participant) => !participant._id.equals(user.id)
  );
  sendSessionNotification(context, {
    type: 'cancel',
    target,
    startTime: DateTime.fromJSDate(session.start as Date),
    endTime: DateTime.fromJSDate(session.end as Date),
    sessionId: session._id,
  });
}

async function getSession(context: IAppContext, sessionId: string) {
  const {
    conn: { Session },
    user,
  } = context;

  const session = await Session.findOne({
    participants: user.id,
    _id: sessionId,
  })
    .populate({
      path: 'participants',
      select: 'username avatar type',
    });

  if (!session) {
    throw createError(StatusCode.BAD_REQUEST, 'Session does not exist');
  }

  return session.beautify();
}

export async function getSessionToken(context: IAppContext, sessionId: string) {
  const session = await getSession(context, sessionId);
  if (!session.otId) {
    throw createError(StatusCode.BAD_REQUEST, 'Session was not initialized');
  }

  const sessionToken = opentok.generateToken(session.otId);
  return sessionToken;
}

export async function startCall(context: IAppContext, sessionId: string) {
  const { user } = context;

  const session = await getSession(context, sessionId);
  if (!session.otId) {
    throw createError(StatusCode.BAD_REQUEST, 'Session was not initialized');
  }

  const io = getEmitter();
  const targetId: any = session.participants.find(
    (participant) => !participant._id.equals(user.id)
  );
  const accRoom = getAccountRoomName(targetId);
  io.of('/').to(accRoom).emit('incoming_call', {
    otId: session.otId,
    caller: user.id,
  });
}

function sendSessionNotification(
  context: IAppContext,
  { type, target, startTime, endTime, sessionId }: ISendSessionNotificationPayload
) {
  const { user } = context;
  // send notifications - we send custom email here
  // TODO: move template to email helper & modify sendNotification function to receive template type
  const targetName = target.username || target.email;
  const userName = user.username || user.email;
  const emailBody = `
    <b>When</b>: ${startTime.toFormat("cccc LLLL dd 'at' h:mm a")} - ${endTime.toFormat(
    'h:mm a'
  )} (GMT ${startTime.toFormat('ZZ')})
    <br/>
    <b>Timezone</b>: ${startTime.toFormat('ZZZZZ')}
    <br/>
    <b>Attendees</b>:
    <ul>
      <li>Doctor: ${targetName}</li>
      <li>User: ${userName}</li>
    </ul>
    <br/>
    Visit your dashboard <a href='${config.frontHost}/dashboard'>here</a>
  `;

  sendEmail({
    body: emailBody,
    recipients: user.email,
    subject:
      type === 'create'
        ? `Appointment confirmation with ${targetName}`
        : type === 'reschedule'
        ? `Appointment with ${targetName} has been rescheduled`
        : `Appointment with ${targetName} has been cancelled`,
  });
  sendEmail({
    body: emailBody,
    recipients: target.email,
    subject:
      type === 'create'
        ? `Appointment confirmation with ${userName}`
        : type === 'reschedule'
        ? `Appointment with ${userName} has been rescheduled`
        : `Appointment with ${userName} has been cancelled`,
  });

  const notificationPayload: ISendNotificationPayload = {
    content:
      type === 'create'
        ? `Appointment confirmation with ${targetName}`
        : type === 'reschedule'
        ? `Appointment with ${targetName} has been rescheduled`
        : `Appointment with ${targetName} has been cancelled`,
    user: target.id,
    type: NotificationType.NewSession,
    meta: {
      session: sessionId,
    },
  };

  sendNotification(context, notificationPayload, {
    inApp: true,
    createEntity: true,
    email: target.notifications.email[NotificationType.NewSession],
    // sms: target.notifications.sms[NotificationType.NewAppointment],
  });
}
