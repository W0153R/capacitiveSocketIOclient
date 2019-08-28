var util  = require('util');
var app = require('http').createServer(handler);
var io = require('socket.io')(app);
var path = require('path');
var fs = require('fs');
var midi = require('midi');
var output = new midi.output();
var clientsArray = [];
var maxClients = 50;

output.openVirtualPort("XXXXX");
app.listen(8080);

// 45, 50, 53, 45, 50, 53, 47, 50, 53, 47, 52, 55, 47, 52, 55, 45, 48, 55

var notes = [ [ 33, 38, 41, 33, 38, 41, 35, 38, 41, 35, 40, 43, 35, 40, 43, 33, 36, 43 ],
//              [ 36 ],
              [ 57, 62, 65, 57, 62, 65, 59, 62, 65, 59, 64, 67, 59, 64, 67, 57, 60, 67 ],
              [ 60, 62, 65, 60, 62, 65, 61, 62, 65, 61, 64, 67, 61, 64, 67, 60, 67 ],
              [ 69, 60, 71, 70, 61, 63 ],
              [ [ 69, 69, 69, 69, 62, 63, 64, 67, 68 ],
                [ 60, 60, 60, 61, 65, 66, 67, 71, 71 ],
                [ 64, 64, 64, 64, 69, 70, 71, 62, 63 ],
                [ 0, 0, 67, 67, 0, 0, 0, 0, 0 ] ] ];
var noteCounters = [ [ 0, 0, 0, 0, 0 ], [ 0, 0, 0, 0, 0 ] ];

function handler (req, res) {
  var pathname = req.url;
  if (pathname == '/') {
    pathname = '/index.html';
  }

  var ext = path.extname(pathname);
  var typeExt = {
    '.html': 'text/html',
    '.js':   'text/javascript',
    '.css':  'text/css'
  };
  var contentType = typeExt[ext] || 'text/plain';

  fs.readFile(__dirname + pathname, function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading ' + pathname);
    }
    res.writeHead(200,{ 'Content-Type': contentType });
    res.end(data);
  });
}

function sendMidi(data,velocity) {
  var noteOn = 1,
      chord = false,
      chordLength = 0,
      nList = 0,
      command = 0,
      note = 0,
      noteArr = [];

  if (data.sensor1 !== undefined) { command = 144; }
  if (data.sensor2 !== undefined) { command = 145; nList = 1; }
  if (data.sensor3 !== undefined) { command = 146; nList = 2; }
  if (data.sensor4 !== undefined) { command = 147; nList = 3; }
  if (data.sensor5 !== undefined) { command = 148; nList = 4; chord = true; chordLength = notes[nList].length; }

  if (velocity == '0') {
    command -= 16;
    noteOn = 0;
  }

  if (chord) {
    for (var i = 0; i < chordLength; i++) {
      noteArr.push(notes[nList][i][noteCounters[noteOn][nList]]);
    }
  } else {
    note = notes[nList][noteCounters[noteOn][nList]];
  }

  if (chord) {
    for (var i = 0; i < chordLength; i++) {
      output.sendMessage([command,noteArr[i],velocity]);
    }
  } else {
//    console.log(note);
    output.sendMessage([command,note,velocity]);
  }

  if (noteOn) {
    var notesLength = chord ? notes[nList][0].length : notes[nList].length,
        currentNote = noteCounters[1][nList],
        nextNote = currentNote + 1;
    noteCounters[0][nList] = currentNote;
    noteCounters[1][nList] = (nextNote < notesLength) ? nextNote : 0;
  }
}

var nsp = io.of('/admin');
nsp.on('connection', function(socket){
  console.log('Admin heeft verbinding gemaakt!');
  socket.on('reset', function(data) {
    io.emit('reset', { message : data});
  });
  socket.on('reboot', function(data) {
    io.emit('reboot', { message : data});
  });
  socket.on('input', function(data) {
    nsp.emit('input', data);
    sendMidi(data, data[Object.keys(data)[0]]);
  });
});

io.on('connection', function (socket) {
  var newID = -1;
  var noteCounter = 0;
	for (var numberFound, j, i = 0; i < maxClients; i++) {
		for (j = 0; j < clientsArray.length; j++) {
			numberFound=false;
			if (clientsArray[j][1] == i) {
				numberFound = true;
				break;
			}
		}
		if (!numberFound) {
			newID = i;
			break;
		}
	}
	if (newID > -1) {
	//	io.to(socket.id).emit('login', i);
		clientsArray.push([socket.id,i]);
		console.log('Total connected: ' + clientsArray.length);
    nsp.emit('clientCount', clientsArray.length);
	} else {
	//	io.to(socket.id).emit('login', 99);
	}
  socket.on('disconnect', function(){
		for (var i = 0; i < clientsArray.length; i++) {
			if (clientsArray[i][0] == socket.id) {
		    clientsArray.splice(i, 1);
				console.log('Total connected: ' + clientsArray.length);
        nsp.emit('clientCount', clientsArray.length);
				break;
			}
		}
  });
  socket.on('input', function(data) {
    nsp.emit('input', data);
    console.log(data);
    sendMidi(data, data[Object.keys(data)[0]]);
  });
  socket.on('ping', function(data) {
    io.to(socket.id).emit('ping', { message : 'pong' });
  });
  socket.on('debug', function(data) {
    console.log(data);
  });
});

process.on('exit', function () {
  output.closePort();
});

process.on('SIGINT', function () {
  output.closePort();
  console.log('Ctrl-C...');
  process.exit(2);
});

process.on('uncaughtException', function(e) {
  output.closePort();
  console.log('Uncaught Exception...');
  console.log(e.stack);
  process.exit(99);
});
