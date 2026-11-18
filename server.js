import {createServer} from 'node:http';
import { readFile } from 'node:fs'
import { join, extname, sep } from 'node:path'


const hostname = process.env.RENDER ? '0.0.0.0' : '127.0.0.1';
const port = process.env.PORT || 3000;
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer((req, res) => {
  const publicDir = join(import.meta.dirname, 'public');

  let thisFile = req.url === '/' ? 'index.html' : req.url;
  let thisPath = join(publicDir, thisFile)


  if(!thisPath.startsWith(publicDir + sep)){
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }



  readFile(thisPath, (err,data) => {
    if(err){
      res.setHeader('Content-Type', 'text/html')
      res.statusCode = 404;
      res.end('Not found\n' + err);
    }else{
      const type = mimeTypes[extname(thisPath)] || 'application/octet-stream';
      res.setHeader('Content-Type', type);
      res.statusCode = 200;
      res.end(data);
    }
  });

});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});