import { PopulatedDoc } from 'mongoose';
import { IBaseModel, IBaseDocument } from 'common/types';
import { IRoomDocument, ISessionDocument, IUserDocument } from '.';

export enum NotificationType {
  NewMessage = 'NEW_MESSAGE',
  NewSession = 'NEW_SESSION',
  IncomingSession = 'INCOMING_SESSION',
}

export interface INotificationSettings {
  email?: Record<string, boolean>;
  sms?: Record<string, boolean>;
}

export enum NotificationStatus {
  Read = 'READ',
  Unread = 'UNREAD',
}

export interface INotification {
  user: PopulatedDoc<IUserDocument>;
  status: NotificationStatus;
  type: NotificationType;
  meta: {
    session?: PopulatedDoc<ISessionDocument>;
    room?: PopulatedDoc<IRoomDocument>;
    source?: PopulatedDoc<IUserDocument>;
  };
  content?: String;
}

export interface INotificationModel extends IBaseModel<INotificationDocument> {}
export interface INotificationDocument extends IBaseDocument<INotification>, INotification {}

export interface ISendNotificationPayload extends Partial<INotification> {
  email?: string;
  notifications?: INotificationSettings;
}

export interface ISendNotificationOptions {
  sms?: boolean;
  email?: boolean;
  inApp?: boolean;
  createEntity?: boolean;
}
