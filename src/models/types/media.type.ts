import { PopulatedDoc } from 'mongoose';
import { IBaseModel, IBaseDocument } from 'common/types';
import { IUserDocument } from '.';

export interface IMedia {
  creator: PopulatedDoc<IUserDocument>;
  description?: string;
  file: string;
  thumbnail?: string;
  name: string;
  private?: boolean;
  storyCount?: number;
}

export interface IMediaModel extends IBaseModel<IMediaDocument> {}
export interface IMediaDocument extends IBaseDocument<IMedia>, IMedia {}