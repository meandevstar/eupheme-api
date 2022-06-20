import { Schema } from 'mongoose';
import { IRelationDocument, IRelationModel, RelationType } from 'models/types';
import { IBaseSchema } from 'common/types';

const relationSchema = new IBaseSchema<IRelationDocument, IRelationModel>({
  target: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  user: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  type: {
    type: String,
    enum: Object.values(RelationType),
    required: true,
  },
});

relationSchema.index({ user: 1, type: 1, status: 1 });

export default relationSchema;
