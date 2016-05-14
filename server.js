global.api = {};
api.fs = require('fs');
api.http = require('http');
api.websocket = require('websocket');

var index = api.fs.readFileSync('./index.html');
var smiles = {};
var server = api.http.createServer(function(req, res) {

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};
  var path = req.url;
  if (path.includes('smiles')) {
    var smile = api.fs.readFileSync(__dirname + path);
    res.writeHead(200, {'Content-Type': 'image/png' });
    res.end(smile, 'binary');
  } else {
    res.writeHead(200);
    res.end(index);
  }
});

server.listen(80, function() {
  console.log('Listen port 80');
});

var ws = new api.websocket.server({
  httpServer: server,
  autoAcceptConnections: false
});

var clients = [];

ws.on('request', function(req) {
  var connection = req.accept('', req.origin);
  clients.push(connection);
  console.log('Connected ' + connection.remoteAddress);
  clients.forEach(function(client) {
    if (client != connection)
      client.send(JSON.stringify({type : 'connected', 'data' : connection.remoteAddress}));
  });

  api.fs.readdir(__dirname + '\\smiles\\', function(err, files) {
    connection.send(JSON.stringify({type : 'smiles', 'data' : files.map(function (item) {
      return '/smiles/' + item;
    })}));
    for (var file in files) {
        smiles[':' + files[file].substring(0, files[file].lastIndexOf('.')) + ':'] = '/smiles/' + files[file];
    }
  });
  console.log('Sent smiles');

  connection.on('message', function(message) {
    var dataName = message.type + 'Data',
        data = message[dataName];
    console.log('Received: ' + data);
    clients.forEach(function(client) {
      for (var key in smiles) {
        data = data.replaceAll(key, '<img src="' + smiles[key] + '" />');
      }
      client.send(JSON.stringify({type : 'message', 'data' : data}));
    });
  });
  connection.on('close', function(reasonCode, description) {
    console.log('Disconnected ' + connection.remoteAddress);
    clients.forEach(function(client) {
    if (client != connection)
      client.send(JSON.stringify({type : 'disconnected', 'data' : connection.remoteAddress}));
    });
  });
});
