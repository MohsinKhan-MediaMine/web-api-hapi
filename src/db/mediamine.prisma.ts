import { ApplicationState, Server } from 'hapi';
import { PrismaClient as PrismaClientMediamine } from '../../.prisma/client/mediamine';

exports.plugin = {
  name: 'prismaMediamine',
  version: '1.0.0',
  register: async function (server: Server) {
    const app: ApplicationState & { prismaMediamine?: PrismaClientMediamine } = server.app;
    const prisma: PrismaClientMediamine = new PrismaClientMediamine();
    // prisma.$extends({
    //   query: {
    //     $allModels: {
    //       $allOperations({ model, operation, args, query }) {
    //         console.log(model, operation, args, query);
    //         return query(args);
    //       }
    //     }
    //   }
    // });

    app.prismaMediamine = prisma;

    server.ext({
      type: 'onPostStop',
      method: async (server: Server) => {
        const app: ApplicationState & { prismaMediamine?: PrismaClientMediamine } = server.app;
        app.prismaMediamine = new PrismaClientMediamine();
        app.prismaMediamine.$disconnect();
      }
    });
  }
};
