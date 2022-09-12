import { PopulatedDoc } from 'mongoose';
import { IBaseModel, IBaseDocument } from 'common/types';
import { IUserDocument } from './user.type';

export enum RequestStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Denied = 'DENIED',
}

export interface IRequest {
  user: PopulatedDoc<IUserDocument>;
  target: PopulatedDoc<IUserDocument>;
  status?: RequestStatus;
  description: string;
}

export interface IRequestModel extends IBaseModel<IRequestDocument> {}
export interface IRequestDocument extends IBaseDocument<IRequest>, IRequest {}
