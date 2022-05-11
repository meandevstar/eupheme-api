import { Schema } from 'mongoose';
import { IMediaDocument, IMediaModel } from 'models/types';
import { IBaseSchema } from 'common/types';

const mediaSchema = new IBaseSchema<IMediaDocument, IMediaModel>({
  creator: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  description: String,
  file: String,
  thumbnail: String,
  blurred: String,
  name: String,
  private: Boolean,
  storyCount: Number,
});

mediaSchema.index({ creator: 1 });

export default mediaSchema;
