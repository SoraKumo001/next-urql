import { promises as fs } from 'fs';
import { ApolloServer } from '@apollo/server';
import { IResolvers } from '@graphql-tools/utils';
import { gql } from 'urql';
import { executeHTTPGraphQLRequest, FormidableFile } from '../../libs/apollo-tools';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * GraphQLのType設定
 */
const typeDefs = gql`
  # Return date
  scalar Date
  type Query {
    date: Date!
  }

  # Return file information
  type File {
    name: String!
    type: String!
    value: String!
  }
  scalar Upload
  type Mutation {
    upload(file: Upload!): File!
  }
`;

/**
 * Set Context type.
 */
type Context = { req: NextApiRequest; res: NextApiResponse };

/**
 * GraphQLのResolver
 */
const resolvers: IResolvers<Context> = {
  Query: {
    date: async (_context, _args) => new Date(),
  },
  Mutation: {
    upload: async (_context, { file }: { file: FormidableFile }) => {
      return {
        name: file.originalFilename,
        type: file.mimetype,
        value: await fs.readFile(file.filepath, { encoding: 'utf8' }),
      };
    },
  },
};

/**
 * apolloServer
 */
const apolloServer = new ApolloServer<Context>({
  typeDefs,
  resolvers: resolvers,
});
apolloServer.start();

/**
 * APIRoute handler for Next.js
 */
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  //Convert NextApiRequest to body format for GraphQL (multipart/form-data support).
  executeHTTPGraphQLRequest({
    req,
    res,
    apolloServer,
    context: async () => ({ req, res }),
    options: {
      //Maximum upload file size set at 10 MB
      maxFileSize: 10 * 1024 * 1024,
    },
  });
};

export default handler;

export const config = {
  api: {
    bodyParser: false,
  },
};
