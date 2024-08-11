import { Plugin, Server, ServerApplicationState, Utils } from '@hapi/hapi';
import { PrismaClient } from '@prisma/client';
import { decodeJwt } from 'jose';
import { PrismaClient as PrismaClientMediamine } from '../../../.prisma/client/mediamine';
import { ApiExtend } from '../../externalServices/zerobounce';
import { validateSort } from '../../utils';
const { v4: uuidv4 } = require('uuid');

interface AuthorizationToken {
  data: { username: string };
}

export const journalistSelectPlugin: Plugin<string> = {
  name: 'journalistSelect',
  version: '1.0.0',
  register: async function (server: Server): Promise<void> {
    const app: ServerApplicationState & { prisma?: PrismaClient; prismaMediamine?: PrismaClientMediamine; validateEmail?: ApiExtend } =
      server.app;

    server.route({
      method: 'GET',
      path: '/journalist-select',
      handler: async (request, h) => {
        const decoded: AuthorizationToken = decodeJwt(request.headers.authorization);

        const sort = 'name:asc';
        const [sortField, sortValue] = sort.split(':');
        const validSort = validateSort(sortField, sortValue);

        const user = await app.prisma?.app_user.findFirstOrThrow({
          select: {
            id: true,
            name: true
          },
          where: {
            username: decoded.data.username
          }
        });

        if (!user?.id) {
          console.error('Unable to find user in database');
          return;
        }

        const journalistSelects = await app.prismaMediamine?.journalist_select.findMany({
          where: {
            user_id: user?.id
          },
          orderBy: validSort ? { [sortField]: sortValue } : { name: 'asc' }
        });

        return h
          .response({
            items: journalistSelects,
            total: journalistSelects?.length
          })
          .code(200);
      }
    });

    server.route({
      method: 'GET',
      path: '/journalist-select/{id}',
      handler: async (request, h) => {
        const decoded: AuthorizationToken = decodeJwt(request.headers.authorization);
        const { id } = request.params as Utils.Dictionary<string>;

        const user = await app.prisma?.app_user.findFirstOrThrow({
          select: {
            id: true,
            name: true
          },
          where: {
            username: decoded.data.username
          }
        });

        if (!user?.id) {
          console.error('Unable to find user in database');
          return;
        }

        const journalistSelect = await app.prismaMediamine?.journalist_select.findFirstOrThrow({
          where: {
            uuid: id,
            user_id: user?.id
          }
        });

        return h
          .response({
            journalistSelect
          })
          .code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/journalist-select',
      handler: async (request, h) => {
        const decoded: AuthorizationToken = decodeJwt(request.headers.authorization);
        const { ids } = request.payload as Utils.Dictionary<string>;

        const user = await app.prisma?.app_user.findFirstOrThrow({
          select: {
            id: true,
            name: true
          },
          where: {
            username: decoded.data.username
          }
        });

        if (!user?.id) {
          console.error('Unable to find user in database');
          return;
        }

        // Create the record in the database
        const journalistSelect = await app.prismaMediamine?.journalist_select.create({
          data: {
            uuid: uuidv4(),
            name: uuidv4(),
            description: uuidv4(),
            user_id: user?.id!,
            search: ids
          }
        });

        return h
          .response({
            journalistSelect
          })
          .code(200);
      }
    });

    server.route({
      method: 'PUT',
      path: '/journalist-select/{id}',
      handler: async (request, h) => {
        const decoded: AuthorizationToken = decodeJwt(request.headers.authorization);
        const { id } = request.params as Utils.Dictionary<string>;
        const { name, description, search } = request.payload as Utils.Dictionary<string>;

        const user = await app.prisma?.app_user.findFirstOrThrow({
          select: {
            id: true,
            name: true
          },
          where: {
            username: decoded.data.username
          }
        });

        if (!user?.id) {
          console.error('Unable to find user in database');
          return;
        }

        const journalistSelectExisting = await app.prismaMediamine?.journalist_select.findFirstOrThrow({
          select: {
            id: true
          },
          where: {
            uuid: id
          }
        });

        // Create the record in the database
        const journalistSelect = await app.prismaMediamine?.journalist_select.update({
          data: {
            name,
            description,
            user_id: user?.id!,
            search
          },
          where: {
            id: journalistSelectExisting?.id
          }
        });

        return h
          .response({
            journalistSelect
          })
          .code(200);
      }
    });

    server.route({
      method: 'DELETE',
      path: '/journalist-select/{id}',
      handler: async (request, h) => {
        const decoded: AuthorizationToken = decodeJwt(request.headers.authorization);
        const { id } = request.params as Utils.Dictionary<string>;

        const user = await app.prisma?.app_user.findFirstOrThrow({
          select: {
            id: true,
            name: true
          },
          where: {
            username: decoded.data.username
          }
        });

        if (!user?.id) {
          console.error('Unable to find user in database');
          return;
        }

        const journalistSelectExisting = await app.prismaMediamine?.journalist_select.findFirstOrThrow({
          where: {
            uuid: id
          }
        });

        const journalist_select = await app.prismaMediamine?.journalist_select.delete({
          where: {
            id: journalistSelectExisting?.id
          }
        });

        return h
          .response({
            journalist_select
          })
          .code(200);
      }
    });
  }
};
