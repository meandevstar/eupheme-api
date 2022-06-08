import { PopulatedDoc } from 'mongoose';
import { IBaseModel, IBaseDocument } from 'common/types';
import { IUserDocument } from '.';
import formidable from 'formidable';

export enum IMediaType {
  Video = 'video',
  Image = 'image',
}

export interface IMedia {
  creator: PopulatedDoc<IUserDocument>;
  description?: string;
  file?: string;
  type?: IMediaType;
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
  public?: boolean;
}

export interface IMediaUploadResponse {
  thumbnail?: string;
  blurred?: string;
  private?: string;
  public?: string;
}
