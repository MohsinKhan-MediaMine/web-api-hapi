import { Plugin, RequestQuery, Server, ServerApplicationState, Utils } from '@hapi/hapi';
import { PrismaClient } from '@prisma/client';
import { validateSort } from '../../utils';

export const feedPlugin: Plugin<string> = {
  name: 'feed',
  version: '1.0.0',
  register: async function (server: Server) {
    const app: ServerApplicationState & { prisma?: PrismaClient } = server.app;

    server.route({
      method: 'GET',
      path: '/feed',
      handler: async (request, h) => {
        const { marker = '0', limit = '20', sort = '', name = '', publication = '', enabled, broken_url } = request.query as RequestQuery;
        const [sortField, sortValue] = sort.split(':');
        const validSort = validateSort(sortField, sortValue);

        const feeds = await app.prisma?.feed.findMany({
          select: {
            id: true,
            name: true,
            url: true,
            enabled: true,
            feed_type: true,
            breaking_news: true,
            client_searchable: true,
            complicated: true,
            manual: true,
            reach: true,
            mediatype: true,
            default_refresh_period: true,
            page_parser: true,
            region: {
              select: {
                id: true,
                name: true,
                country: true,
                enabled: true
              }
            },
            broken_url: true,
            publication: {
              select: {
                name: true
              }
            }
          },
          where: {
            name: {
              contains: name,
              mode: 'insensitive'
            },
            publication: {
              name: {
                contains: publication
              }
            },
            ...(enabled && { enabled: !!(enabled === 'true') }),
            ...(broken_url && { broken_url: broken_url === 'true' ? 'Y' : 'N' })
          },
          orderBy: validSort ? { [sortField]: sortValue } : { name: 'asc' }
        });

        return h
          .response({
            items: feeds?.slice(Number(marker), Number(marker) + Number(limit)),
            marker,
            limit,
            total: feeds?.length
          })
          .code(200);
      }
    });

    server.route({
      method: 'GET',
      path: '/feed/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;

        const feed = await app.prisma?.feed.findFirstOrThrow({
          select: {
            id: true,
            name: true,
            url: true,
            enabled: true,
            feed_type: true,
            breaking_news: true,
            client_searchable: true,
            complicated: true,
            manual: true,
            reach: true,
            mediatype: true,
            default_refresh_period: true,
            page_parser: true,
            // Domiciled Region Id
            region: {
              select: {
                id: true,
                name: true,
                country: true,
                enabled: true
              }
            },
            // Regions of Interest
            feed_region: {
              select: {
                region: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            feed_tag: {
              select: {
                tag: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            broken_url: true,
            publication: {
              select: {
                id: true,
                name: true
              }
            }
          },
          where: {
            id: Number(id)
          }
        });

        return h.response({ feed }).code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/feed',
      handler: async (request, h) => {
        const { name, url, feed_type, mediatype, page_parser, broken_url } = request.payload as Utils.Dictionary<string>;
        const { reach, default_refresh_period, domiciled_region_id, region_id, publication_id } =
          request.payload as Utils.Dictionary<number>;
        const { enabled, breaking_news, client_searchable, complicated, manual } = request.payload as Utils.Dictionary<boolean>;
        const { tags = [] } = request.payload as Utils.Dictionary<Array<string>>;

        // Find the highest Id in the database
        const feeds = await app.prisma?.feed.findFirstOrThrow({
          orderBy: {
            id: 'desc'
          }
        });

        // Create the record in the database
        const feed = await app.prisma?.feed.create({
          data: {
            id: Number(feeds?.id) + 1,
            name,
            url,
            enabled,
            feed_type,
            breaking_news,
            client_searchable,
            complicated,
            manual,
            reach,
            mediatype,
            default_refresh_period,
            page_parser,
            broken_url,
            domiciled_region_id,
            feed_region: {
              createMany: {
                data: [{ region_id }]
              }
            },
            feed_tag: {
              createMany: {
                data: tags.map<{ tag_id: number }>((tag) => ({
                  tag_id: Number(tag)
                }))
              }
            },
            publication_id
          }
        });

        return h
          .response({
            feed
          })
          .code(200);
      }
    });

    server.route({
      method: 'PUT',
      path: '/feed/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;
        const { name, url, feed_type, mediatype, page_parser, broken_url } = request.payload as Utils.Dictionary<string>;
        const { reach, default_refresh_period, domiciled_region_id, region_id, publication_id } =
          request.payload as Utils.Dictionary<number>;
        const { enabled, breaking_news, client_searchable, complicated, manual } = request.payload as Utils.Dictionary<boolean>;
        const { tags = [] } = request.payload as Utils.Dictionary<Array<string>>;

        const feed_id = Number(id);

        const feedExisting = await app.prisma?.feed.findFirstOrThrow({
          select: {
            id: true
          },
          where: {
            id: feed_id
          }
        });

        await app.prisma?.feed_region.deleteMany({
          where: {
            feed_id
          }
        });

        await app.prisma?.feed_tag.deleteMany({
          where: {
            feed_id
          }
        });

        const feed = await app.prisma?.feed.update({
          data: {
            name,
            url,
            enabled,
            feed_type,
            breaking_news,
            client_searchable,
            complicated,
            manual,
            reach,
            mediatype,
            default_refresh_period,
            page_parser,
            broken_url,
            domiciled_region_id,
            feed_region: {
              createMany: {
                data: [{ region_id }]
              }
            },
            feed_tag: {
              createMany: {
                data: tags.map<{ tag_id: number }>((tag) => ({
                  tag_id: Number(tag)
                }))
              }
            },
            publication_id
          },
          where: {
            id: feedExisting?.id
          }
        });

        return h
          .response({
            feed
          })
          .code(200);
      }
    });

    server.route({
      method: 'DELETE',
      path: '/feed/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;

        const journalist = await app.prisma?.feed.delete({
          where: {
            id: Number(id)
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
