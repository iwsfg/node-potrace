# node-potrace
A NodeJS-compatible fork of [Potrace in JavaScript](https://github.com/kilobtye/potrace) by [kilobtye](https://github.com/kilobtye), which is in turn a port of [the original Potrace](http://potrace.sourceforge.net)

### Demo
[online demo of the browser version](http://kilobtye.github.io/potrace/)

### Motivation
I wanted a pure JavaScript lib for tracing images, that I could use within NodeJS.  This fork of kilobtye's lib removes the browser dependency and adds an option for controlling the initial image processing (`blacklevel`).

### Usage

```
loadImage(file) : load image from File API or URL
    input color/grayscale image is simply converted to binary image. no pre-process is performed.
 
setParameter({para1: value, ...}) : set parameters
    parameters:
        turnpolicy ("black" / "white" / "left" / "right" / "minority" / "majority")
            how to resolve ambiguities in path decomposition. (default: "minority")       
        turdsize
            suppress speckles of up to this size (default: 2)
        optcurve (true / false)
            turn on/off curve optimization (default: true)
        alphamax
            corner threshold parameter (default: 1)
        opttolerance 
            curve optimization tolerance (default: 0.2)
        blacklevel (0-255)
            below this value of brightness a pixel is considered black (default: 128)

process(callback) : wait for the image be loaded, then run potrace algorithm, then call callback function.

getSVG(size, opt_type) : return a string of generated SVG image.
    result_image_size = original_image_size * size
    optional parameter opt_type can be "curve"
```

### Example

Install:
```sh
npm install potrace
```

Run:
```js
var Potrace = require('potrace').Potrace;

var tracer = new Potrace({
    turnpolicy: TURNPOLICY_MINORITY,
    blacklevel: 135
});

tracer.loadImage(filePath, function(err){
    var svg = tracer.getSVG();
    
    // Get another SVG with different parameters
    
    tracer.setProperty({ blacklevel: 128 });
    var svg2 = tracer.getSVG();
    
    /* ... */
});
```