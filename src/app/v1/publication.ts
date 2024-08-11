import { Plugin, RequestQuery, Server, ServerApplicationState, Utils } from '@hapi/hapi';
import { PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaClientMediamine } from '../../../.prisma/client/mediamine';
import { validateSort } from '../../utils';

export const publicationPlugin: Plugin<string> = {
  name: 'publication',
  version: '1.0.0',
  register: async function (server: Server): Promise<void> {
    const app: ServerApplicationState & { prisma?: PrismaClient; prismaMediamine?: PrismaClientMediamine } = server.app;

    server.route({
      method: 'GET',
      path: '/publication',
      handler: async (request, h) => {
        const {
          marker = '0',
          limit = '20',
          sort = 'name: asc',
          name = '',
          country = '',
          hasJournalist = false
        } = request.query as RequestQuery;
        const [sortField, sortValue] = sort.split(':');
        const validSort = validateSort(sortField, sortValue);

        const journalist_publications = await app.prismaMediamine?.journalist_publication.findMany({
          select: {
            publication_id: true
          }
        });

        const publications = await app.prisma?.publication.findMany({
          select: {
            id: true,
            name: true,
            region: {
              select: {
                name: true,
                country: {
                  select: {
                    name: true
                  }
                }
              }
            },
            feed: {
              select: {
                name: true,
                broken_url: true
              }
            }
          },
          where: {
            name: {
              contains: name,
              mode: 'insensitive'
            },
            // Allow region to be null if country is not entered as a filter
            ...(country && {
              region: {
                country: {
                  name: {
                    contains: country
                  }
                }
              }
            }),
            ...(hasJournalist && {
              id: {
                in: journalist_publications?.map((p) => p.publication_id)
              }
            })
          },
          orderBy: validSort ? { [sortField]: sortValue } : { name: 'asc' }
        });

        return h
          .response({
            items: publications?.slice(Number(marker), Number(marker) + Number(limit)),
            marker,
            limit,
            total: publications?.length
          })
          .code(200);
      }
    });

    server.route({
      method: 'GET',
      path: '/publication/batch',
      handler: async (request, h) => {
        const { ids } = request.query as RequestQuery;

        const publications = await app.prisma?.publication.findMany({
          select: {
            id: true,
            name: true,
            region: {
              select: {
                name: true,
                country: {
                  select: {
                    name: true
                  }
                }
              }
            },
            feed: {
              select: {
                name: true,
                broken_url: true
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
            items: publications,
            total: publications?.length
          })
          .code(200);
      }
    });

    server.route({
      method: 'GET',
      path: '/publication/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;

        const publication = await app.prisma?.publication.findFirstOrThrow({
          select: {
            id: true,
            name: true,
            url: true,
            readership: true,
            page_parser: true,
            domiciled_region_id: true,
            region: {
              select: {
                id: true,
                name: true,
                country: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            publication_tag: {
              select: {
                publication_id: true,
                tag_id: true,
                tag: true
              }
            }
          },
          where: {
            id: Number(id)
          }
        });

        const publication_country = await app.prisma?.publication_country.findFirst({
          select: {
            publication_id: true,
            country_id: true
          },
          where: {
            publication_id: Number(id)
          }
        });

        const publication_region = await app.prisma?.publication_region.findFirst({
          select: {
            publication_id: true,
            region_id: true
          },
          where: {
            publication_id: Number(id)
          }
        });

        return h
          .response({
            publication,
            publication_country,
            publication_region
          })
          .code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/publication',
      handler: async (request, h) => {
        const { name, url, page_parser } = request.payload as Utils.Dictionary<string>;
        const { readership, domiciled_region_id, country_id, region_id } = request.payload as Utils.Dictionary<number>;
        const { tags = [] } = request.payload as Utils.Dictionary<Array<string>>;

        // Find the highest Id in the database
        const publications = await app.prisma?.publication.findFirstOrThrow({
          orderBy: {
            id: 'desc'
          }
        });

        // Create the record in the database
        const publication = await app.prisma?.publication.create({
          data: {
            id: Number(publications?.id) + 1,
            name,
            url,
            readership,
            page_parser,
            domiciled_region_id,
            publication_tag: {
              createMany: {
                data: tags.map<{ tag_id: number }>((tag) => ({
                  tag_id: Number(tag)
                }))
              }
            }
          }
        });
        const publication_id = Number(publication?.id);

        // Create dependent records
        const publication_country = await app.prisma?.publication_country.create({
          data: {
            publication_id,
            country_id
          }
        });
        const publication_region = await app.prisma?.publication_region.create({
          data: {
            publication_id,
            region_id
          }
        });

        return h
          .response({
            publication,
            publication_country,
            publication_region
          })
          .code(200);
      }
    });

    server.route({
      method: 'PUT',
      path: '/publication/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;
        const { name, url, page_parser } = request.payload as Utils.Dictionary<string>;
        const { readership, domiciled_region_id, country_id, region_id } = request.payload as Utils.Dictionary<number>;
        const { tags = [] } = request.payload as Utils.Dictionary<Array<string>>;

        const publication_id = Number(id);

        await app.prisma?.publication_tag.deleteMany({
          where: {
            publication_id
          }
        });

        // Update the record in the database
        const publication = await app.prisma?.publication.update({
          data: {
            name,
            url,
            readership: Number(readership),
            page_parser,
            domiciled_region_id: Number(domiciled_region_id),
            publication_tag: {
              createMany: {
                data: tags.map<{ tag_id: number }>((tag) => ({
                  tag_id: Number(tag)
                }))
              }
            }
          },
          where: {
            id: publication_id
          }
        });

        // Update dependent records
        await app.prisma?.publication_country.deleteMany({
          where: {
            publication_id
          }
        });
        const publication_country = await app.prisma?.publication_country.create({
          data: {
            publication_id,
            country_id
          }
        });

        await app.prisma?.publication_region.deleteMany({
          where: {
            publication_id
          }
        });
        const publication_region = await app.prisma?.publication_region.create({
          data: {
            publication_id,
            region_id
          }
        });

        return h
          .response({
            publication,
            publication_country,
            publication_region
          })
          .code(200);
      }
    });

    server.route({
      method: 'DELETE',
      path: '/publication/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;
        const publication_id = Number(id);

        // TODO: Find Feeds connected to Publication and throw error if there are any
        // TODO: Remove autosubscriber update & add to response
        // TODO: Remove outputDelegate.refreshCache

        // Remove dependent records
        const publication_country = await app.prisma?.publication_country.deleteMany({
          where: {
            publication_id
          }
        });
        const publication_region = await app.prisma?.publication_region.deleteMany({
          where: {
            publication_id
          }
        });
        const publication_tag = await app.prisma?.publication_tag.deleteMany({
          where: {
            publication_id
          }
        });

        // Delete the record from the database
        const publication = await app.prisma?.publication.delete({
          where: {
            id: Number(id)
          }
        });

        return h
          .response({
            publication,
            publication_tag,
            publication_country,
            publication_region
          })
          .code(200);
      }
    });
  }
};

// TODO: remove below code

// const publication_id = Number(publication?.id);

// Create the record in publication_country
// const publication_country = await app.prisma?.publication_country.create({
//   data: {
//     publication_id,
//     country_id
//   }
// });

// Create the record in publication_region
// const publication_region = await app.prisma?.publication_region.create({
//   data: {
//     publication_id,
//     region_id
//   }
// });

// autosubscriber update & add to response
// const feeds = await app.prisma?.feed.findMany({
//   select: {
//     id: true,
//     name: true,
//     manual: true,
//     feed_tag: true
//   },
//   where: {
//     publication: {
//       id: publication_id
//     }
//   },
//   orderBy: { id: 'desc' }
// });
// const t = feeds?.reduce((feed) => {
//   const actionsTaken = [];
//   if (feed.manual) return actionsTaken;

//   let aois = [];
//   if (feed.feed_tag) {
//     aois = app.prisma?.area_of_interest.findMany({
//       where: {
//         area_of_interest_tag: {
//           id: feed.feed_tag
//         }
//       }
//     });
//   }
// }, []);
// outputDelegate.refreshCache

// disable feeds if publication is disabled
