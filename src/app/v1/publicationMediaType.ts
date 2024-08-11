import { Plugin, RequestQuery, Server, ServerApplicationState } from '@hapi/hapi';
import { PrismaClient } from '@prisma/client';

export const publicationMediaTypePlugin: Plugin<string> = {
  name: 'publicationMediaType',
  version: '1.0.0',
  register: async function (server: Server) {
    const app: ServerApplicationState & { prisma?: PrismaClient } = server.app;

    server.route({
      method: 'GET',
      path: '/publication-media-type',
      handler: async (request, h) => {
        const { name = '', publicationIds } = request.query as RequestQuery;

        const publicationMediaTypes = await app.prisma?.publication_mediatype.findMany({
          select: {
            mediatype: true
          },
          distinct: ['mediatype'],
          where: {
            mediatype: {
              contains: name,
              not: {
                equals: ''
              }
            },
            owner_id: { in: publicationIds }
          },
          orderBy: { mediatype: 'asc' }
        });

        return h
          .response({
            items: publicationMediaTypes,
            total: publicationMediaTypes?.length
          })
          .code(200);
      }
    });
  }
};
