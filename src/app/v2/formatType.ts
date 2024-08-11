import { Plugin, RequestQuery, Server, ServerApplicationState, Utils } from '@hapi/hapi';
import { PrismaClient as PrismaClientMediamine } from '../../../.prisma/client/mediamine';
import { validateSort } from '../../utils';
const { v4: uuidv4 } = require('uuid');

export const formatTypePlugin: Plugin<string> = {
  name: 'formatType',
  version: '1.0.0',
  register: async function (server: Server): Promise<void> {
    const app: ServerApplicationState & { prismaMediamine?: PrismaClientMediamine } = server.app;

    server.route({
      method: 'GET',
      path: '/format-type',
      handler: async (request, h) => {
        const { marker = '0', limit = '20', sort = '', name = '' } = request.query as RequestQuery;
        const [sortField, sortValue] = sort.split(':');
        const validSort = validateSort(sortField, sortValue);

        const formatTypes = await app.prismaMediamine?.format_type.findMany({
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
            items: formatTypes?.slice(Number(marker), Number(marker) + Number(limit)),
            marker,
            limit,
            total: formatTypes?.length
          })
          .code(200);
      }
    });

    server.route({
      method: 'GET',
      path: '/format-type/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;

        const formatType = await app.prismaMediamine?.format_type.findFirstOrThrow({
          where: {
            uuid: id
          }
        });

        return h
          .response({
            formatType
          })
          .code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/format-type',
      handler: async (request, h) => {
        const { name, description } = request.payload as Utils.Dictionary<string>;

        // Create the record in the database
        const formatType = await app.prismaMediamine?.format_type.create({
          data: {
            uuid: uuidv4(),
            name,
            description
          }
        });

        return h
          .response({
            formatType
          })
          .code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/format-type/batch',
      handler: async (request, h) => {
        const payload = request.payload as Array<Utils.Dictionary<string>>;

        // Create the records in the database
        const formatTypes = await app.prismaMediamine?.format_type.createMany({
          data: payload.map(({ name, description }) => ({
            uuid: uuidv4(),
            name,
            description
          }))
        });

        return h
          .response({
            formatTypes
          })
          .code(200);
      }
    });

    server.route({
      method: 'PUT',
      path: '/format-type/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;
        const { name, description } = request.payload as Utils.Dictionary<string>;

        const formatTypeExisting = await app.prismaMediamine?.format_type.findFirstOrThrow({
          select: {
            id: true
          },
          where: {
            uuid: id
          }
        });

        const formatType = await app.prismaMediamine?.format_type.update({
          data: {
            name,
            description
          },
          where: {
            id: formatTypeExisting?.id
          }
        });

        return h
          .response({
            formatType
          })
          .code(200);
      }
    });

    server.route({
      method: 'DELETE',
      path: '/format-type/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;

        const formatTypeExisting = await app.prismaMediamine?.format_type.findFirstOrThrow({
          where: {
            uuid: id
          }
        });

        const formatType = await app.prismaMediamine?.format_type.delete({
          where: {
            id: formatTypeExisting?.id
          }
        });

        return h
          .response({
            formatType
          })
          .code(200);
      }
    });
  }
};
