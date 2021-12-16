const fs = require('fs');
const SftpClient = require('ssh2-sftp-client');
const client = new SftpClient();

const sliceN = (list, n) => {
  const result = [];
  let idx = 0;
  while (true) {
    const sliced = list.slice(idx, idx + n);
    if (!sliced || !sliced.length) break;
    result.push(sliced);
    idx += n;
  }
  return result;
};
const flatMapInNParallel = async (list, n, fn) => {
  const slicedList = sliceN(list, n);
  let result = [];
  for (list of slicedList) {
    const r = await Promise.all(list.flatMap(fn));
    result.push(...r);
  }
  return Array.prototype.concat.apply([], result);
};

const fetchFilePathList = async (path) => {
  const fetchedPath = await client.list(path);
  const fetchedFile = [];
  const nextTargetPathList = [];
  fetchedPath.forEach((entry) => {
    if (entry.type === 'd') nextTargetPathList.push(`${path}/${entry.name}`);
    if (entry.type === '-') fetchedFile.push({ name: `${path}/${entry.name}`, size: entry.size });
  });
  const fetchedPathFromDir = await flatMapInNParallel(
    nextTargetPathList,
    3,
    fetchFilePathList,
  );
  return fetchedFile.concat(fetchedPathFromDir);
};

const downloadFile = async (path) => {
  const downloadFile = `download/${path.name}`;
  const downloadDir = downloadFile.replace('./', '').replace('/data.csv', '');
  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });
  if (!path.size) return;
  await client.fastGet(path.name, downloadFile);
};

const downloadFileList = (pathList) => flatMapInNParallel(
  pathList,
  3,
  downloadFile,
);

(async () => {
  const hostName = process.argv[2];
  const userName = process.argv[3];
  const privateKeyPath = process.argv[4];

  if (!hostName) {
    console.error('You should input userName first parameter');
    process.exit(1);
  }

  if (!userName) {
    console.error('You should input userName first parameter');
    process.exit(1);
  }
  if (!privateKeyPath) {
    console.error('You should input private key path second parameter');
    process.exit(1);
  }

  await client.connect({
    host: 'ftp.peragaru.com',
    port: 22,
    username: userName,
    privateKey: fs.readFileSync(privateKeyPath),
  });
  const pathList = await fetchFilePathList('.');
  if (!fs.existsSync('download')) fs.mkdirSync('download');
  await downloadFileList(pathList);
  await client.end();
})();

