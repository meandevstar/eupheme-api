import { PopulatedDoc } from 'mongoose';
import { IBaseModel, IBaseDocument } from 'common/types';
import { IUserDocument } from '.';
import formidable from 'formidable';

export interface IMedia {
  creator: PopulatedDoc<IUserDocument>;
  description?: string;
  file?: string;
  thumbnail?: string;
  blurred?: string;
  name: string;
  private?: boolean;
  storyCount?: number;
}

export interface IMediaModel extends IBaseModel<IMediaDocument> {}
export interface IMediaDocument extends IBaseDocument<IMedia>, IMedia {}

export interface IMediaUploadPayload {
  name: string;
  description: string;
  file: formidable.File;
  isPublic?: boolean;
}

export interface IMediaUploadResponse {
  thumbnail?: string;
  blurred?: string;
  private?: string;
  public?: string;
}
