import { promises as fs } from 'fs';
import { parse } from 'url';
import {
  ApolloServer,
  BaseContext,
  ContextThunk,
  GraphQLRequest,
  HeaderMap,
  HTTPGraphQLRequest,
} from '@apollo/server';
import formidable from 'formidable';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Request parameter conversion options
 */

export type FormidableOptions = formidable.Options;

/**
 * File type used by resolver
 */
export type FormidableFile = formidable.File;

/**
 * Converting NextApiRequest to Apollo's Header
 * Identical header names are overwritten by later values
 * @returns Header in HeaderMap format
 */
export const createHeaders = (req: NextApiRequest) =>
  new HeaderMap(
    Object.entries(req.headers).flatMap<[string, string]>(([key, value]) =>
      Array.isArray(value)
        ? value.flatMap<[string, string]>((v) => (v ? [[key, v]] : []))
        : value
        ? [[key, value]]
        : []
    )
  );

/**
 *  Retrieve search from NextApiRequest
 * @returns search
 */
export const createSearch = (req: NextApiRequest) => parse(req.url ?? '').search ?? '';

/**
 * Make GraphQL requests multipart/form-data compliant
 * @returns [body to be set in executeHTTPGraphQLRequest, function for temporary file deletion]
 */
export const createBody = (req: NextApiRequest, options?: formidable.Options) => {
  const form = formidable(options);
  return new Promise<[GraphQLRequest, () => void]>((resolve, reject) => {
    form.parse(req, async (error, fields, files) => {
      if (error) {
        reject(error);
      } else if (!req.headers['content-type']?.match(/^multipart\/form-data/)) {
        resolve([fields, () => {}]);
      } else {
        if (
          'operations' in fields &&
          'map' in fields &&
          typeof fields.operations === 'string' &&
          typeof fields.map === 'string'
        ) {
          const request = JSON.parse(fields.operations);
          const map: { [key: string]: [string] } = JSON.parse(fields.map);
          Object.entries(map).forEach(([key, [value]]) => {
            value.split('.').reduce((a, b, index, array) => {
              if (array.length - 1 === index) a[b] = files[key];
              else return a[b];
            }, request);
          });
          const removeFiles = () => {
            Object.values(files).forEach((file) => {
              if (Array.isArray(file)) {
                file.forEach(({ filepath }) => {
                  fs.rm(filepath);
                });
              } else {
                fs.rm(file.filepath);
              }
            });
          };
          resolve([request, removeFiles]);
        } else {
          reject(Error('multipart type error'));
        }
      }
    });
  });
};

/**
 * Creating methods
 * @returns method string
 */
export const createMethod = (req: NextApiRequest) => req.method ?? '';

/**
 * Execute a GraphQL request
 */
export const executeHTTPGraphQLRequest = async <Context extends BaseContext>({
  req,
  res,
  apolloServer,
  options,
  context,
}: {
  req: NextApiRequest;
  res: NextApiResponse;
  apolloServer: ApolloServer<Context>;
  context: ContextThunk<Context>;
  options?: FormidableOptions;
}) => {
  const [body, removeFiles] = await createBody(req, options);
  try {
    const httpGraphQLRequest: HTTPGraphQLRequest = {
      method: createMethod(req),
      headers: createHeaders(req),
      search: createSearch(req),
      body,
    };
    const result = await apolloServer.executeHTTPGraphQLRequest({
      httpGraphQLRequest,
      context,
    });
    if (result.body.kind === 'complete') {
      res.end(result.body.string);
    } else {
      for await (const chunk of result.body.asyncIterator) {
        res.write(chunk);
      }
      res.end();
    }
  } finally {
    removeFiles();
  }
};
