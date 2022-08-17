import Joi from 'joi';
import { Router, Request } from 'express';
import omit from 'lodash/omit';
import {
  IUserModel,
  IUserDocument,
  IAuthTokenPayload,
  UserType,
  ISessionModel,
  IMessageModel,
  INotificationModel,
  IRoomModel,
  IMediaModel,
} from 'models/types';

const mongooseLeanVirtuals = require('mongoose-lean-virtuals');

export enum StatusCode {
  CREATED = 201,
  ACCEPTED = 202,
  BAD_GATEWAY = 502,
  BAD_REQUEST = 400,
  CONFLICT = 409,
  CONTINUE = 100,
  DELETED = 208,
  EXPECTATION_FAILED = 417,
  FAILED_DEPENDENCY = 424,
  FORBIDDEN = 403,
  GATEWAY_TIMEOUT = 504,
  GONE = 410,
  HTTP_VERSION_NOT_SUPPORTED = 505,
  INSUFFICIENT_SPACE_ON_RESOURCE = 419,
  INSUFFICIENT_STORAGE = 507,
  INTERNAL_SERVER_ERROR = 500,
  LENGTH_REQUIRED = 411,
  LOCKED = 423,
  METHOD_FAILURE = 420,
  METHOD_NOT_ALLOWED = 405,
  MOVED_PERMANENTLY = 301,
  MOVED_TEMPORARILY = 302,
  MULTI_STATUS = 207,
  MULTIPLE_CHOICES = 300,
  NETWORK_AUTHENTICATION_REQUIRED = 511,
  NO_CONTENT = 204,
  NON_AUTHORITATIVE_INFORMATION = 203,
  NOT_ACCEPTABLE = 406,
  NOT_FOUND = 404,
  NOT_IMPLEMENTED = 501,
  NOT_MODIFIED = 304,
  OK = 200,
  PARTIAL_CONTENT = 206,
  PAYMENT_REQUIRED = 402,
  PERMANENT_REDIRECT = 308,
  PRECONDITION_FAILED = 412,
  PRECONDITION_REQUIRED = 428,
  PROCESSING = 102,
  PROXY_AUTHENTICATION_REQUIRED = 407,
  REQUEST_HEADER_FIELDS_TOO_LARGE = 431,
  REQUEST_TIMEOUT = 408,
  REQUEST_TOO_LONG = 413,
  REQUEST_URI_TOO_LONG = 414,
  REQUESTED_RANGE_NOT_SATISFIABLE = 416,
  RESET_CONTENT = 205,
  SEE_OTHER = 303,
  SERVICE_UNAVAILABLE = 503,
  SWITCHING_PROTOCOLS = 101,
  TEMPORARY_REDIRECT = 307,
  TOO_MANY_REQUESTS = 429,
  UNAUTHORIZED = 401,
  UNPROCESSABLE_ENTITY = 422,
  UNSUPPORTED_MEDIA_TYPE = 415,
  USE_PROXY = 305,
}

export enum SortDirection {
  asc = 1,
  desc = -1,
}

import {
  Connection,
  Model,
  Document,
  Types,
  LeanDocument,
  Schema,
  SchemaDefinition,
  SchemaDefinitionType,
  SchemaOptions,
} from 'mongoose';

export interface IDBConnectionMap {
  [key: string]: IConnection;
}

export interface IConnection extends Connection {
  User?: IUserModel;
  Session?: ISessionModel;
  Room?: IRoomModel;
  Message?: IMessageModel;
  Media?: IMediaModel;
  Notification?: INotificationModel;
}

export interface IBaseModel<T> extends Model<T> {
  getPublicData?: (doc: T | LeanDocument<T>, grant?: UserType) => Partial<T | LeanDocument<T>>;
}

export interface IBaseDocument<T> extends Document<Types.ObjectId, any, T> {
  beautify?: () => { id: string } & Partial<T | LeanDocument<T>>;
  createdAt?: Date;
  updatedAt?: Date;
}

export class IBaseSchema<T, S> extends Schema<T, S> {
  constructor(definition?: SchemaDefinition<SchemaDefinitionType<T>>, options: SchemaOptions = {}) {
    const newOptions = {
      timestamps: true,
      versionKey: false,
      autoIndex: process.env.CREATE_MONGO_INDEXES === '1',
      ...options,
    };
    super(definition, newOptions);

    this.plugin(mongooseLeanVirtuals);

    this.methods.beautify = function () {
      return omit(this.toObject({ virtuals: true }), ['_id']);
    };
  }
}

export interface IAppContext {
  conn: IConnection;
  user?: IUserDocument;
  payload?: any;
}

export interface IRequest extends Request {
  auth?: IAuthTokenPayload;
  context?: IAppContext;
  redirected?: boolean;
}

export interface IApiResponse {
  message: string;
  data?: any;
  error?: any;
}

export interface IRoute {
  path?: string;
  router: Router;
  exRouter: any;
}

export type RequestSource = 'params' | 'query' | 'body';

export interface IQueryPayload {
  query?: any;
  pagination?: IPaginationPayload;
  sort?: string | ISortPayload;
  select?: ISelectPayload;
  populate?: [
    {
      path: string;
      select?: string;
    }
  ];
}

export interface ISelectPayload {
  [key: string]: 1 | -1;
}

export interface IPaginationPayload {
  offset: number;
  limit: number;
}

export interface ISortPayload {
  [key: string]: SortDirection;
}

export interface IPaginationResponse<T> {
  total?: number;
  data: T[];
}

export interface IJoi {
  string: () => IAnySchema;
  number: () => IAnySchema;
  array: () => IAnySchema;
  object: (schema?: any) => IAnySchema;
  [key: string]: any;
}

type AnySchema = Joi.StringSchema & Joi.NumberSchema & Joi.ArraySchema & Joi.ObjectSchema;
export interface IAnySchema extends AnySchema {
  errorTranslate: (code: StatusCode, key: string, data?: any) => AnySchema;
  [key: string]: any;
}

export interface IJoiErrorMeta {
  trError: {
    code: StatusCode;
    key: string;
    data: any;
  };
}

export type LogAction = 'log' | 'info' | 'warn' | 'error';

export type Environment = 'development' | 'production';

export enum ConnType {
  Default = 'Default',
  Background = 'Background',
  User = 'User',
  Session = 'Session',
  Chats = 'Chats',
  Profile = 'Profile',
}

export enum RouterConfig {
  Default = ConnType.Default,
  User = ConnType.User,
  Session = ConnType.Session,
  Chats = ConnType.Chats,
  Profile = ConnType.Profile,
}

export enum ErrorModule {
  User = 'USER',
  General = 'GENERAL',
}

export interface IRedisLockOptions {
  timeout?: number;
  retries?: number;
  delay?: number;
}

export enum RedisKey {
  UserPrefix = 'user',
  OnlineUsers = 'online_users',
}

export interface IEmailPayload {
  subject: string;
  body: string;
  replyTo?: string;
  recipients: string | string[];
  text?: string;
}
