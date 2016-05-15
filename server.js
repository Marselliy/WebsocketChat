global.api = {};
api.fs = require('fs');
api.http = require('http');
api.websocket = require('websocket');
api.linkifyHtml = require('linkifyjs/html');

String.prototype.replaceAll = function(search, replacement) {
  var target = this;
  return target.replace(new RegExp(search, 'g'), replacement);
};

var index = api.fs.readFileSync('./index.html');
var smiles = {};
var nickname_labels_pool = [];
var nickname_labels_map = {};
var server = api.http.createServer(function(req, res) {
  var path = req.url;
  if (path.includes('smiles')) {
    var smile = api.fs.readFileSync(__dirname + path);
    res.writeHead(200, {
      'Content-Type': 'image/png'
    });
    res.end(smile, 'binary');
  } else if (path.includes('nickname_labels')) {
    var label = api.fs.readFileSync(__dirname + path);
    res.writeHead(200, {
      'Content-Type': 'image/png'
    });
    res.end(label, 'binary');
  } else {
    res.writeHead(200);
    res.end(index);
  }
});

var processMessage = function(message) {
  var res = message;
  (res.match(/<(\/*?)(?!(em|p|br\s*\/|strong))\w+?.+?>/igm) || []).map(function(item) {
    console.log('item' + item);
    res = res.replaceAll(item, '');
  });
  for (var key in smiles) {
    res = res.replaceAll(key, '<img src="' + smiles[key] + '" />');
  }
  res = api.linkifyHtml(res, {});
  return res;
}

api.fs.readdir(__dirname + '\\nickname_labels\\', function(err, files) {
  files.map(function(item) {
    nickname_labels_pool.push('\\nickname_labels\\' + item);
  })
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

  var label_index = Math.floor(Math.random() * nickname_labels_pool.length);
  console.log(label_index + ' ' + nickname_labels_pool[label_index]);
  nickname_labels_map[connection.remoteAddress] = {
    label: nickname_labels_pool[label_index],
    color: '#' + ("000000" + Math.random().toString(16).slice(2, 8).toUpperCase()).slice(-6)
  };
  nickname_labels_pool.splice(label_index, 1);

  console.log('Connected ' + connection.remoteAddress);
  clients.forEach(function(client) {
    if (client != connection)
      client.send(JSON.stringify({
        type: 'connected',
        'data': nickname_labels_map[connection.remoteAddress]
      }));
  });

  api.fs.readdir(__dirname + '\\smiles\\', function(err, files) {
    connection.send(JSON.stringify({
      type: 'smiles',
      'data': files.map(function(item) {
        return '/smiles/' + item;
      })
    }));
    for (var file in files) {
      smiles[':' + files[file].substring(0, files[file].lastIndexOf('.')) + ':'] = '/smiles/' + files[file];
    }
  });
  console.log('Sent smiles');

  connection.on('message', function(message) {
    var dataName = message.type + 'Data',
      data = message[dataName];
    console.log('Received: ' + data);

    data = processMessage(data);

    clients.forEach(function(client) {
      client.send(JSON.stringify({
        type: 'message',
        label: nickname_labels_map[connection.remoteAddress],
        'data': data
      }));
    });
  });
  connection.on('close', function(reasonCode, description) {
    console.log('Disconnected ' + connection.remoteAddress);
    clients.forEach(function(client) {
      if (client != connection)
        client.send(JSON.stringify({
          type: 'disconnected',
          'data': nickname_labels_map[connection.remoteAddress]
        }));
    });
    nickname_labels_pool.push(nickname_labels_map[connection.remoteAddress]['label']);
  });
});
