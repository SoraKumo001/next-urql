import { promises as fs } from 'fs';
import { parse } from 'url';
import { GraphQLRequest, HeaderMap } from '@apollo/server';
import formidable from 'formidable';
import type { NextApiRequest } from 'next';

/**
 * NextApiRequestをApolloのHeaderに変換する
 * 馬鹿丁寧に変換していますが、同一ヘッダ名は後の値が上書き
 * @returns HeaderMap形式のヘッダ
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
 * NextApiRequestからsearchを取り出す
 * @returns search
 */
export const createSearch = (req: NextApiRequest) => parse(req.url ?? '').search ?? '';

/**
 * GraphQLのリクエストをmultipart/form-data 対応にする
 * @returns [executeHTTPGraphQLRequestに設定するbody,一時ファイル削除用ファンクション]
 */
export const createGraphQLRequest = (req: NextApiRequest) => {
  const form = formidable();
  return new Promise<[GraphQLRequest, () => void]>((resolve, reject) => {
    form.parse(req, async (_, fields, files) => {
      if (!req.headers['content-type']?.match(/^multipart\/form-data/)) {
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
