import { IBaseModel, IBaseDocument } from 'common/types';
import { INotificationSettings } from './notification.type';

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

export enum Pronoun {
  He = 'HE',
  She = 'SHE',
  They = 'THEY',
  Other = 'OTHER',
}

export interface IUser {
  email: string;
  username: string;
  name?: string;  // Legal Name
  displayName?: string;
  pronoun?: Pronoun;
  timezone: string;
  type?: UserType;
  status?: UserStatus;
  loggedCount?: number;
  password?: string;
  avatar?: string;
  dob?: Date;
  bio?: string;
  phone?: string;
  idUrl?: string;
  workingHours: IWorkingHour[];
  notifications?: INotificationSettings;
}

export interface IWorkingHour {
  start: Date;
  end: Date;
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

