import { IAppContext, StatusCode } from "common/types";
import { createError } from "common/utils";
import { ISessionCreatePayload } from "models/types";

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

  const isScheduledSession = payload.start && payload.end;
  if (isScheduledSession) {
    // check session conflicts
  }

  // const session = await new Session({
  //   type: payload.type,
  //   participants: [user.id, payload.target],
  //   status: isScheduledSession ? 
  // }).save();
}
