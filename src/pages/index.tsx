import { gql, useClient, useMutation, useQuery } from 'urql';

// 日付を取り出す
const QUERY = gql`
  query date {
    date
  }
`;

// ファイルをアップロードする
const UPLOAD = gql`
  mutation Upload($file: Upload!) {
    upload(file: $file) {
      name
      type
      value
    }
  }
`;

const Page = () => {
  const [{ data }, refetch] = useQuery({ query: QUERY });
  const [{ data: file }, upload] = useMutation(UPLOAD);

  return (
    <>
      <a target="_blank" href="https://github.com/SoraKumo001/next-apollo-server" rel="noreferrer">
        Source code
      </a>
      <hr />
      {/* SSRされたデータはrefetchで更新可能 */}
      <button onClick={() => refetch({ requestPolicy: 'network-only' })}>日付更新</button>{' '}
      {/* 日付がSSRされて出力される */}
      {data?.date && new Date(data.date).toLocaleString('ja-jp', { timeZone: 'Asia/Tokyo' })}
      {/* ここから下はファイルアップロードサンプル */}
      <div
        style={{
          height: '100px',
          width: '100px',
          background: 'lightgray',
          marginTop: '8px',
          padding: '8px',
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          const file = e.dataTransfer.files[0];
          if (file) {
            upload({ file });
          }
          e.preventDefault();
        }}
      >
        Upload Area
      </div>
      {/* アップロード動作確認のため、戻ってきたファイルデータの情報表示 */}
      {file && <pre>{JSON.stringify(file, undefined, '  ')}</pre>}
    </>
  );
};

export default Page;
