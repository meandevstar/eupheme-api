import OpenTok from 'opentok';
import { promisify } from 'util';

const apiKey = process.env.OPENTOK_API_KEY;
const apiSecret = process.env.OPENTOK_API_SECRET;
const opentok = new OpenTok(apiKey, apiSecret);

export const createSession = promisify(opentok.createSession).bind(opentok);
export const generateToken = opentok.generateToken.bind(opentok);
