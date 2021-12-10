import jwt from 'jsonwebtoken';
import config from 'common/config';
import { IAppContext } from 'common/types';
import { IAuthTokenPayload, IAuthTokens } from 'models/types';

/*
 * Issue jwt token with provided payload
 *
 * @param payload   JSON payload to encode
 * @param customSecret    custom secret - use default if not provided
 * @param customExpiresIn   date string - use default if not provided
 *
 * @return  issued token
 */

export async function issueToken<T>(payload: T, customSecret?: string, customExpiresIn?: string): Promise<string> {
  const secret = customSecret || config.jwtSecret;
  const expiresIn = customExpiresIn || config.jwtExpiresIn;
  const algorithm = config.jwtAlgorithm;

  const token = await jwt.sign(payload as any, secret, {
    expiresIn,
    algorithm,
  });
  return token;
}

/**
 * Verify a jwt token
 *
 * @param accessToken   access token to parse
 * @param customSecret    custom secret - use default if not provided
 *
 * @return    parsed JSON object
 */
export async function verifyToken<T>(accessToken: string, customSecret?: string) {
  const secret = (customSecret || config.jwtSecret) as jwt.Secret;
  const algorithm = config.jwtAlgorithm as string;
  const verifyOptions = { algorithms: [algorithm] } as jwt.VerifyOptions;

  const token = ((await jwt.verify(accessToken, secret, verifyOptions)) as unknown) as T;
  return token;
}

/**
 * Get access token and refresh token for provided payload
 *
 * @param context   Application context
 * @param payload   JSON payload
 *
 * @return    auth token and refresh token
 */
export async function getAuthTokens(context: IAppContext, payload: IAuthTokenPayload): Promise<IAuthTokens> {
  const token = await issueToken(payload);
  const refreshToken = await issueToken(payload, config.jwtRefreshSecret, config.jwtRefreshExpiresIn);
  return {
    token,
    refreshToken,
  };
}
