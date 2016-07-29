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
  
  this._params = {
    threshold: 142,
    blackOnWhite: true,
    steps: Posterizer.STEPS_AUTO,
    background: Potrace.COLOR_TRANSPARENT,
    fillStrategy: Posterizer.COLOR_FILL_DOMINANT
  };

  if (options) {
    this.setParameters(options);
  }
}

Posterizer.STEPS_AUTO = -1;
Posterizer.COLOR_FILL_SPREAD = 'spread';
Posterizer.COLOR_FILL_DOMINANT = 'dominant';
Posterizer.COLOR_FILL_MEDIAN = 'median';
Posterizer.COLOR_FILL_MEAN = 'mean';

Posterizer.prototype = {
  /**
   * Calculates color stops and color representing each segment, returning them
   * from least to most intense color (black or white, depending on blackOnWhite parameter)
   *
   * @private
   */
  _getRanges: function() {
    var blackOnWhite = this._params.blackOnWhite;
    var colorSelectionStrat = this._params.fillStrategy;
    var max = blackOnWhite ? this._params.threshold : 255 - this._params.threshold;
    var steps = Math.min(this._params.steps, max);

    if (steps === Posterizer.STEPS_AUTO) {
      steps = Math.max(3, Math.floor(max / Math.max(255 - max, 67)));
    }

    var stepSize = max / steps;
    var colorStops = [];
    var maxDisplayedColor = max > 227 ? max : (max - stepSize * 0.72),
        i = steps - 1,
        factor,
        colorIntensity,
        color,
        threshold,
        rangeStart,
        rangeEnd,
        histogram,
        padding,
        rangeStats;

    while (i >= 0) {
      factor = i / (steps - 1);
      colorIntensity = 1 - (maxDisplayedColor * factor / 255);
      threshold = Math.min(max, (i + 1) * stepSize);
      threshold = blackOnWhite ? threshold : 255 - threshold;
      i--;

      if (colorSelectionStrat !== Posterizer.COLOR_FILL_SPREAD) {
        rangeStart = Math.round(blackOnWhite ? threshold - stepSize : threshold);
        rangeEnd = Math.round(blackOnWhite ? threshold : threshold + stepSize);

        padding = Math.floor(stepSize * 0.1);
        histogram = this._potrace._luminanceData.histogram();

        switch (colorSelectionStrat) {
          case Posterizer.COLOR_FILL_DOMINANT:
            color = blackOnWhite
              ? histogram.getDominantColor(rangeStart, rangeEnd - padding, Math.min(5, stepSize))
              : histogram.getDominantColor(rangeStart + padding, rangeEnd, Math.min(5, stepSize));
            break;
          case Posterizer.COLOR_FILL_MEAN:
            rangeStats = histogram.getStats(rangeStart, rangeEnd);
            color = rangeStats.levels.mean;
            break;
          case Posterizer.COLOR_FILL_MEDIAN:
            rangeStats = histogram.getStats(rangeStart, rangeEnd);
            color = rangeStats.levels.median;
            break;
          default:
            rangeStats = histogram.getStats(rangeStart, rangeEnd);
        }

        colorIntensity = (blackOnWhite ? 255 - color : color) / 255;
      }

      colorStops.push({
        value: threshold,
        colorIntensity: colorIntensity
      });
    }

    return colorStops;
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

    potrace.setParameters({ blackOnWhite: this._params.blackOnWhite });

    return ranges.map(function(colorStop, index) {
      potrace.setParameters({ threshold: colorStop.value });

      var element = noFillColor ? potrace.getPathTag('') : potrace.getPathTag();

      var thisLayerOpacity = colorStop.colorIntensity;
      var prevLayerOpacity = !ranges[index - 1] ? 0 : ranges[index - 1].colorIntensity;

      var calculatedOpacity = prevLayerOpacity && index < ranges.length - 1
        ? ((prevLayerOpacity - thisLayerOpacity) / (prevLayerOpacity - 1))
        : thisLayerOpacity;

      element = utils.setHtmlAttr(element, 'fill-opacity', calculatedOpacity.toFixed(3));

      return calculatedOpacity !== 0 ? element : '';
    });
  },

  loadImage: function(target, callback) {
    return this._potrace.loadImage(target, callback);
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

    if (params.steps && (!utils.isNumber(params.steps) || !utils.between(params.steps, 1, 255))) {
      throw new Error('Bad \'steps\' value');
    }

    for (var key in this._params) {
      if (this._params.hasOwnProperty(key) && params.hasOwnProperty(key)) {
        this._params[key] = params[key];
      }
    }
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
 * @property {Number} [steps]   - Number of samples that needs to be taken (and number of layers in SVG). (default: auto, which most likely will result in 3, sometimes 4)
 * @property {*} [fillStrategy] - How to select fill color for color ranges - equally spread or dominant. (default: Posterizer.COLOR_FILL_DOMINANT)
 */
