import { PopulatedDoc } from 'mongoose';
import { IBaseModel, IBaseDocument } from 'common/types';
import { IUserDocument } from '.';

export interface IFlirtRequest {
  fromId: PopulatedDoc<IUserDocument>;
  flirtback?: boolean;
  toid?: PopulatedDoc<IUserDocument>;
}
export interface IFlirtRequestModel extends IBaseModel<IFlirtRequestDocument> {}
export interface IFlirtRequestDocument extends IBaseDocument<IFlirtRequest>, IFlirtRequest {}
