import { Server, ServerApplicationState, Utils } from '@hapi/hapi';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { PrismaClient as PrismaClientMediamine } from '../../.prisma/client/mediamine';
const jwt = require('jsonwebtoken');

exports.plugin = {
  name: 'root',
  version: '1.0.0',
  register: async function (server: Server): Promise<void> {
    const app: ServerApplicationState & { prisma?: PrismaClient; prismaMediamine?: PrismaClientMediamine } = server.app;

    server.route({
      method: 'POST',
      path: '/auth/login',
      options: {
        auth: false
      },
      handler: async (request, h) => {
        const { username, password } = request.payload as Utils.Dictionary<string>;

        if (!(username && password)) {
          return h.response('Please enter a valid username & password').code(401);
        }

        const user = await app.prisma?.app_user.findFirst({
          select: {
            username: true,
            password: true,
            editor: true
          },
          where: {
            username
          }
        });

        if (user?.password !== crypto.createHash('sha256').update(password).digest('hex')) {
          return h.response('Please enter a valid username & password').code(401);
        }

        const token = jwt.sign(
          {
            data: {
              username: user.username
            },
            aud: 'urn:audience:test',
            iss: 'urn:issuer:test',
            sub: '1234567890',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4,
            maxAgeSec: 14400
          },
          process.env.MEDIAMINE_API_KEY
        );

        return h.response({ token, username: user.username, editor: user.editor }).code(200);
      }
    });

    server.route({
      method: 'GET',
      path: '/',
      handler: (): string => 'Hello Mediamine!'
    });

    server.route({
      method: '*',
      path: '/{any*}',
      handler: function (_request, h) {
        return h.response('404 Error! Page Not Found!').code(404);
      }
    });
  }
};
