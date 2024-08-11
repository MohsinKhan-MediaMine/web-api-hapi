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

export const journalistSearchPlugin: Plugin<string> = {
  name: 'journalistSearch',
  version: '1.0.0',
  register: async function (server: Server): Promise<void> {
    const app: ServerApplicationState & { prisma?: PrismaClient; prismaMediamine?: PrismaClientMediamine; validateEmail?: ApiExtend } =
      server.app;

    server.route({
      method: 'GET',
      path: '/journalist-search',
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

        const journalistSearchs = await app.prismaMediamine?.journalist_search.findMany({
          where: {
            user_id: user?.id
          },
          orderBy: validSort ? { [sortField]: sortValue } : { name: 'asc' }
        });

        return h
          .response({
            items: journalistSearchs,
            total: journalistSearchs?.length
          })
          .code(200);
      }
    });

    server.route({
      method: 'GET',
      path: '/journalist-search/{id}',
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

        const journalistSearch = await app.prismaMediamine?.journalist_search.findFirstOrThrow({
          where: {
            uuid: id,
            user_id: user?.id
          }
        });

        return h
          .response({
            journalistSearch
          })
          .code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/journalist-search',
      handler: async (request, h) => {
        const decoded: AuthorizationToken = decodeJwt(request.headers.authorization);
        const { name, description, search, journalists } = request.payload as Utils.Dictionary<string>;

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
        const journalistSearch = await app.prismaMediamine?.journalist_search.create({
          data: {
            uuid: uuidv4(),
            name,
            description,
            user_id: user?.id!,
            search,
            journalists
          }
        });

        return h
          .response({
            journalistSearch
          })
          .code(200);
      }
    });

    server.route({
      method: 'PUT',
      path: '/journalist-search/{id}',
      handler: async (request, h) => {
        const decoded: AuthorizationToken = decodeJwt(request.headers.authorization);
        const { id } = request.params as Utils.Dictionary<string>;
        const { name, description, search, journalists } = request.payload as Utils.Dictionary<string>;

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

        const journalistSearchExisting = await app.prismaMediamine?.journalist_search.findFirstOrThrow({
          select: {
            id: true
          },
          where: {
            uuid: id
          }
        });

        // Create the record in the database
        const journalistSearch = await app.prismaMediamine?.journalist_search.update({
          data: {
            name,
            description,
            user_id: user?.id!,
            search,
            journalists
          },
          where: {
            id: journalistSearchExisting?.id
          }
        });

        return h
          .response({
            journalistSearch
          })
          .code(200);
      }
    });

    server.route({
      method: 'DELETE',
      path: '/journalist-search/{id}',
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

        const journalistSearchExisting = await app.prismaMediamine?.journalist_search.findFirstOrThrow({
          where: {
            uuid: id
          }
        });

        const journalist = await app.prismaMediamine?.journalist_search.delete({
          where: {
            id: journalistSearchExisting?.id
          }
        });

        return h
          .response({
            journalist
          })
          .code(200);
      }
    });
  }
};
