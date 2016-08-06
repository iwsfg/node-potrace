'use strict';

var Potrace = require('./Potrace');
var utils = require('./utils');

/**
 * Takes multiple samples using {@link Potrace} with different threshold
 * settings and combines output into a single file.
 *
 * @param {Posterizer~Options} [options]
 * @constructor
 */
function Posterizer(options) {
  this._potrace = new Potrace();

  this._calculatedThreshold = null;
  
  this._params = {
    threshold: Potrace.THRESHOLD_AUTO,
    blackOnWhite: true,
    steps: Posterizer.STEPS_AUTO,
    background: Potrace.COLOR_TRANSPARENT,
    fillStrategy: Posterizer.FILL_DOMINANT,
    rangeDistribution: Posterizer.RANGES_AUTO
  };

  if (options) {
    this.setParameters(options);
  }
}

Posterizer.STEPS_AUTO = -1;
Posterizer.FILL_SPREAD = 'spread';
Posterizer.FILL_DOMINANT = 'dominant';
Posterizer.FILL_MEDIAN = 'median';
Posterizer.FILL_MEAN = 'mean';

Posterizer.RANGES_AUTO = 'auto';
Posterizer.RANGES_EQUAL = 'equal';


Posterizer.prototype = {
	/**
   * Fine tuning to color ranges.
   *
   * If last range (featuring most saturated color) is larger than 10% of color space (25 units)
   * then we want to add another color stop, that hopefully will include darkest pixels, improving presense of
   * shadows and lineart
   *
   * @param ranges
   * @private
   */
  _addExtraColorStop: function(ranges) {
    var blackOnWhite = this._params.blackOnWhite;
    var lastColorStop = ranges[ranges.length - 1];
    var lastRangeFrom = blackOnWhite ? 0 : lastColorStop.value;
    var lastRangeTo = blackOnWhite ? lastColorStop.value : 255;

    if (lastRangeTo - lastRangeFrom > 25 && lastColorStop.colorIntensity !== 1) {
      var histogram = this._getImageHistogram();
      var levels = histogram.getStats(lastRangeFrom, lastRangeTo).levels;

      var newColorStop = levels.mean + levels.stdDev <= 25 ? levels.mean + levels.stdDev
        : levels.mean - levels.stdDev <= 25 ? levels.mean - levels.stdDev
        : 25;

      var newStats = (blackOnWhite ? histogram.getStats(0, newColorStop) : histogram.getStats(newColorStop, 255));
      var color = newStats.levels.mean;

      ranges.push({
        value: Math.abs((blackOnWhite ? 0 : 255) - newColorStop),
        colorIntensity: (blackOnWhite ? 255 - color : color) / 255
      });
    }

    return ranges;
  },


	/**
   * Calculates color intensity for each element of numeric array
   * 
   * @param {number[]} colorStops
   * @returns {{ levels: number, colorIntensity: number }[]}
   * @private
   */
  _calcColorIntensity: function(colorStops) {
    var blackOnWhite = this._params.blackOnWhite;
    var colorSelectionStrat = this._params.fillStrategy;
    var histogram = colorSelectionStrat !== Posterizer.FILL_SPREAD ? this._getImageHistogram() : null;
    var fullRange = Math.abs(this._paramThreshold() - (blackOnWhite ? 0 : 255));

    return colorStops.map(function(threshold, index) {
      var nextValue = index + 1 === colorStops.length ? (blackOnWhite ? 0 : 255) : colorStops[index + 1];
      var rangeStart = Math.round(blackOnWhite ? nextValue : threshold);
      var rangeEnd = Math.round(blackOnWhite ? threshold : nextValue);
      var factor = index / (colorStops.length - 1);
      var intervalSize = rangeEnd - rangeStart;

      var color;

      switch (colorSelectionStrat) {
        case Posterizer.FILL_SPREAD:
          // We want it to be 0 (255 when white on black) at the most saturated end, so...
          color = (blackOnWhite ? rangeStart : rangeEnd)
            + (blackOnWhite ? 1 : -1) * intervalSize * Math.max(0.5, fullRange / 255) * factor;
          break;
        case Posterizer.FILL_DOMINANT:
          var padding = Math.round(intervalSize * 0.1);
          color = blackOnWhite
            ? histogram.getDominantColor(rangeStart, rangeEnd - padding, Math.min(5, intervalSize))
            : histogram.getDominantColor(rangeStart + padding, rangeEnd, Math.min(5, intervalSize));
          break;
        case Posterizer.FILL_MEAN:
          color = histogram.getStats(rangeStart, rangeEnd).levels.mean;
          break;
        case Posterizer.FILL_MEDIAN:
          color = histogram.getStats(rangeStart, rangeEnd).levels.median;
          break;
      }

      return {
        value: threshold,
        colorIntensity: (blackOnWhite ? 255 - color : color) / 255
      };
    });
  },

	/**
   * @returns {Histogram}
   * @private
   */
  _getImageHistogram: function() {
    return this._potrace._luminanceData.histogram();
  },

	/**
   * Processes threshold, steps and rangeDistribution parameters and returns normalized array of color stops
   * @returns {*}
   * @private
   */
  _getRanges: function() {
    var steps = this._paramSteps();

    if (!Array.isArray(steps)) {
      return this._params.rangeDistribution === Posterizer.RANGES_AUTO
        ? this._getRangesAuto()
        : this._getRangesEquallyDistributed();
    }

    // Steps is array of thresholds and we want to preprocess it

    var colorStops = [];
    var threshold = this._paramThreshold();
    var lookingForDarkPixels = this._params.blackOnWhite;

    steps.forEach(function(item) {
      if (colorStops.indexOf(item) === -1 && utils.between(item, 1, 254)) {
        colorStops.push(item);
      }
    });

    if (!colorStops.length) {
      colorStops.push(threshold);
    }

    colorStops = colorStops.sort(function (a, b) {
      return a < b === lookingForDarkPixels ? 1 : -1;
    });

    if (lookingForDarkPixels && colorStops[0] < threshold) {
      colorStops.unshift(threshold);
    } else if (!lookingForDarkPixels && colorStops[colorStops.length - 1] > threshold) {
      colorStops.push(threshold);
    }

    return this._calcColorIntensity(colorStops);
  },

  /**
   * Calculates given (or lower) number of thresholds using Otsu's algorithm
   * @returns {*}
   * @private
   */
  _getRangesAuto: function() {
    var histogram = this._getImageHistogram();
    var steps = this._paramSteps(true);
    var colorStops;

    if (this._params.threshold === Potrace.THRESHOLD_AUTO) {
      colorStops = histogram.multilevelThresholding(steps);
    } else {
      var threshold = this._paramThreshold();

      colorStops = this._params.blackOnWhite
        ? histogram.multilevelThresholding(steps - 1, 0, threshold)
        : histogram.multilevelThresholding(steps - 1, threshold, 255);

      if (this._params.blackOnWhite) {
        colorStops.push(threshold);
      } else {
        colorStops.unshift(threshold);
      }
    }

    if (this._params.blackOnWhite) {
      colorStops = colorStops.reverse();
    }

    return this._calcColorIntensity(colorStops);
  },

  /**
   * Calculates color stops and color representing each segment, returning them
   * from least to most intense color (black or white, depending on blackOnWhite parameter)
   *
   * @private
   */
  _getRangesEquallyDistributed: function() {
    var blackOnWhite = this._params.blackOnWhite;
    var colorsToThreshold = blackOnWhite ? this._paramThreshold() : 255 - this._paramThreshold();
    var steps = this._paramSteps();

    var stepSize = colorsToThreshold / steps;
    var colorStops = [];
    var i = steps - 1,
        factor,
        threshold;

    while (i >= 0) {
      factor = i / (steps - 1);
      threshold = Math.min(colorsToThreshold, (i + 1) * stepSize);
      threshold = blackOnWhite ? threshold : 255 - threshold;
      i--;

      colorStops.push(threshold);
    }

    return this._calcColorIntensity(colorStops);
  },

  /**
   * Returns valid steps value
   * @param {Boolean} [count=false]
   * @returns {number|number[]}
   * @private
   */
  _paramSteps: function(count) {
    var steps = this._params.steps;

    if (Array.isArray(steps)) {
      return count ? steps.length : steps;
    }

    if (steps === Posterizer.STEPS_AUTO && this._params.threshold === Potrace.THRESHOLD_AUTO) {
      return 4;
    }

    var blackOnWhite = this._params.blackOnWhite;
    var colorsCount = blackOnWhite ? this._paramThreshold() : 255 - this._paramThreshold();

    return steps === Posterizer.STEPS_AUTO
      ? (colorsCount > 200 ? 4 : 3)
      : Math.min(colorsCount, Math.max(2, steps));
  },

	/**
   * Returns valid threshold value
   * @returns {number}
   * @private
   */
  _paramThreshold: function() {
    if (this._calculatedThreshold !== null) {
      return this._calculatedThreshold;
    }

    this._calculatedThreshold = this._params.threshold === Potrace.THRESHOLD_AUTO
      ? this._getImageHistogram().autoThreshold()
      : this._params.threshold;

    return this._calculatedThreshold;
  },

  /**
   * Running potrace on the image multiple times with different thresholds and returns an array
   * of path tags
   *
   * @param {Boolean} [noFillColor]
   * @returns {string[]}
   * @private
   */
  _pathTags: function(noFillColor) {
    var ranges = this._getRanges();
    var potrace = this._potrace;
    var blackOnWhite = this._params.blackOnWhite;

    if (ranges.length >= 10) {
      ranges = this._addExtraColorStop(ranges);
    }

    potrace.setParameters({ blackOnWhite: blackOnWhite });

    return ranges.map(function(colorStop, index) {
      potrace.setParameters({ threshold: colorStop.value });

      var element = noFillColor ? potrace.getPathTag('') : potrace.getPathTag();

      var thisLayerOpacity = colorStop.colorIntensity;
      var prevLayerOpacity = !ranges[index - 1] ? 0 : ranges[index - 1].colorIntensity;

      // NOTE: With big number of layers (something like 70) there will be noticeable math error on rendering side.
      // In Chromium at least image will end up looking brighter overall compared to the same layers painted in solid colors.
      // However it works fine with sane number of layers, and it's not like we can do much about it.

      var calculatedOpacity = prevLayerOpacity
        ? ((prevLayerOpacity - thisLayerOpacity) / (prevLayerOpacity - 1))
        : thisLayerOpacity;

      element = utils.setHtmlAttr(element, 'fill-opacity', calculatedOpacity.toFixed(3));

      // var c = Math.round(Math.abs((blackOnWhite ? 255 : 0) - 255 * thisLayerOpacity));
      // element = utils.setHtmlAttr(element, 'fill', 'rgb('+c+', '+c+', '+c+')');
      // element = utils.setHtmlAttr(element, 'fill-opacity', '');

      return calculatedOpacity !== 0 ? element : '';
    });
  },

	/**
   * Loads image.
   *
   * @param {string|Buffer} target Image source. Could be anything that {@link Jimp} can read (buffer, local path or url). Supported formats are: PNG, JPEG or BMP
   * @param {Function} callback
   */
  loadImage: function(target, callback) {
    var self = this;

    this._potrace.loadImage(target, function(err) {
      self._calculatedThreshold = null;
      callback.call(self, err);
    });
  },

  /**
   * Sets parameters. Accepts same object as {Potrace}
   *
   * @param {Posterizer~Options} params
   */
  setParameters: function(params) {
    if (!params) {
      return;
    }

    this._potrace.setParameters(params);

    if (params.steps && !Array.isArray(params.steps) && (!utils.isNumber(params.steps) || !utils.between(params.steps, 1, 255))) {
      throw new Error('Bad \'steps\' value');
    }

    for (var key in this._params) {
      if (this._params.hasOwnProperty(key) && params.hasOwnProperty(key)) {
        this._params[key] = params[key];
      }
    }

    this._calculatedThreshold = null;
  },

  /**
   * Returns image as <symbol> tag. Always has viewBox specified
   *
   * @param {string} id
   */
  getSymbol: function(id) {
    var width = this._potrace._luminanceData.width;
    var height = this._potrace._luminanceData.height;
    var paths = this._pathTags(true);

    return '<symbol viewBox="0 0 ' + width + ' ' + height + '" id="' + id + '">' +
      paths.join('') +
      '</symbol>';
  },

  /**
   * Generates SVG image
   * @returns {String}
   */
  getSVG: function() {
    var width = this._potrace._luminanceData.width,
        height = this._potrace._luminanceData.height;

    var tags = this._pathTags(false);

    return '<svg xmlns="http://www.w3.org/2000/svg" ' +
      'width="' + width + '" ' +
      'height="' + height + '" ' +
      'viewBox="0 0 ' + width + ' ' + height + '" ' +
      'version="1.1">\n\t' +
      (this._params.background !== Potrace.COLOR_TRANSPARENT
        ? '<rect x="0" y="0" width="100%" height="100%" fill="' + this._params.background + '" />\n\t'
        : '') +
      tags.join('\n\t') +
      '\n</svg>';
  }
};

module.exports = Posterizer;

/**
 * Posterizer options
 *
 * @typedef {Potrace~Options} Posterizer~Options
 * @property {Number} [steps]   - Number of samples that needs to be taken (and number of layers in SVG). (default: Posterizer.STEPS_AUTO, which most likely will result in 3, sometimes 4)
 * @property {*} [fillStrategy] - How to select fill color for color ranges - equally spread or dominant. (default: Posterizer.FILL_DOMINANT)
 * @property {*} [rangeDistribution] - How to choose thresholds in-between - after equal intervals or automatically balanced. (default: Posterizer.RANGES_AUTO)
 */
