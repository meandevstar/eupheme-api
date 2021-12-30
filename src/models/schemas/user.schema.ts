// grab the mongoose module
import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import pick from 'lodash/pick';
import Config from 'common/config';
import {
  UserStatus,
  IUserDocument,
  IUserModel,
  UserType,
} from 'models/types';
import { IBaseSchema } from 'common/types';

const userSchema = new IBaseSchema<IUserDocument, IUserModel>({
  username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  type: {
    type: String,
    enum: Object.values(UserType),
    default: UserType.User,
  },
  name: String,
  password: String,
  avatar: String,
  status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.Pending,
  },
  loggedCount: {
    type: Number,
    default: 0,
  },
  timezone: String,
  phone: String,
  dob: Date,
  idUrl: String,
});

userSchema.statics.getPublicData = function (doc: IUserDocument, grant?: UserType) {
  const payload = doc.toJSON ? doc.toJSON({ virtuals: true }) : doc;
  const allowedFields = [
    'id',
    'email',
    'name',
    'avatar',
    'timezone',
    'phone',
    'type',
    'status',
  ];

  if (!grant || grant === UserType.Admin) {
    allowedFields.push('dob', 'name', 'phone');
  }
  return pick(payload, allowedFields);
};

userSchema.methods.verifyPassword = function (password: string) {
  const pwdHash = createHash('sha256', Config.pwdSecret).update(password).digest('base64');
  return this.password === pwdHash;
};

userSchema.methods.getToken = function () {
  const payload = {
    id: this.id,
    email: this.email,
    type: this.type,
  };
  return jwt.sign(payload, Config.jwtSecret, Config.jwtAuthExpires);
};

userSchema.pre<IUserDocument>('save', function (next) {
  this.email = this.email.toLowerCase().trim();

  if (this.modifiedPaths().includes('password')) {
    this.password = createHash('sha256', Config.pwdSecret).update(this.password).digest('base64');
  }

  next();
});

userSchema.index({ username: 1 });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({
  email: 'text',
  username: 'text',
  type: 'text',
});
userSchema.index({ status: 1 });
userSchema.index({ createdAt: 1 });
userSchema.index({ updatedAt: 1 });

export default userSchema;
