const http = require('http');
const PORT = parseInt(process.env.PORT) || 3000;
console.log('Starting on port', PORT);
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK - Node is running on port ' + PORT);
}).listen(PORT, '0.0.0.0', () => {
  console.log('Listening on', PORT);
});
