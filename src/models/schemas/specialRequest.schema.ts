import { Schema } from 'mongoose';
import {
  ISpecialRequestDocument,
  ISpecialRequestModel,
  SpecialRequestStatus,
  UserStatus,
} from 'models/types';
import { IBaseSchema } from 'common/types';

const specialRequestSchema = new IBaseSchema<ISpecialRequestDocument, ISpecialRequestModel>({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  senderid: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  specialMessage: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(SpecialRequestStatus),
    default: SpecialRequestStatus.Pending,
  },
  offeredmoney: {
    type: Number,
    required: false,
  },
});

specialRequestSchema.index({ creator: 1 });

export default specialRequestSchema;
