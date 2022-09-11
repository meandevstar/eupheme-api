import { Schema } from 'mongoose';
import { IFlirtRequestDocument, IFlirtRequestModel } from 'models/types';
import { IBaseSchema } from 'common/types';

const flirtRequestSchema = new IBaseSchema<IFlirtRequestDocument, IFlirtRequestModel>({
  fromId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  toid: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  flirtback: { type: Boolean, default: false },
});

flirtRequestSchema.index({ toid: 1 });

export default flirtRequestSchema;
