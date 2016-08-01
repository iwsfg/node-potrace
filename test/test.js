'use strict';

var lib = require('../lib/index'),
    fs = require('fs');

lib.trace('./yao.jpg', function(err, svg) {
  fs.writeFileSync('./output.svg', svg);
});

lib.posterize('./yao.jpg', { threshold: 200, steps: 4 }, function(err, svg) {
  fs.writeFileSync('./output-posterized.svg', svg);
});