import { IncomingMessage } from 'http';
import pino from 'pino';

type FormattedLog = {
  msg: string
  error: string | undefined
  errorDetails: any | undefined
  responseStatus: number | undefined
  responseMessage: string | undefined
};

const logger = pino({
  name: 'Monokle:Init',
});

export function formatLog(msg: string, err?: any, res?: {response: IncomingMessage}): FormattedLog {
  return {
    msg,
    error: err?.message,
    errorDetails: err?.body,
    responseStatus: res?.response?.statusCode,
    responseMessage: res?.response?.statusMessage,
  }
}

export default logger;
