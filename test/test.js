'use strict';

var lib = require('../lib/index'),
    fs = require('fs');

lib.trace('./yao.jpg', function(err, svg) {
  if (err) { throw err; }
  fs.writeFileSync('./output.svg', svg);
});

lib.posterize('./yao.jpg', function(err, svg) {
  if (err) { throw err; }
  fs.writeFileSync('./output-posterized.svg', svg);
});

// Generating example for readme with hand-picked thresholds

lib.trace('./yao.jpg', { threshold: 128 }, function(err, svg) {
  if (err) { throw err; }
  fs.writeFileSync('./example-output.svg', svg);
});

lib.posterize('./yao.jpg', { steps: [50, 85, 120, 165, 220] }, function(err, svg) {
  if (err) { throw err; }
  fs.writeFileSync('./example-output-posterized.svg', svg);
});