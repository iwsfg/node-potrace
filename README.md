# node-potrace
A NodeJS-compatible fork of [Potrace in JavaScript](https://github.com/kilobtye/potrace) by [kilobtye](https://github.com/kilobtye), which is in turn a port of [the original Potrace](http://potrace.sourceforge.net)

### Demo
[online demo of the browser version](http://kilobtye.github.io/potrace/)

### Motivation
I wanted a pure JavaScript lib for tracing images, that I could use within NodeJS. This fork of kilobtye's lib removes the browser dependency and adds an option for controlling the initial image processing (`blacklevel`).

### Usage

```
loadImage(file, callback) : load image from File API or URL
    input color/grayscale image is simply converted to binary image. no pre-process is performed.
 
setParameters({para1: value, ...}) : set parameters
    parameters:
        turnPolicy ("black" / "white" / "left" / "right" / "minority" / "majority")
            how to resolve ambiguities in path decomposition. (default: "minority")       
        turdSize
            suppress speckles of up to this size (default: 2)
        optCurve (true / false)
            turn on/off curve optimization (default: true)
        alphaMax
            corner threshold parameter (default: 1)
        optTolerance 
            curve optimization tolerance (default: 0.2)
        blackLevel (0-255)
            below this value of brightness a pixel is considered black (default: 128)

getSVG() : return a string of generated SVG image.
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
    turnPolicy: TURNPOLICY_MINORITY,
    blackLevel: 135
});

tracer.loadImage(filePath, function(err){
    var svg = tracer.getSVG();
    
    // Get another SVG with different parameters
    
    tracer.setParameters({ blackLevel: 128 });
    var svg2 = tracer.getSVG();
    
    /* ... */
});
```