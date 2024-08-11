import { PrismaClient } from '@prisma/client';
import { ApplicationState, Server } from 'hapi';

exports.plugin = {
  name: 'prisma',
  version: '1.0.0',
  register: async function (server: Server) {
    const app: ApplicationState & { prisma?: PrismaClient } = server.app;
    const prisma: PrismaClient = new PrismaClient();
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

    app.prisma = prisma;

    server.ext({
      type: 'onPostStop',
      method: async (server: Server) => {
        const app: ApplicationState & { prisma?: PrismaClient } = server.app;
        app.prisma = new PrismaClient();
        app.prisma.$disconnect();
      }
    });
  }
};
