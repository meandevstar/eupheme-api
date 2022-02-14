import { LeanDocument, PopulatedDoc, Types } from 'mongoose';
import { DateTime } from 'luxon';
import { IBaseModel, IBaseDocument } from 'common/types';
import { IUserDocument } from '.';

export enum SessionType {
  Call = 'CALL',
  Video = 'VIDEO',
}

export enum SessionStatus {
  Pending = 'PENDING',
  Confirmed = 'Confirmed',
  InProgress = 'IN_PROGRESS',
  Completed = 'COMPLETED',
  Canceled = 'CANCELED',
  Missed = 'MISSED',
}

export interface ISession {
  type?: SessionType;
  status?: SessionStatus;
  participants: PopulatedDoc<IUserDocument>[];
  otId?: string;
  start: Date | string;
  end: Date | string;
}

export interface ISessionModel extends IBaseModel<ISessionDocument> {}

export interface ISessionDocument extends IBaseDocument<ISession>, ISession {}

export interface ISessionCreatePayload {
  type: SessionType;
  target: string;
  start: string;
  end: string;
}

export interface ISendSessionNotificationPayload {
  type: 'create' | 'reschedule' | 'cancel';
  target: LeanDocument<IUserDocument>;
  startTime: DateTime;
  endTime: DateTime;
  sessionId: Types.ObjectId;
}
