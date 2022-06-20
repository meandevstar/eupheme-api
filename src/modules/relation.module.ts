import { IAppContext, IQueryPayload, StatusCode } from 'common/types';
import { createError } from 'common/utils';
import { RelationType } from 'models/types';

export async function createRelation(context: IAppContext, userId: string, type: RelationType) {
  const {
    conn: { User, Relation },
    user,
  } = context;

  const target = await User.findById(userId).select('_id').lean();
  if (!target) {
    throw createError(StatusCode.BAD_REQUEST, 'Target does not exists');
  }

  await Relation.updateOne(
    {
      user: user.id,
      target: userId,
      type,
    },
    {
      user: user.id,
      target: userId,
      type,
    },
    {
      upsert: true,
    }
  );
}

export async function getRelations(
  context: IAppContext,
  type: RelationType,
  payload: IQueryPayload
) {
  if (type === RelationType.Report) {
    throw createError(StatusCode.BAD_REQUEST, 'You can only view flirts and favorites');
  }
  const {
    conn: { Relation },
    user,
  } = context;

  const relationQuery: any = {};
  const { pagination, sort } = payload;
  let select: 'target' | 'user';

  if (type === RelationType.Favorite) {
    relationQuery.user = user.id;
    select = 'target';
  } else {
    relationQuery.target = user.id;
    select = 'user';
  }

  const countAction = Relation.find(relationQuery).countDocuments();
  let queryAction = Relation.find(relationQuery).populate(select);
  if (sort) {
    queryAction = queryAction.sort(sort);
  }
  if (pagination) {
    queryAction = queryAction.skip(pagination.offset * pagination.limit).limit(pagination.limit);
  }

  const [total, relations] = await Promise.all([countAction, queryAction.lean({ virtuals: true })]);

  return {
    total,
    data: relations.map(relation => relation[select])
  };
}
