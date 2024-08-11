import { Plugin, RequestQuery, Server, ServerApplicationState, Utils } from '@hapi/hapi';
import { PrismaClient } from '@prisma/client';
import { lowerCase } from 'lodash';
import { DateTime } from 'luxon';
import { PrismaClient as PrismaClientMediamine } from '../../../.prisma/client/mediamine';
import { ApiExtend, isEmailStatusValid } from '../../externalServices/zerobounce';
import { validateSort } from '../../utils';
const { v4: uuidv4 } = require('uuid');
const converter = require('json-2-csv');

export const journalistPlugin: Plugin<string> = {
  name: 'journalist',
  version: '1.0.0',
  register: async function (server: Server): Promise<void> {
    const app: ServerApplicationState & { prisma?: PrismaClient; prismaMediamine?: PrismaClientMediamine; validateEmail?: ApiExtend } =
      server.app;

    server.route({
      method: 'GET',
      path: '/journalist',
      handler: async (request, h) => {
        const {
          marker = '0',
          limit = '20',
          sort = 'first_name: asc',
          name = '',
          formatTypeIds,
          newsTypeIds,
          roleTypeIds,
          publicationIds,
          publicationMediatypes,
          publicationTiers,
          regionIds,
          journalistIds,
          validEmail = 'true',
          enabled = 'true'
        } = request.query as RequestQuery;
        const [sortField, sortValue] = sort.split(':');
        const validSort = validateSort(sortField, sortValue);

        const TIERS_DB = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5'];

        try {
          const tiers = await app.prisma?.tag.findMany({
            where: {
              name: {
                in:
                  publicationTiers?.filter((pt: string) => TIERS_DB.includes(pt)) ??
                  // Fallback to all Tiers if publicationTiers param is not set
                  TIERS_DB
              }
            }
          });

          const publicationsWithMediatypesOrTiers = await app.prisma?.publication.findMany({
            select: {
              id: true,
              name: true
            },
            where: {
              ...(publicationIds && { id: { in: publicationIds } }),
              ...(publicationMediatypes && { publication_mediatype: { some: { mediatype: { in: publicationMediatypes } } } }),
              ...(publicationTiers && tiers && { publication_tag: { some: { tag_id: { in: tiers?.map((t) => t.id) } } } })
            }
          });

          const journalists = await app.prismaMediamine?.journalist.findMany({
            select: {
              id: true,
              createdAt: true,
              updatedAt: true,
              uuid: true,
              first_name: true,
              last_name: true,
              email: true,
              phone: true,
              ddi: true,
              mobile: true,
              valid_email: true,
              user_approved: true,
              format_types: true,
              news_types: true,
              role_types: true,
              publications: true,
              regions: true
            },
            where: {
              enabled: enabled === 'true',
              AND: [
                /**
                 * validEmail url param is resolved into the following condition
                 * 1. if true, resolve the sql query into `valid_email = 'true' OR  user_approved = 'true'`
                 * 2. if false, resolve the sql query into `valid_email = 'false' AND  user_approved = 'false'`
                 */
                {
                  ...(validEmail === 'true'
                    ? { OR: [{ valid_email: true }, { user_approved: true }] }
                    : { AND: [{ valid_email: false }, { user_approved: false }] })
                },
                {
                  OR: [
                    {
                      first_name: {
                        // TODO: Needs to honour all the search keywords and not only the first
                        contains: name?.split(' ')[0],
                        mode: 'insensitive'
                      }
                    },
                    {
                      last_name: {
                        // TODO: Needs to honour all the search keywords and not only the first
                        contains: name?.split(' ')[0],
                        mode: 'insensitive'
                      }
                    }
                  ]
                }
              ],
              ...(formatTypeIds && {
                format_types: { some: { format_type_id: { in: formatTypeIds } } }
              }),
              ...(newsTypeIds && {
                news_types: { some: { news_type_id: { in: newsTypeIds } } }
              }),
              ...(roleTypeIds && {
                role_types: { some: { role_type_id: { in: roleTypeIds } } }
              }),
              ...(regionIds && {
                regions: { some: { region_id: { in: regionIds } } }
              }),
              ...((publicationIds || publicationMediatypes || publicationTiers) && {
                publications: { some: { publication_id: { in: publicationsWithMediatypesOrTiers?.map((p) => p.id) } } }
              }),
              ...(journalistIds && {
                uuid: { in: journalistIds }
              })
              // TODO: the below three conditions to resolve to a list of publications before being applied to the query
              // ...(publicationIds && {
              //   publications: { some: { publication_id: { in: publicationIds } } }
              // }),
              // ...(publicationMediatypes && {
              //   publications: { some: { publication_id: { in: publicationsWithMediaTypesOrTiers?.map((p) => p.id) } } }
              // }),
              // ...(publicationTiers && {
              //   publications: { some: { publication_id: { in: publicationsWithMediaTypesOrTiers?.map((p) => p.id) } } }
              // })
            },
            // orderBy: validSort ? { [sortField]: sortValue } : { first_name: 'asc' }
            orderBy: validSort ? [{ first_name: 'asc' }, { last_name: 'asc' }] : { first_name: 'asc' }
          });

          const journalistsCurrentPage = journalists?.slice(Number(marker), Number(marker) + Number(limit));

          const journalist_format_types = await app.prismaMediamine?.journalist_format_type.findMany({
            where: {
              journalist_id: {
                in: journalistsCurrentPage?.map((j) => j.id)
              }
            }
          });
          const format_types = await app.prismaMediamine?.format_type.findMany({
            select: {
              id: true,
              name: true
            },
            where: {
              id: {
                in: journalist_format_types?.map((j) => j.format_type_id)
              }
            }
          });

          const journalist_news_types = await app.prismaMediamine?.journalist_news_type.findMany({
            where: {
              journalist_id: {
                in: journalistsCurrentPage?.map((j) => j.id)
              }
            }
          });
          const news_types = await app.prismaMediamine?.news_type.findMany({
            select: {
              id: true,
              name: true
            },
            where: {
              id: {
                in: journalist_news_types?.map((j) => j.news_type_id)
              }
            }
          });

          const journalist_role_types = await app.prismaMediamine?.journalist_role_type.findMany({
            where: {
              journalist_id: {
                in: journalistsCurrentPage?.map((j) => j.id)
              }
            }
          });
          const role_types = await app.prismaMediamine?.role_type.findMany({
            select: {
              id: true,
              name: true
            },
            where: {
              id: {
                in: journalist_role_types?.map((j) => j.role_type_id)
              }
            }
          });

          const journalist_publications = await app.prismaMediamine?.journalist_publication.findMany({
            where: {
              journalist_id: {
                in: journalistsCurrentPage?.map((j) => j.id)
              }
            }
          });
          const publications = await app.prisma?.publication.findMany({
            select: {
              id: true,
              name: true
            },
            where: {
              id: {
                in: journalist_publications?.map((j) => j.publication_id)
              }
            }
          });
          const publication_mediatypes = await app.prisma?.publication_mediatype.findMany({
            select: {
              owner_id: true,
              mediatype: true
            },
            where: {
              owner_id: {
                in: journalist_publications?.map((j) => j.publication_id)
              },
              ...(publicationMediatypes && { mediatype: { in: publicationMediatypes } })
            }
          });
          const publication_tiers = await app.prisma?.publication_tag.findMany({
            select: {
              publication_id: true,
              tag_id: true
            },
            where: {
              publication_id: {
                in: journalist_publications?.map((j) => j.publication_id)
              },
              tag_id: { in: tiers?.map((t) => t.id) }
            }
          });

          const journalist_regions = await app.prismaMediamine?.journalist_region.findMany({
            where: {
              journalist_id: {
                in: journalistsCurrentPage?.map((j) => j.id)
              }
            }
          });
          const regions = await app.prisma?.region.findMany({
            select: {
              id: true,
              name: true
            },
            where: {
              id: {
                in: journalist_regions?.map((j) => j.region_id)
              }
            }
          });

          return h
            .response({
              items: journalistsCurrentPage?.map((j) => ({
                ...j,
                format_types: format_types?.filter((nt) =>
                  journalist_format_types
                    ?.filter((jnt) => jnt.journalist_id === j.id)
                    .map((jnt) => jnt.format_type_id)
                    .includes(nt.id)
                ),
                news_types: news_types?.filter((nt) =>
                  journalist_news_types
                    ?.filter((jnt) => jnt.journalist_id === j.id)
                    .map((jnt) => jnt.news_type_id)
                    .includes(nt.id)
                ),
                role_types: role_types?.filter((rt) =>
                  journalist_role_types
                    ?.filter((jrt) => jrt.journalist_id === j.id)
                    .map((jrt) => jrt.role_type_id)
                    .includes(rt.id)
                ),
                publications: publications
                  ?.filter((p) =>
                    journalist_publications
                      ?.filter((jp) => jp.journalist_id === j.id)
                      .map((jp) => jp.publication_id)
                      .includes(p.id)
                  )
                  .map((p) => ({
                    ...p,
                    mediatypes: publication_mediatypes?.filter((pm) => pm.owner_id === p.id).map((pm) => pm.mediatype),
                    tiers: tiers
                      ?.filter((t) =>
                        publication_tiers
                          ?.filter((pt) => pt.publication_id === p.id)
                          .map((pt) => pt.tag_id)
                          .includes(t.id)
                      )
                      .map((t) => t.name)
                  })),
                regions: regions?.filter((r) =>
                  journalist_regions
                    ?.filter((jr) => jr.journalist_id === j.id)
                    .map((jr) => jr.region_id)
                    .includes(r.id)
                )
              })),
              marker,
              limit,
              total: journalists?.length
            })
            .code(200);
        } catch (e: any) {
          console.error(`GET journalist failed with ${e}`);
          return h.response(`GET journalist failed with ${e}`).code(500);
        }
      }
    });

    server.route({
      method: 'GET',
      path: '/journalist/export/v0',
      handler: async (request, h) => {
        const {
          // marker = '0',
          // limit = '20',
          sort = 'name: asc',
          name = '',
          formatTypeIds,
          newsTypeIds,
          roleTypeIds,
          publicationIds,
          publicationMediatypes,
          publicationTiers,
          validEmail = 'true'
        } = request.query as RequestQuery;
        const [sortField, sortValue] = sort.split(':');
        const validSort = validateSort(sortField, sortValue);

        const TIERS_DB = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5'];
        const tiers = await app.prisma?.tag.findMany({
          where: {
            name: {
              in: publicationTiers?.filter((pt: string) => TIERS_DB.includes(pt)) ?? TIERS_DB
            }
          }
        });

        const publicationsWithMediaTypesOrTiers = await app.prisma?.publication.findMany({
          select: {
            id: true,
            name: true
          },
          where: {
            ...(publicationMediatypes && { publication_mediatype: { some: { mediatype: { in: publicationMediatypes } } } }),
            ...(tiers && { publication_tag: { some: { tag_id: { in: tiers?.map((t) => t.id) } } } })
          }
        });

        const journalists = await app.prismaMediamine?.journalist.findMany({
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            uuid: true,
            first_name: true,
            last_name: true,
            email: true,
            mobile: true,
            valid_email: true,
            format_types: true,
            news_types: true,
            role_types: true,
            publications: true,
            regions: true
          },
          where: {
            valid_email: validEmail === 'true',
            OR: [
              {
                first_name: {
                  contains: name,
                  mode: 'insensitive'
                }
              },
              {
                last_name: {
                  contains: name,
                  mode: 'insensitive'
                }
              }
            ],
            ...(formatTypeIds && {
              format_types: { some: { format_type_id: { in: formatTypeIds } } }
            }),
            ...(newsTypeIds && {
              news_types: { some: { news_type_id: { in: newsTypeIds } } }
            }),
            ...(roleTypeIds && {
              role_types: { some: { role_type_id: { in: roleTypeIds } } }
            }),
            ...(publicationIds && {
              publications: { some: { publication_id: { in: publicationIds } } }
            }),
            ...(publicationMediatypes && {
              publications: { some: { publication_id: { in: publicationsWithMediaTypesOrTiers?.map((p) => p.id) } } }
            }),
            ...(publicationTiers && {
              publications: { some: { publication_id: { in: publicationsWithMediaTypesOrTiers?.map((p) => p.id) } } }
            })
          },
          orderBy: validSort ? { [sortField]: sortValue } : { first_name: 'asc' }
        });

        // const journalistsCurrentPageEmails = journalists?.slice(Number(marker), Number(marker) + Number(limit));

        const resp = await converter.json2csv(journalists, { keys: ['email'] });

        return h.response(resp).code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/journalist/export',
      handler: async (request, h) => {
        const { ids, publicationMediatypes, publicationTiers } = request.payload as Utils.Dictionary<Array<string>>;
        const { publicationIds, formatTypeIds, newsTypeIds, roleTypeIds, regionIds } = request.payload as Utils.Dictionary<Array<number>>;
        // TODO: support more bulk actions
        const { selectAll, validEmail, enabled = true } = request.payload as Utils.Dictionary<boolean>;
        const { sort = 'first_name: asc', name = '' } = request.payload as Utils.Dictionary<string>;

        const [sortField, sortValue] = sort.split(':');
        const validSort = validateSort(sortField, sortValue);

        const TIERS_DB = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5'];

        try {
          const tiers = await app.prisma?.tag.findMany({
            where: {
              name: {
                in: publicationTiers?.filter((pt: string) => TIERS_DB.includes(pt))
              }
            }
          });

          const publicationsWithMediatypesOrTiers = await app.prisma?.publication.findMany({
            select: {
              id: true,
              name: true
            },
            where: {
              ...(publicationIds && { id: { in: publicationIds } }),
              ...(publicationMediatypes && { publication_mediatype: { some: { mediatype: { in: publicationMediatypes } } } }),
              ...(publicationTiers && tiers && { publication_tag: { some: { tag_id: { in: tiers?.map((t) => t.id) } } } })
            }
          });

          const journalists = await app.prismaMediamine?.journalist.findMany({
            select: {
              id: true,
              createdAt: true,
              updatedAt: true,
              uuid: true,
              first_name: true,
              last_name: true,
              email: true,
              ddi: true,
              mobile: true,
              valid_email: true,
              user_approved: true,
              format_types: true,
              news_types: true,
              role_types: true,
              publications: true,
              regions: true
            },
            where: {
              ...(!selectAll && { uuid: { in: ids } }),
              enabled,
              AND: [
                /**
                 * validEmail url param is resolved into the following condition
                 * 1. if true, resolve the sql query into `valid_email = 'true' OR  user_approved = 'true'`
                 * 2. if false, resolve the sql query into `valid_email = 'false' AND  user_approved = 'false'`
                 */
                {
                  ...(validEmail
                    ? { OR: [{ valid_email: true }, { user_approved: true }] }
                    : { AND: [{ valid_email: false }, { user_approved: false }] })
                },
                {
                  OR: [
                    {
                      first_name: {
                        // TODO: Needs to honour all the search keywords and not only the first
                        contains: name?.split(' ')[0],
                        mode: 'insensitive'
                      }
                    },
                    {
                      last_name: {
                        // TODO: Needs to honour all the search keywords and not only the first
                        contains: name?.split(' ')[0],
                        mode: 'insensitive'
                      }
                    }
                  ]
                }
              ],
              ...(formatTypeIds && {
                format_types: { some: { format_type_id: { in: formatTypeIds } } }
              }),
              ...(newsTypeIds && {
                news_types: { some: { news_type_id: { in: newsTypeIds } } }
              }),
              ...(roleTypeIds && {
                role_types: { some: { role_type_id: { in: roleTypeIds } } }
              }),
              ...(regionIds && {
                regions: { some: { region_id: { in: regionIds } } }
              }),
              ...((publicationIds || publicationMediatypes || publicationTiers) && {
                publications: { some: { publication_id: { in: publicationsWithMediatypesOrTiers?.map((p) => p.id) } } }
              })
            },
            orderBy: validSort ? [{ first_name: 'asc' }, { last_name: 'asc' }] : { first_name: 'asc' }
          });

          // const journalists = selectAll
          //   ? await app.prismaMediamine?.journalist.findMany({
          //       select: {
          //         id: true,
          //         email: true
          //       }
          //     })
          //   : await app.prismaMediamine?.journalist.findMany({
          //       select: {
          //         id: true,
          //         email: true
          //       },
          //       where: {
          //         uuid: { in: ids }
          //       }
          //     });

          const resp = await converter.json2csv(
            journalists?.map((j) => ({ ...j, p: j.publications })),
            {
              keys: [
                'first_name',
                'email'
                // TODO: 'publications'
              ]
            }
          );

          return h.response(resp).code(200);
        } catch (e: any) {
          console.error(`POST /journalist/export failed with ${e}`);
          return h.response(`POST /journalist/export failed with ${e}`).code(500);
        }
      }
    });

    server.route({
      method: 'GET',
      path: '/journalist/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;

        const TIERS_DB = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5'];
        const tiers = await app.prisma?.tag.findMany({
          where: {
            name: {
              in: TIERS_DB
            }
          }
        });

        const journalist = await app.prismaMediamine?.journalist.findFirstOrThrow({
          where: {
            uuid: id
          }
        });

        const journalist_format_types = await app.prismaMediamine?.journalist_format_type.findMany({
          where: {
            journalist_id: journalist?.id
          }
        });
        const format_types = await app.prismaMediamine?.format_type.findMany({
          select: {
            id: true,
            name: true
          },
          where: {
            id: {
              in: journalist_format_types?.map((j) => j.format_type_id)
            }
          }
        });

        const journalist_news_types = await app.prismaMediamine?.journalist_news_type.findMany({
          where: {
            journalist_id: journalist?.id
          }
        });
        const news_types = await app.prismaMediamine?.news_type.findMany({
          select: {
            id: true,
            name: true
          },
          where: {
            id: {
              in: journalist_news_types?.map((j) => j.news_type_id)
            }
          }
        });

        const journalist_role_types = await app.prismaMediamine?.journalist_role_type.findMany({
          where: {
            journalist_id: journalist?.id
          }
        });
        const role_types = await app.prismaMediamine?.role_type.findMany({
          select: {
            id: true,
            name: true
          },
          where: {
            id: {
              in: journalist_role_types?.map((j) => j.role_type_id)
            }
          }
        });

        const journalist_publications = await app.prismaMediamine?.journalist_publication.findMany({
          where: {
            journalist_id: journalist?.id
          }
        });
        const publications = await app.prisma?.publication.findMany({
          select: {
            id: true,
            name: true
          },
          where: {
            id: {
              in: journalist_publications?.map((j) => j.publication_id)
            }
          }
        });
        const publication_mediatypes = await app.prisma?.publication_mediatype.findMany({
          select: {
            owner_id: true,
            mediatype: true
          },
          where: {
            owner_id: {
              in: journalist_publications?.map((j) => j.publication_id)
            }
          }
        });
        const publication_tiers = await app.prisma?.publication_tag.findMany({
          select: {
            publication_id: true,
            tag_id: true
          },
          where: {
            publication_id: {
              in: journalist_publications?.map((j) => j.publication_id)
            },
            tag_id: { in: tiers?.map((t) => t.id) }
          }
        });

        const journalist_regions = await app.prismaMediamine?.journalist_region.findMany({
          where: {
            journalist_id: journalist?.id
          }
        });
        const regions = await app.prisma?.region.findMany({
          select: {
            id: true,
            name: true
          },
          where: {
            id: {
              in: journalist_regions?.map((j) => j.region_id)
            }
          }
        });

        return h
          .response({
            ...journalist,
            format_types,
            news_types,
            role_types,
            publications: publications
              ?.filter((p) =>
                journalist_publications
                  ?.filter((jp) => jp.journalist_id === journalist?.id)
                  .map((jp) => jp.publication_id)
                  .includes(p.id)
              )
              .map((p) => ({
                ...p,
                mediatypes: publication_mediatypes?.filter((pm) => pm.owner_id === p.id).map((pm) => pm.mediatype),
                tiers: tiers
                  ?.filter((t) =>
                    publication_tiers
                      ?.filter((pt) => pt.publication_id === p.id)
                      .map((pt) => pt.tag_id)
                      .includes(t.id)
                  )
                  .map((t) => t.name)
              })),
            regions
          })
          .code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/journalist',
      handler: async (request, h) => {
        const { firstName, lastName, email, phone, ddi, mobile, linkedin, datasource } = request.payload as Utils.Dictionary<string>;
        const {
          formatTypeIds = [],
          newsTypeIds = [],
          roleTypeIds = [],
          publicationIds = [],
          regionIds = []
        } = request.payload as Utils.Dictionary<Array<number>>;

        if (!email) {
          console.error('Journalist is missing an email');
          return h.response('Journalist is missing an email').code(400);
        }

        // Create the record in the database
        const journalist = await app.prismaMediamine?.journalist.create({
          data: {
            uuid: uuidv4(),
            first_name: firstName,
            last_name: lastName,
            email,
            phone,
            ddi,
            mobile,
            linkedin,
            datasource,
            format_types: {
              create: formatTypeIds.map((ftid) => ({
                format_type: {
                  connect: {
                    id: ftid
                  }
                }
              }))
            },
            news_types: {
              create: newsTypeIds.map((ntid) => ({
                news_type: {
                  connect: {
                    id: ntid
                  }
                }
              }))
            },
            ...(roleTypeIds && {
              role_types: {
                create: roleTypeIds.map((rtid) => ({
                  role_type: {
                    connect: {
                      id: rtid
                    }
                  }
                }))
              }
            }),
            ...(publicationIds && {
              publications: {
                createMany: {
                  data: publicationIds.map((pid) => ({ publication_id: pid }))
                }
              }
            }),
            ...(regionIds && {
              regions: {
                createMany: {
                  data: regionIds.map((rid) => ({ region_id: rid }))
                }
              }
            })
          }
        });

        return h
          .response({
            journalist
          })
          .code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/journalist/batch',
      handler: async (_request, h) => {
        return h.response({ message: 'not implemented' }).code(200);
      }
    });

    server.route({
      method: 'PUT',
      path: '/journalist/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;
        const { firstName, lastName, email, phone, ddi, mobile, linkedin, twitter, datasource } =
          request.payload as Utils.Dictionary<string>;
        const {
          formatTypeIds = [],
          newsTypeIds = [],
          roleTypeIds = [],
          publicationIds = [],
          regionIds = []
        } = request.payload as Utils.Dictionary<Array<number>>;

        const journalistExisting = await app.prismaMediamine?.journalist.findFirstOrThrow({
          select: {
            id: true
          },
          where: {
            uuid: id
          }
        });

        await app.prismaMediamine?.journalist_format_type.deleteMany({
          where: {
            journalist_id: journalistExisting?.id
          }
        });
        await app.prismaMediamine?.journalist_news_type.deleteMany({
          where: {
            journalist_id: journalistExisting?.id
          }
        });
        await app.prismaMediamine?.journalist_role_type.deleteMany({
          where: {
            journalist_id: journalistExisting?.id
          }
        });
        await app.prismaMediamine?.journalist_publication.deleteMany({
          where: {
            journalist_id: journalistExisting?.id
          }
        });
        await app.prismaMediamine?.journalist_region.deleteMany({
          where: {
            journalist_id: journalistExisting?.id
          }
        });

        const journalist = await app.prismaMediamine?.journalist.update({
          data: {
            first_name: firstName,
            last_name: lastName,
            email,
            phone,
            ddi,
            mobile,
            linkedin,
            twitter,
            datasource,
            format_types: {
              create: formatTypeIds.map((ftid) => ({
                format_type: {
                  connect: {
                    id: ftid
                  }
                }
              }))
            },
            news_types: {
              create: newsTypeIds.map((ntid) => ({
                news_type: {
                  connect: {
                    id: ntid
                  }
                }
              }))
            },
            role_types: {
              create: roleTypeIds.map((rtid) => ({
                role_type: {
                  connect: {
                    id: rtid
                  }
                }
              }))
            },
            publications: {
              createMany: {
                data: publicationIds.map((pid) => ({ publication_id: pid }))
              }
            },
            regions: {
              createMany: {
                data: regionIds.map((rid) => ({ region_id: rid }))
              }
            }
          },
          where: {
            id: journalistExisting?.id
          }
        });

        return h
          .response({
            journalist
          })
          .code(200);
      }
    });

    server.route({
      method: 'PUT',
      path: '/journalist/batch',
      handler: async (request, h) => {
        const { ids, publicationMediatypes, publicationTiers } = request.payload as Utils.Dictionary<Array<string>>;
        const { publicationIds, formatTypeIds, newsTypeIds, roleTypeIds, regionIds } = request.payload as Utils.Dictionary<Array<number>>;
        // TODO: support more bulk actions
        const { selectAll, validEmail, enabled } = request.payload as Utils.Dictionary<boolean>;
        const { sort = 'first_name: asc', name = '' } = request.payload as Utils.Dictionary<string>;

        const [sortField, sortValue] = sort.split(':');
        const validSort = validateSort(sortField, sortValue);

        const TIERS_DB = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5'];

        try {
          const tiers = await app.prisma?.tag.findMany({
            where: {
              name: {
                in: publicationTiers?.filter((pt: string) => TIERS_DB.includes(pt))
              }
            }
          });

          const publicationsWithMediatypesOrTiers = await app.prisma?.publication.findMany({
            select: {
              id: true,
              name: true
            },
            where: {
              ...(publicationIds && { id: { in: publicationIds } }),
              ...(publicationMediatypes && { publication_mediatype: { some: { mediatype: { in: publicationMediatypes } } } }),
              ...(publicationTiers && tiers && { publication_tag: { some: { tag_id: { in: tiers?.map((t) => t.id) } } } })
            }
          });

          const journalistsExisting = await app.prismaMediamine?.journalist.findMany({
            select: {
              id: true,
              createdAt: true,
              updatedAt: true,
              uuid: true,
              first_name: true,
              last_name: true,
              email: true,
              mobile: true,
              valid_email: true,
              user_approved: true,
              format_types: true,
              news_types: true,
              role_types: true,
              publications: true,
              regions: true
            },
            where: {
              ...(!selectAll && { uuid: { in: ids } }),
              AND: [
                /**
                 * validEmail url param is resolved into the following condition
                 * 1. if true, resolve the sql query into `valid_email = 'true' OR  user_approved = 'true'`
                 * 2. if false, resolve the sql query into `valid_email = 'false' AND  user_approved = 'false'`
                 */
                {
                  ...(validEmail
                    ? { OR: [{ valid_email: true }, { user_approved: true }] }
                    : { AND: [{ valid_email: false }, { user_approved: false }] })
                },
                {
                  OR: [
                    {
                      first_name: {
                        // TODO: Needs to honour all the search keywords and not only the first
                        contains: name?.split(' ')[0],
                        mode: 'insensitive'
                      }
                    },
                    {
                      last_name: {
                        // TODO: Needs to honour all the search keywords and not only the first
                        contains: name?.split(' ')[0],
                        mode: 'insensitive'
                      }
                    }
                  ]
                }
              ],
              ...(formatTypeIds && {
                format_types: { some: { format_type_id: { in: formatTypeIds } } }
              }),
              ...(newsTypeIds && {
                news_types: { some: { news_type_id: { in: newsTypeIds } } }
              }),
              ...(roleTypeIds && {
                role_types: { some: { role_type_id: { in: roleTypeIds } } }
              }),
              ...(regionIds && {
                regions: { some: { region_id: { in: regionIds } } }
              }),
              ...((publicationIds || publicationMediatypes || publicationTiers) && {
                publications: { some: { publication_id: { in: publicationsWithMediatypesOrTiers?.map((p) => p.id) } } }
              })
            },
            orderBy: validSort ? [{ first_name: 'asc' }, { last_name: 'asc' }] : { first_name: 'asc' }
          });

          // const journalistsExisting = selectAll
          //   ? []
          //   : await app.prismaMediamine?.journalist.findMany({
          //       select: {
          //         id: true,
          //         email: true
          //       },
          //       where: {
          //         uuid: { in: ids }
          //       }
          //     });

          const journalists = await app.prismaMediamine?.journalist.updateMany({
            data: {
              enabled
            },
            where: {
              id: { in: journalistsExisting?.map((j) => j.id) }
            }
            // ...(selectAll
            //   ? {}
            //   : {
            //       where: {
            //         id: { in: journalistsExisting?.map((j) => j.id) }
            //       }
            //     })
          });

          return h
            .response({
              journalists
            })
            .code(200);
        } catch (e: any) {
          console.error(`POST /journalist/export failed with ${e}`);
          return h.response(`POST /journalist/export failed with ${e}`).code(500);
        }
      }
    });

    server.route({
      method: 'DELETE',
      path: '/journalist/{id}',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;

        const journalistExisting = await app.prismaMediamine?.journalist.findFirstOrThrow({
          where: {
            uuid: id
          }
        });

        const journalist = await app.prismaMediamine?.journalist.delete({
          where: {
            id: journalistExisting?.id
          }
        });

        return h
          .response({
            journalist
          })
          .code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/journalist/validate',
      handler: async (request, h) => {
        const limit = 100;
        const { ids, publicationMediatypes, publicationTiers } = request.payload as Utils.Dictionary<Array<string>>;
        const { publicationIds, formatTypeIds, newsTypeIds, roleTypeIds, regionIds } = request.payload as Utils.Dictionary<Array<number>>;
        // TODO: support more bulk actions
        const { selectAll, validEmail } = request.payload as Utils.Dictionary<boolean>;
        const { sort = 'first_name: asc', name = '' } = request.payload as Utils.Dictionary<string>;

        const [sortField, sortValue] = sort.split(':');
        const validSort = validateSort(sortField, sortValue);

        const TIERS_DB = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5'];

        try {
          const tiers = await app.prisma?.tag.findMany({
            where: {
              name: {
                in: publicationTiers?.filter((pt: string) => TIERS_DB.includes(pt))
              }
            }
          });

          const publicationsWithMediatypesOrTiers = await app.prisma?.publication.findMany({
            select: {
              id: true,
              name: true
            },
            where: {
              ...(publicationIds && { id: { in: publicationIds } }),
              ...(publicationMediatypes && { publication_mediatype: { some: { mediatype: { in: publicationMediatypes } } } }),
              ...(publicationTiers && tiers && { publication_tag: { some: { tag_id: { in: tiers?.map((t) => t.id) } } } })
            }
          });

          const journalistsExisting = await app.prismaMediamine?.journalist.findMany({
            select: {
              id: true,
              createdAt: true,
              updatedAt: true,
              uuid: true,
              first_name: true,
              last_name: true,
              email: true,
              mobile: true,
              valid_email: true,
              user_approved: true,
              format_types: true,
              news_types: true,
              role_types: true,
              publications: true,
              regions: true
            },
            where: {
              ...(!selectAll && { uuid: { in: ids } }),
              AND: [
                /**
                 * validEmail url param is resolved into the following condition
                 * 1. if true, resolve the sql query into `valid_email = 'true' OR  user_approved = 'true'`
                 * 2. if false, resolve the sql query into `valid_email = 'false' AND  user_approved = 'false'`
                 */
                {
                  ...(validEmail
                    ? { OR: [{ valid_email: true }, { user_approved: true }] }
                    : { AND: [{ valid_email: false }, { user_approved: false }] })
                },
                {
                  OR: [
                    {
                      first_name: {
                        // TODO: Needs to honour all the search keywords and not only the first
                        contains: name?.split(' ')[0],
                        mode: 'insensitive'
                      }
                    },
                    {
                      last_name: {
                        // TODO: Needs to honour all the search keywords and not only the first
                        contains: name?.split(' ')[0],
                        mode: 'insensitive'
                      }
                    }
                  ]
                }
              ],
              ...(formatTypeIds && {
                format_types: { some: { format_type_id: { in: formatTypeIds } } }
              }),
              ...(newsTypeIds && {
                news_types: { some: { news_type_id: { in: newsTypeIds } } }
              }),
              ...(roleTypeIds && {
                role_types: { some: { role_type_id: { in: roleTypeIds } } }
              }),
              ...(regionIds && {
                regions: { some: { region_id: { in: regionIds } } }
              }),
              ...((publicationIds || publicationMediatypes || publicationTiers) && {
                publications: { some: { publication_id: { in: publicationsWithMediatypesOrTiers?.map((p) => p.id) } } }
              })
            },
            orderBy: validSort ? [{ first_name: 'asc' }, { last_name: 'asc' }] : { first_name: 'asc' }
          });

          // const journalistsExisting = await app.prismaMediamine?.journalist.findMany({
          //   select: {
          //     id: true,
          //     email: true
          //   },
          //   where: {
          //     uuid: { in: ids }
          //   }
          // });

          const journalistsExistingBatches = Array.from(
            { length: journalistsExisting ? Math.ceil(journalistsExisting?.length / Number(limit)) : 0 },
            (_, i) => journalistsExisting?.slice(i * limit, (i + 1) * limit)
          );

          const journalistsExistingBatchResponses: Array<Array<Record<string, string | bigint | boolean>>> = [];
          for (const journalistBatch of journalistsExistingBatches) {
            try {
              const response = await app.validateEmail?.validateBatch(
                journalistBatch?.map(
                  (j) => j.email
                  // TODO: replace with 'valid@example.com' to test
                )
              );
              journalistsExistingBatchResponses.push(
                response!.email_batch.map((eb) => ({
                  ...eb,
                  mediamineId: journalistBatch?.find((j) => lowerCase(j.email) === lowerCase(eb.address))?.id!,
                  mediamineIsValidEmail: isEmailStatusValid(eb.status, eb.sub_status)
                }))
              );
            } catch (e: any) {
              console.error(`validateBatch failed with ${e.response.status} ${e.response.statusText}`);
            }
          }

          const items = journalistsExistingBatchResponses.reduce(
            (memo: Array<Record<string, string | bigint | boolean>>, item) => memo.concat(item),
            []
          );

          for (const item of items) {
            try {
              await app.prismaMediamine?.journalist.update({
                data: {
                  valid_email: Boolean(item.mediamineIsValidEmail),
                  validatedAt: DateTime.now().toISO()
                },
                where: {
                  id: Number(item.mediamineId)
                }
              });
            } catch (e: any) {
              console.error(`journalist.update failed with ${e.code} ${e.message}`);
            }
          }

          return h
            .response({
              items,
              total: items.length
            })
            .code(200);
        } catch (e: any) {
          console.error(`POST /journalist/validate failed with ${e}`);
          return h.response(`POST /journalist/validate failed with ${e}`).code(500);
        }
      }
    });

    server.route({
      method: 'POST',
      path: '/journalist/validate-all',
      handler: async (request, h) => {
        const { limit = '4', subset = '10' } = request.query as RequestQuery;

        const journalistsExisting = await app.prismaMediamine?.journalist.findMany({
          where: {
            valid_email: true
          },
          take: Number(subset)
        });

        const journalistsExistingBatches = Array.from(
          { length: journalistsExisting ? Math.ceil(journalistsExisting?.length / Number(limit)) : 0 },
          (_, i) => journalistsExisting?.slice(i * limit, (i + 1) * limit)
        );

        const journalistsExistingBatchResponses: Array<Array<Record<string, string | bigint | boolean>>> = [];
        for (const journalistBatch of journalistsExistingBatches) {
          try {
            const response = await app.validateEmail?.validateBatch(
              journalistBatch?.map(
                (j) => j.email
                // TODO: replace with 'valid@example.com' to test
              )
            );
            journalistsExistingBatchResponses.push(
              response!.email_batch.map((eb) => ({
                ...eb,
                mediamineId: journalistBatch?.find((j) => lowerCase(j.email) === lowerCase(eb.address))?.id!,
                mediamineIsValidEmail: isEmailStatusValid(eb.status, eb.sub_status)
              }))
            );
          } catch (e: any) {
            console.error(`validateBatch failed with ${e.response.status} ${e.response.statusText}`);
          }
        }

        const items = journalistsExistingBatchResponses.reduce(
          (memo: Array<Record<string, string | bigint | boolean>>, item) => memo.concat(item),
          []
        );

        for (const item of items) {
          try {
            await app.prismaMediamine?.journalist.update({
              data: {
                valid_email: Boolean(item.mediamineIsValidEmail),
                validatedAt: DateTime.now().toISO()
              },
              where: {
                id: Number(item.mediamineId)
              }
            });
          } catch (e: any) {
            console.error(`journalist.update failed with ${e.code} ${e.message}`);
          }
        }

        return h
          .response({
            items,
            total: items.length
          })
          .code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/journalist/{id}/validate',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;

        const journalistExisting = await app.prismaMediamine?.journalist.findFirstOrThrow({
          where: {
            uuid: id
          }
        });

        if (!journalistExisting?.email) {
          console.error('Journalist is missing an email');
          return h.response('Journalist is missing an email').code(400);
        }

        const response = await app.validateEmail?.validate(journalistExisting?.email!);

        const journalist = await app.prismaMediamine?.journalist.update({
          data: {
            valid_email: isEmailStatusValid(response?.success?.status ?? '', response?.success?.subStatus ?? '')
          },
          where: {
            id: journalistExisting?.id
          }
        });

        return h
          .response({
            journalist,
            validation: response
          })
          .code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/journalist/user-approve',
      handler: async (request, h) => {
        const { ids } = request.payload as Utils.Dictionary<Array<string>>;
        const { isUserApproved = true } = request.payload as Utils.Dictionary<boolean>;

        const journalistsExisting = await app.prismaMediamine?.journalist.findMany({
          select: {
            id: true,
            email: true
          },
          where: {
            uuid: { in: ids }
          }
        });

        try {
          const journalists = await app.prismaMediamine?.journalist.updateMany({
            data: {
              user_approved: isUserApproved
            },
            where: {
              id: {
                in: journalistsExisting?.map((je) => je.id)
              }
            }
          });

          return h
            .response({
              items: journalists,
              total: journalists?.count
            })
            .code(200);
        } catch (e: any) {
          console.error(`journalist.update failed with ${e.code} ${e.message}`);
        }
      }
    });

    server.route({
      method: 'POST',
      path: '/journalist/{id}/user-approve',
      handler: async (request, h) => {
        const { id } = request.params as Utils.Dictionary<string>;

        const journalistExisting = await app.prismaMediamine?.journalist.findFirstOrThrow({
          where: {
            uuid: id
          }
        });

        if (!journalistExisting?.email) {
          console.error('Journalist is missing an email');
          return h.response('Journalist is missing an email').code(400);
        }

        const journalist = await app.prismaMediamine?.journalist.update({
          data: {
            user_approved: true
          },
          where: {
            id: journalistExisting?.id
          }
        });

        return h
          .response({
            journalist
          })
          .code(200);
      }
    });

    server.route({
      method: 'POST',
      path: '/journalist/validateEmails',
      handler: async (request, h) => {
        const { emails } = request.payload as Utils.Dictionary<Array<string>>;
        let items: Array<{ email: string; mediamineIsValidEmail: boolean }> | undefined = [];

        try {
          const response = await app.validateEmail?.validateBatch(emails);
          items = response?.email_batch.map((eb) => ({
            email: eb.address,
            mediamineIsValidEmail: isEmailStatusValid(eb.status, eb.sub_status)
          }));
        } catch (e: any) {
          console.error(`validateBatch failed with ${e.response.status} ${e.response.statusText}`);
          return h.response(`validateBatch failed with ${e.response.status} ${e.response.statusText}`).code(500);
        }

        return h.response({ items, total: items?.length }).code(200);
      }
    });

    // TODO: shift to general utils
    server.route({
      method: 'GET',
      path: '/ids',
      options: {
        auth: false
      },
      handler: async (request, h) => {
        const { limit = '10' } = request.query as Utils.Dictionary<string>;

        const ids = Array.from({ length: Number(limit) }, () => uuidv4());

        return h
          .response({
            items: ids,
            total: ids.length
          })
          .code(200);
      }
    });
  }
};
