import config from 'common/config';
import sgMail from '@sendgrid/mail';
import { IEmailPayload } from 'common/types';
import logger from './logger.module';

sgMail.setApiKey(config.sendgridApiKey);

const MODULE = 'EMAIL';

/**
 * Send email
 */
export async function sendEmail(payload: IEmailPayload) {
  const recipients =
    typeof payload.recipients === 'string' ? payload.recipients.split(',') : payload.recipients;

  const message = {
    to: recipients,
    from: config.notifyEmail,
    name: config.notifyEmailName,
    replyTo: payload.replyTo,
    subject: payload.subject,
    text: payload.text,
    html: payload.body,
  };

  try {
    await sgMail.send(message);
  } catch (error) {
    logger.log('Something went wrong', { MODULE, error });
  }
}