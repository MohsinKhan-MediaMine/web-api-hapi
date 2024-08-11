import { Server } from '@hapi/hapi';
import Jwt from '@hapi/jwt';
import { config } from 'dotenv';
import { countryPlugin } from './app/v1/country';
import { feedPlugin } from './app/v1/feed';
import { publicationPlugin } from './app/v1/publication';
import { publicationMediaTypePlugin } from './app/v1/publicationMediaType';
import { publicationTierPlugin } from './app/v1/publicationTier';
import { regionPlugin } from './app/v1/region';
import { tagPlugin } from './app/v1/tag';
import { formatTypePlugin } from './app/v2/formatType';
import { journalistPlugin } from './app/v2/journalist';
import { journalistSearchPlugin } from './app/v2/journalistSearch';
import { journalistSelectPlugin } from './app/v2/journalistSelect';
import { newsTypePlugin } from './app/v2/newsType';
import { roleTypePlugin } from './app/v2/roleType';
const Qs = require('qs');

const result = config();
if (result.error) {
  throw new Error('Unable to load config');
}

const BigIntPrototype: BigInt & { toJSON?: () => string } = BigInt.prototype;
BigIntPrototype.toJSON = function () {
  return this.toString();
};

const init = async (): Promise<Server> => {
  const server: Server = new Server({
    port: 3001,
    host: 'localhost',
    routes: {
      cors: true
    },
    // tls: true,
    // query: {
    //   parser: (query) => {
    //     console.log(query);
    //     return queryString.parse(JSON.stringify(query));
    //   }
    // },
    query: {
      parser: (query) => Qs.parse(query)
    }
  });

  if (!process.env.MEDIAMINE_API_KEY) {
    console.error('MEDIAMINE_API_KEY needs to be defined in env. variables');
  }

  await server.register(Jwt);
  server.auth.strategy('my_jwt_strategy', 'jwt', {
    keys: process.env.MEDIAMINE_API_KEY,
    verify: {
      aud: 'urn:audience:test',
      iss: 'urn:issuer:test',
      sub: false,
      nbf: true,
      exp: true,
      // maxAgeSec: 14400, // 4 hours
      timeSkewSec: 15
    },
    validate: (artifacts: { decoded: { payload: { user: any } } }) => {
      return {
        isValid: true,
        credentials: { user: artifacts.decoded.payload.user }
      };
    }
  });
  server.auth.default('my_jwt_strategy');

  await server.register(require('./db/prisma').plugin);
  await server.register(require('./db/mediamine.prisma').plugin);

  await server.register(require('./externalServices/zerobounce').plugin);

  await server.register(require('./app/root').plugin);
  await server.register<string, void>(countryPlugin);
  await server.register<string, void>(feedPlugin);
  await server.register<string, void>(publicationPlugin);
  await server.register<string, void>(publicationMediaTypePlugin);
  await server.register<string, void>(publicationTierPlugin);
  await server.register<string, void>(regionPlugin);
  await server.register<string, void>(tagPlugin);

  await server.register<string, void>(journalistPlugin);
  await server.register<string, void>(newsTypePlugin);
  await server.register<string, void>(roleTypePlugin);
  await server.register<string, void>(formatTypePlugin);
  await server.register<string, void>(journalistSearchPlugin);
  await server.register<string, void>(journalistSelectPlugin);

  await server.start();
  console.log('Server running on %s', server.info.uri);

  return server;
};

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

init();
