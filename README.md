# node-potrace
A NodeJS-compatible fork of [Potrace in JavaScript](potrace-by-kilobtye) with some additions, which is in turn a port of [the original Potrace](potrace) — a tool for tracing bitmaps.

## Example and demo

| **Original image** | **Potrace output**           | **Posterized output**                   |
|--------------------|------------------------------|-----------------------------------------|
| ![](test/yao.jpg)  | ![](https://cdn.rawgit.com/tooolbox/node-potrace/9ee822d/test/example-output.svg) | ![](https://cdn.rawgit.com/tooolbox/node-potrace/9ee822d/test/example-output-posterized.svg) |

(Example image inherited from [online demo of the browser version](potrace-js-demo))

## Usage

Install

```sh
npm install potrace
```

Basic usage

```js
var potrace = require('potrace'),
    fs = require('fs');

potrace.trace('./path/to/image.png', function(err, svg) {
  if (err) throw err;
  fs.writeFileSync('./output.svg', svg);
});
```

You can also provide a configuration object as a second argument.

```js
var params = {
  background: '#49ffd2',
  color: 'blue',
  threshold: 120
};

potrace.trace('./path/to/image.png', params, function(err, svg) {
  /*...*/
});
```

If you want to run Potrace algorithm multiple times on the same image with different threshold setting and merge results together in a single file - `posterize` method does exactly that.

```js
potrace.posterize('./path/to/image.png', { threshold: 180, steps: 4 }, function(err, svg) {
  /*...*/
});

// or if you know exactly where you want to break it on different levels

potrace.posterize('./path/to/image.png', { steps: [40, 85, 135, 180] }, function(err, svg) {
  /*...*/
});
```

### Advanced usage and configuration

Both `trace` and `posterize` methods return instances of `Potrace` and `Posterizer` classes respectively to a callback function as third argument. 

You can also instantiate these classes directly:

```js
var potrace = require('potrace');

// Tracing

var trace = new potrace.Potrace();

// You can also pass configuration object to the constructor
trace.setParameters({
  threshold: 128,
  color: '#880000'
});

trace.loadImage('path/to/image.png', function(err) {
  if (err) throw err;

  trace.getSVG(); // returns SVG document contents
  trace.getPathTag(); // will return just <path> tag
  trace.getSymbol('traced-image'); // will return <symbol> tag with given ID
});

// Posterization

var posterizer = new potrace.Posterize();

posterizer.loadImage('path/to/image.png', function(err) {
  if (err) throw err;
  
  posterizer.setParameter({
    color: '#ccc',
    background: '#222',
    steps: 3,
    threshold: 200,
    fillStrategy: potrace.Posterize.FILL_MEAN
  });
  
  posterizer.getSVG();
  // or
  posterizer.getSymbol('posterized-image');
});
```

Callback function provided to `loadImage` methods will be executed in context of the `Potrace`/`Posterizer` instance, so if it doesn't go against your code style - you can just do

```js
new potrace.Potrace()
  .loadImage('path/to/image.bmp', function() {
    if (err) throw err;
    this.getSymbol('foo');
  });
```

[Jimp module](jimp) is used on the back end, so first argument accepted by `loadImage` method could be anything Jimp can read: a `Buffer`, local path or a url string. Supported formats are: PNG, JPEG or BMP

#### Parameters

`Potrace` class expects following parameters:

- **turnPolicy** - how to resolve ambiguities in path decomposition. Possible values are exported as constants: `TURNPOLICY_BLACK`, `TURNPOLICY_WHITE`, `TURNPOLICY_LEFT`, `TURNPOLICY_RIGHT`, `TURNPOLICY_MINORITY`, `TURNPOLICY_MAJORITY`. Refer to [this document](potrace-algorithm) for more information (page 4)  
  (default: `TURNPOLICY_MINORITY`)
- **turdSize** - suppress speckles of up to this size   
  (default: 2)
- **alphaMax** - corner threshold parameter   
  (default: 1)
- **optCurve** - curve optimization   
  (default: true)
- **optTolerance** - curve optimization tolerance   
  (default: 0.2)
- **threshold** - threshold below which color is considered black.
  Should be a number in range 0..255 or `THRESHOLD_AUTO` in which case threshold will be selected automatically using [Algorithm For Multilevel Thresholding](multilevel-thresholding)  
  (default: `THRESHOLD_AUTO`)  
- **blackOnWhite** - specifies colors by which side from threshold should be turned into vector shape  
  (default: `true`)  
- **color** - Fill color. Will be ignored when exporting as \<symbol\>. (default: `COLOR_AUTO`, which means black or white, depending on `blackOnWhite` property)
- **background** - Background color. Will be ignored when exporting as \<symbol\>. By default is not present (`COLOR_TRANSPARENT`)

`Posterizer` class has same methods as `Potrace`, in exception of `.getPathTag()`. 
Configuration object is extended with following properties:

- **steps** - Desired number of layers or an array of grey levels where each step should end (in range 0..255).  
  (default: `STEPS_AUTO` which will result in 3 or 4 levels, depending on `threshold` value)  
  Notes:  
    - When number of steps is greater than 10 - additional layer could be added for darkest/brightest colors if needed to ensure presence of probably-important-at-this-point details like shadows or line art.
    - If array was provided and biggest color stop in this array is greater than `threshold` parameter - `threshold` is getting ignored. Otherwise it's added to array automatically
    - Big number of layers is not recommended, because result may end up being brighter overall than it should due to math error during rendering. Also automatic (`rangeDistribution: Posterizer.RANGES_AUTO`) calculation of more than 4-5 color stops can take significant amount of time (minutes or hours, growing exponentially)  
- **fillStrategy** - determines how colors from a gradation will be selected for each layer. Possible values exported as constants:  
    - `FILL_DOMINANT` - most popular color in range (used by default), 
    - `FILL_MEAN` - arithmetic mean (average), 
    - `FILL_MEDIAN` - median color, 
    - `FILL_SPREAD` - ignores color information of the image and just spreads colors equally in range 0..\<threshold\> (or \<threshold\>..255 if `blackOnWhite` is set to `false`),
- **rangeDistribution** - how color stops should be spread. Ignored if `steps` is array. Possible values are:
    - `RANGES_AUTO` - Performs automatic thresholding (using [Algorithm For Multilevel Thresholding](multilevel-thresholding)). Works especially well with already posterized sources.  
      *(used by default)*
    - `RANGES_EQUAL` - Ignores color information of the image and breaks available color space into equal chunks 
    
## Thanks to

- Peter Selinger for [original Potrace tool and algorithm](potrace)
- @kilobtye for original [javascript port](potrace-by-kilobtye)

## License

The GNU General Public License version 2 (GPLv2). Please see [License File](LICENSE) for more information.

[potrace]: http://potrace.sourceforge.net/
[potrace-algorithm]: http://potrace.sourceforge.net/potrace.pdf
[multilevel-thresholding]: http://www.iis.sinica.edu.tw/page/jise/2001/200109_01.pdf
[potrace-by-kilobtye]: https://github.com/kilobtye/potrace
[potrace-js-demo]: http://kilobtye.github.io/potrace/
[jimp]: https://github.com/oliver-moran/jimp