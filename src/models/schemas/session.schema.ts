import { Types } from 'mongoose';
import {
  ISessionDocument,
  ISessionModel,
  SessionStatus,
  SessionType,
} from 'models/types';
import { IBaseSchema } from 'common/types';

const sessionSchema = new IBaseSchema<ISessionDocument, ISessionModel>({
  type: {
    type: String,
    enum: Object.values(SessionType),
    default: SessionType.Video,
  },
  status: {
    type: String,
    enum: Object.values(SessionStatus),
    default: SessionStatus.Pending,
  },
  participants: [{
    type: Types.ObjectId,
    ref: 'User',
  }],
  otId: String,
  startTime: Date,
  endTime: Date,
});

sessionSchema.index({ participants: 1, type: 1, status: 1 });

export default sessionSchema;
