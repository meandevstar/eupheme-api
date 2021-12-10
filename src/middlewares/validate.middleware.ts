import { Response, NextFunction } from 'express';
import { IRequest, RequestSource } from 'common/types';
import { Joi } from 'common/utils';
import { AnySchema } from 'joi';

/**
 * Validate incoming requests
 *
 * @param schemaObject    Joi object schema
 * @param source   Specifies validation target in request object
 * @param relation   Specifies Joi validation keys relation
 */

export default function(schemaObject: any, source?: RequestSource, relation?: any) {
  return async function(req: IRequest, res: Response, next: NextFunction) {
    let payload;

    try {
      if (source === 'body') {
        payload = req.body;
      } else if (source === 'params') {
        payload = req.params;
      } else if (source === 'query') {
        payload = req.query;
      } else {
        payload = Object.assign({}, req.params || {}, req.query || {}, req.body || {});
      }

      let schema: AnySchema = Joi.object().keys(schemaObject);

      // if (relation) {
      //   for (const { key, params } of relation) {
      //     joiObject = joiObject[key](...params);
      //   }
      // }

      req.context.payload = await schema.validateAsync(payload);

      next();
    } catch (error) {
      next(error);
    }
  };
}
