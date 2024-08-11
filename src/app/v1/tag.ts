import { Plugin, RequestQuery, Server, ServerApplicationState, Utils } from '@hapi/hapi';
import { PrismaClient } from '@prisma/client';
import { validateSort } from '../../utils';

export const tagPlugin: Plugin<string> = {
  name: 'tag',
  version: '1.0.0',
  register: async function (server: Server) {
    const app: ServerApplicationState & { prisma?: PrismaClient } = server.app;

    server.route({
      method: 'GET',
      path: '/tag',
      handler: async (request, h) => {
        const { marker = '0', limit = '100', sort = '', name = '' } = request.query as RequestQuery;
        const [sortField, sortValue] = sort.split(':');
        const validSort = validateSort(sortField, sortValue);

        const tags = await app.prisma?.tag.findMany({
          select: {
            id: true,
            name: true
          },
          where: {
            name: {
              contains: name
            }
          },
          orderBy: validSort ? { [sortField]: sortValue } : { name: 'asc' }
        });

        return h
          .response({
            items: tags?.slice(Number(marker), Number(marker) + Number(limit)),
            total: tags?.length
          })
          .code(200);
      }
    });

    server.route({
      method: 'GET',
      path: '/tag/related/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;

        const tag_tags = await app.prisma?.tag_tag.findMany({
          where: {
            tag_id: Number(id)
          }
        });

        return h
          .response({
            items: tag_tags,
            total: tag_tags?.length
          })
          .code(200);
      }
    });
  }
};
