import { PopulatedDoc } from 'mongoose';
import { IBaseModel, IBaseDocument } from 'common/types';
import { IUserDocument } from './user.type';

export enum RelationType {
  Flirt = 'FLIRT',
  Report = 'REPORT',
  Favorite = 'FAVORITE',
}

export interface IRelation {
  type: RelationType;
  user: PopulatedDoc<IUserDocument>;
  target: PopulatedDoc<IUserDocument>;
}

export interface IRelationModel extends IBaseModel<IRelationDocument> {}
export interface IRelationDocument extends IBaseDocument<IRelation>, IRelation {}
