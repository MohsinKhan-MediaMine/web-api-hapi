import { Plugin, RequestQuery, Server, ServerApplicationState } from '@hapi/hapi';
import { PrismaClient } from '@prisma/client';

export const countryPlugin: Plugin<string> = {
  name: 'country',
  version: '1.0.0',
  register: async function (server: Server) {
    const app: ServerApplicationState & { prisma?: PrismaClient } = server.app;

    server.route({
      method: 'GET',
      path: '/country',
      handler: async (request, h) => {
        const { name = '' } = request.query as RequestQuery;

        const countries = await app.prisma?.country.findMany({
          select: {
            id: true,
            name: true,
            code: true
          },
          where: {
            name: {
              contains: name,
              not: {
                equals: ''
              }
            },
            enabled: true
          },
          orderBy: { name: 'asc' }
        });

        return h
          .response({
            items: countries,
            total: countries?.length
          })
          .code(200);
      }
    });
  }
};
