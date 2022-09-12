import { PopulatedDoc } from 'mongoose';
import {  IBaseModel,IBaseDocument } from 'common/types';
import { IUserDocument } from '.';
 
 

export interface ISpecialRequest {
  userId: PopulatedDoc<IUserDocument>;
  message?: string;
  offermoney?: number;
  senderid?:PopulatedDoc<IUserDocument>;
}
export interface ISpecialRequestModel extends IBaseModel<ISpecialRequestDocument> {}
 export interface ISpecialRequestDocument extends IBaseDocument<ISpecialRequest>, ISpecialRequest {}

