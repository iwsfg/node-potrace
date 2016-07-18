'use strict';

var Potrace = require('../lib/index').Potrace,
    Posterizer = require('../lib/index').Posterizer,
    fs = require('fs'),
    potrace, posterize;

potrace = new Potrace();
potrace.loadImage('./yao.jpg', function(err) {
  if (err) { throw err; }
  fs.writeFileSync('./output.svg', potrace.getSVG());
});

posterize = new Posterizer({ blackLevel: 200, samples: 4 });
posterize.loadImage('./yao.jpg', function(err) {
  if (err) { throw err; }
  fs.writeFileSync('./output-posterized.svg', posterize.getSVG());
});