import { PopulatedDoc } from 'mongoose';
import { IBaseModel, IBaseDocument } from 'common/types';
import { IUserDocument } from '.';

export interface ISpecialRequest {
  userId: PopulatedDoc<IUserDocument>;
  specialMessage?: string;
  senderid: PopulatedDoc<IUserDocument>;
  status?: string;
  offeredmoney?: number;
}
export interface ISpecialRequestModel extends IBaseModel<ISpecialRequestDocument> {}
export interface ISpecialRequestDocument extends IBaseDocument<ISpecialRequest>, ISpecialRequest {}
