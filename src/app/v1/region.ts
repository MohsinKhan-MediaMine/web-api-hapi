import { Plugin, RequestQuery, Server, ServerApplicationState } from '@hapi/hapi';
import { PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaClientMediamine } from '../../../.prisma/client/mediamine';

export const regionPlugin: Plugin<string> = {
  name: 'region',
  version: '1.0.0',
  register: async function (server: Server) {
    const app: ServerApplicationState & { prisma?: PrismaClient; prismaMediamine?: PrismaClientMediamine } = server.app;

    server.route({
      method: 'GET',
      path: '/region',
      handler: async (request, h) => {
        const { name = '', country = '', code = 'NZ', hasJournalist = false } = request.query as RequestQuery;

        const journalist_regions = await app.prismaMediamine?.journalist_region.findMany({
          select: {
            region_id: true
          }
        });

        const regions = await app.prisma?.region.findMany({
          select: {
            id: true,
            name: true,
            country: {
              select: {
                name: true
              }
            }
          },
          where: {
            name: {
              contains: name,
              not: {
                equals: ''
              }
            },
            country: {
              name: {
                contains: country
              },
              ...(code && {
                code
              })
            },
            ...(hasJournalist && {
              id: {
                in: journalist_regions?.map((r) => r.region_id)
              }
            })
          },
          orderBy: { name: 'asc' }
        });

        return h
          .response({
            items: regions,
            total: regions?.length
          })
          .code(200);
      }
    });

    server.route({
      method: 'GET',
      path: '/region/batch',
      handler: async (request, h) => {
        const { ids } = request.query as RequestQuery;

        const regions = await app.prisma?.region.findMany({
          select: {
            id: true,
            name: true,
            country: {
              select: {
                name: true
              }
            }
          },
          where: {
            id: {
              in: ids
            }
          }
        });

        return h
          .response({
            items: regions,
            total: regions?.length
          })
          .code(200);
      }
    });
  }
};
