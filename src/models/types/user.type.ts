import { IBaseModel, IBaseDocument } from 'common/types';

export enum UserType {
  Admin = 'ADMIN',
  User = 'USER',
  Creator = 'CREATOR',
}

export enum UserStatus {
  Active = 'ACTIVE',
  Disabled = 'DISABLED',
  Pending = 'PENDING',
}

export interface IUser {
  email: string;
  username: string;
  name?: string;
  timezone: string;
  type?: UserType;
  status?: UserStatus;
  loggedCount?: number;
  password?: string;
  avatar?: string;
  dob?: Date;
  phone?: string;
}

export interface IUserModel extends IBaseModel<IUserDocument> {}

export interface IUserDocument extends IBaseDocument<IUser>, IUser {
  getToken?: () => string;
  verifyPassword?: (password: string) => boolean;
}

export interface IAuthTokenPayload {
  id: string;
  type: UserType;
  email: string;
  iat?: number;
}

export interface IAuthTokens {
  id?: string;
  token: string;
  refreshToken: string;
}

export interface ILoginPayload {
  email?: string;
  password?: string;
  timezone?: string;
  user?: string;
}

export interface IRegisterUserPayload extends ILoginPayload {
  name: string;
  username: string;
  dob: string;
}

