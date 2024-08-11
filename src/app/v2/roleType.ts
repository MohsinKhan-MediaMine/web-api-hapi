import { Plugin, RequestQuery, Server, ServerApplicationState, Utils } from '@hapi/hapi';
import { PrismaClient as PrismaClientMediamine } from '../../../.prisma/client/mediamine';
import { validateSort } from '../../utils';
const { v4: uuidv4 } = require('uuid');

export const roleTypePlugin: Plugin<string> = {
  name: 'roleType',
  version: '1.0.0',
  register: async function (server: Server): Promise<void> {
    const app: ServerApplicationState & { prismaMediamine?: PrismaClientMediamine } = server.app;

    server.route({
      method: 'GET',
      path: '/role-type',
      handler: async (request, h) => {
        const { marker = '0', limit = '100', sort = '', name = '' } = request.query as RequestQuery;
        const [sortField, sortValue] = sort.split(':');
        const validSort = validateSort(sortField, sortValue);

        const roleTypes = await app.prismaMediamine?.role_type.findMany({
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
            items: roleTypes?.slice(Number(marker), Number(marker) + Number(limit)),
            marker,
            limit,
            total: roleTypes?.length
          })
          .code(200);
      }
    });

    server.route({
      method: 'GET',
      path: '/role-type/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;

        const roleType = await app.prismaMediamine?.role_type.findFirstOrThrow({
          where: {
            uuid: id
          }
        });

        return h
          .response({
            roleType
          })
          .code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/role-type',
      handler: async (request, h) => {
        const { name, description } = request.payload as Utils.Dictionary<string>;

        // Create the record in the database
        const roleType = await app.prismaMediamine?.role_type.create({
          data: {
            uuid: uuidv4(),
            name,
            description
          }
        });

        return h
          .response({
            roleType
          })
          .code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/role-type/batch',
      handler: async (request, h) => {
        const payload = request.payload as Array<Utils.Dictionary<string>>;

        // Create the records in the database
        const roleTypes = await app.prismaMediamine?.role_type.createMany({
          data: payload.map(({ name, description }) => ({
            uuid: uuidv4(),
            name,
            description
          }))
        });

        return h
          .response({
            roleTypes
          })
          .code(200);
      }
    });

    server.route({
      method: 'PUT',
      path: '/role-type/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;
        const { name, description } = request.payload as Utils.Dictionary<string>;

        const roleTypeExisting = await app.prismaMediamine?.role_type.findFirstOrThrow({
          select: {
            id: true
          },
          where: {
            uuid: id
          }
        });

        const roleType = await app.prismaMediamine?.role_type.update({
          data: {
            name,
            description
          },
          where: {
            id: roleTypeExisting?.id
          }
        });

        return h
          .response({
            roleType
          })
          .code(200);
      }
    });

    server.route({
      method: 'DELETE',
      path: '/role-type/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;

        const roleTypeExisting = await app.prismaMediamine?.role_type.findFirstOrThrow({
          where: {
            uuid: id
          }
        });

        const roleType = await app.prismaMediamine?.role_type.delete({
          where: {
            id: roleTypeExisting?.id
          }
        });

        return h
          .response({
            roleType
          })
          .code(200);
      }
    });
  }
};
