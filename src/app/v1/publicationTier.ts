import { Plugin, RequestQuery, Server, ServerApplicationState } from '@hapi/hapi';
import { PrismaClient } from '@prisma/client';

export const publicationTierPlugin: Plugin<string> = {
  name: 'publicationTier',
  version: '1.0.0',
  register: async function (server: Server) {
    const app: ServerApplicationState & { prisma?: PrismaClient } = server.app;

    server.route({
      method: 'GET',
      path: '/publication-tier',
      handler: async (request, h) => {
        const { name = '' } = request.query as RequestQuery;

        const TIERS_DB = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5'];

        const publicationTiers = await app.prisma?.tag.findMany({
          select: {
            id: true,
            name: true
          },
          where: {
            name: {
              contains: name,
              not: {
                equals: ''
              },
              in: TIERS_DB
            }
          },
          orderBy: { name: 'asc' }
        });

        return h
          .response({
            items: publicationTiers,
            total: publicationTiers?.length
          })
          .code(200);
      }
    });
  }
};
