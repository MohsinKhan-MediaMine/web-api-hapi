import { Plugin, RequestQuery, Server, ServerApplicationState, Utils } from '@hapi/hapi';
import { PrismaClient as PrismaClientMediamine } from '../../../.prisma/client/mediamine';
import { validateSort } from '../../utils';
const { v4: uuidv4 } = require('uuid');

export const newsTypePlugin: Plugin<string> = {
  name: 'newsType',
  version: '1.0.0',
  register: async function (server: Server): Promise<void> {
    const app: ServerApplicationState & { prismaMediamine?: PrismaClientMediamine } = server.app;

    server.route({
      method: 'GET',
      path: '/news-type',
      handler: async (request, h) => {
        const { marker = '0', limit = '100', sort = '', name = '' } = request.query as RequestQuery;
        const [sortField, sortValue] = sort.split(':');
        const validSort = validateSort(sortField, sortValue);

        const newsTypes = await app.prismaMediamine?.news_type.findMany({
          where: {
            name: {
              contains: name,
              mode: 'insensitive'
            }
          },
          orderBy: validSort ? { [sortField]: sortValue } : { name: 'asc' }
        });

        return h
          .response({
            items: newsTypes?.slice(Number(marker), Number(marker) + Number(limit)),
            marker,
            limit,
            total: newsTypes?.length
          })
          .code(200);
      }
    });

    server.route({
      method: 'GET',
      path: '/news-type/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;

        const newsType = await app.prismaMediamine?.news_type.findFirstOrThrow({
          where: {
            uuid: id
          }
        });

        return h
          .response({
            newsType
          })
          .code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/news-type',
      handler: async (request, h) => {
        const { name, description } = request.payload as Utils.Dictionary<string>;

        // Create the record in the database
        const newsType = await app.prismaMediamine?.news_type.create({
          data: {
            uuid: uuidv4(),
            name,
            description
          }
        });

        return h
          .response({
            newsType
          })
          .code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/news-type/batch',
      handler: async (request, h) => {
        const payload = request.payload as Array<Utils.Dictionary<string>>;

        // Create the records in the database
        const newsTypes = await app.prismaMediamine?.news_type.createMany({
          data: payload.map(({ name, description }) => ({
            uuid: uuidv4(),
            name,
            description
          }))
        });

        return h
          .response({
            newsTypes
          })
          .code(200);
      }
    });

    server.route({
      method: 'PUT',
      path: '/news-type/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;
        const { name, description } = request.payload as Utils.Dictionary<string>;

        const newsTypeExisting = await app.prismaMediamine?.news_type.findFirstOrThrow({
          select: {
            id: true
          },
          where: {
            uuid: id
          }
        });

        const newsType = await app.prismaMediamine?.news_type.update({
          data: {
            name,
            description
          },
          where: {
            id: newsTypeExisting?.id
          }
        });

        return h
          .response({
            newsType
          })
          .code(200);
      }
    });

    server.route({
      method: 'DELETE',
      path: '/news-type/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;

        const newsTypeExisting = await app.prismaMediamine?.news_type.findFirstOrThrow({
          where: {
            uuid: id
          }
        });

        const newsType = await app.prismaMediamine?.news_type.delete({
          where: {
            id: newsTypeExisting?.id
          }
        });

        return h
          .response({
            newsType
          })
          .code(200);
      }
    });
  }
};
