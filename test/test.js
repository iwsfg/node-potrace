'use strict';

var lib = require('../lib/index'),
    fs = require('fs'),
    Jimp = require('jimp');

lib.trace('./yao.jpg', function(err, svg) {
  if (err) { throw err; }
  fs.writeFileSync('./output.svg', svg);
});

lib.posterize('./yao.jpg', function(err, svg) {
  if (err) { throw err; }
  fs.writeFileSync('./output-posterized.svg', svg);
});

// Jimp instance as image source

Jimp.read('./yao.jpg', function(err, img) {
  if (err) { throw err; }

  lib.trace(img, function(err, svg) {
    if (err) { throw err; }
    fs.writeFileSync('./output-from-jimp-instance.svg', svg);
  });
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