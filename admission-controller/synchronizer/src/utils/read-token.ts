import pino from "pino";
import {readFileSync} from "fs";

export function readToken(path: string, logger: ReturnType<typeof pino>) {
  try {
    const tokenRaw = readFileSync(path);
    const token = tokenRaw.toString();

    return token;
  } catch (err) {
    logger.error({msg: 'Failed to read token', err});
    return null;
  }
}
