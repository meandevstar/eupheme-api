import { Schema } from 'mongoose';
import {
    ISpecialRequestDocument,
    ISpecialRequestModel
 } from 'models/types';
import { IBaseSchema } from 'common/types';

const specialRequestSchema = new IBaseSchema<ISpecialRequestDocument,ISpecialRequestModel>({
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
 
  message: String,
  offermoney: Number,
});

specialRequestSchema.index({ creator: 1 });

export default specialRequestSchema;
