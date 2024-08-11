import axios from 'axios';
import { config } from 'dotenv';
import { ApplicationState, Server } from 'hapi';
import { Api, ResponseSuccess, ResponseType, ValidateResponseSuccess } from 'zerobounce';

config();

export interface ResponseTypeExtend<T extends ResponseSuccess> extends ResponseType<T> {
  email_batch: Array<{ address: string; status: string; sub_status: string }>;
}

export interface ApiExtend extends Api {
  validateBatch: (emails: Array<string> | undefined) => Promise<ResponseTypeExtend<ValidateResponseSuccess>>;
}

export const isEmailStatusValid = (status: string | bigint, subStatus: string | bigint) => {
  if (['valid', 'catch-all', 'unknown'].includes(String(status))) return true;
  if (['do_not_mail'].includes(String(status)) && ['role_based', 'role_based_catch_all'].includes(String(subStatus))) return true;
  return false;
};

exports.plugin = {
  name: 'validateEmail',
  version: '1.0.0',
  register: async function (server: Server) {
    const app: ApplicationState & { validateEmail?: ApiExtend } = server.app;

    if (!process.env.ZEROBOUNCE_API_KEY) {
      console.error('ZEROBOUNCE_API_KEY needs to be defined in env. variables');
      return;
    }

    const validateEmail: ApiExtend = new Api(process.env.ZEROBOUNCE_API_KEY) as ApiExtend;

    validateEmail.validateBatch = async (emails) => {
      if (emails === undefined) {
        return Promise.reject('Emails are undefined');
      }
      return (
        await axios.post('https://bulkapi.zerobounce.net/v2/validatebatch', {
          api_key: process.env.ZEROBOUNCE_API_KEY,
          email_batch: emails.map((e) => ({ email_address: e }))
        })
      ).data;
    };

    app.validateEmail = validateEmail;

    server.ext({
      type: 'onPostStop',
      method: async (server: Server) => {
        const app: ApplicationState & { validateEmail?: Api } = server.app;
        app.validateEmail = new Api(process.env.ZEROBOUNCE_API_KEY!);
      }
    });
  }
};

// TODO: remove
// const response = await axios.get('https://api.zerobounce.net/v2/validate', {
//   params: {
//     // TODO: replace with journalist.email
//     email: 'disposable@example.com',
//     api_key: '9134f6efb131496bb515468c376cf68f',
//     timeout: 10
//   }
// });
