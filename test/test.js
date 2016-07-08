'use strict';

var Potrace = require('../lib/index').Potrace,
    Posterizer = require('../lib/index').Posterizer,
    potrace = new Potrace(),
    posterize,
    fs = require('fs');

potrace.loadImage('./yao.jpg', function(err) {
  if (err) { throw err; }

  fs.writeFileSync('./output-x1.svg', potrace.getSVG(1));
  fs.writeFileSync('./output-x2.svg', potrace.getSVG(2));
  fs.writeFileSync('./output-x0.5.svg', potrace.getSVG(0.5));
  fs.writeFileSync('./output-x0.25.svg', potrace.getSVG(0.25));

  fs.writeFileSync('./output-x1-curves.svg', potrace.getSVG(1, true));
});

posterize = new Posterizer({ blackLevel: 200, samples: 4 });

posterize.loadImage('./yao.jpg', function(err) {
  if (err) { throw err; }
  fs.writeFileSync('./output-posterized-x1.svg', posterize.getSVG(1));
});