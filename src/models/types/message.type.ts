import { PopulatedDoc } from 'mongoose';
import { IBaseModel, IBaseDocument } from 'common/types';
import { IRoomDocument } from './room.type';
import { IUserDocument } from './user.type';

export enum MessageType {
  Text = 'TEXT',
  File = 'FILE',
}

export enum MessageStatus {
  Unread = 'UNREAD',
  Read = 'READ',
}

export interface IMessage {
  user: PopulatedDoc<IUserDocument>;
  room: PopulatedDoc<IRoomDocument>;
  type?: MessageType;
  status?: MessageStatus;
  content: string;
}

export interface IMessageModel extends IBaseModel<IMessageDocument> {}
export interface IMessageDocument extends IBaseDocument<IMessage>, IMessage {}
