import { PopulatedDoc } from 'mongoose';
import { IBaseModel, IBaseDocument } from 'common/types';
import { IUserDocument } from '.';

export interface IRoom {
  participants: PopulatedDoc<IUserDocument>[];
  creator: PopulatedDoc<IUserDocument>;
  description?: String;
}

export interface IRoomModel extends IBaseModel<IRoomDocument> {}
export interface IRoomDocument extends IBaseDocument<IRoom>, IRoom {}
