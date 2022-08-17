import { Schema } from 'mongoose';
import { IRoomModel, IRoomDocument } from 'models/types';
import { IBaseSchema } from 'common/types';

const roomSchema = new IBaseSchema<IRoomDocument, IRoomModel>({
  creator: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  participants: [
    {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
  ],
  description: String,
});

roomSchema.index({ participants: 1 });

export default roomSchema;