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
  this._threshold = 142;
  this._whiteOnBlack = false;
  this._samples = Posterizer.SAMPLES_AUTO;

  if (options) {
    this.setParameters(options);
  }
}

Posterizer.SAMPLES_AUTO = -1;

Posterizer.prototype = {
  /**
   * Calculates color stops and color representing each segment, returning them
   * from least to most intense color (black or white, depending on whiteOnBlack parameter)
   *
   * @private
   */
  _getRanges: function() {
    var whiteOnBlack = this._whiteOnBlack;
    var max = whiteOnBlack ? 255 - this._threshold : this._threshold;
    var steps = Math.min(this._samples, max);

    if (steps === Posterizer.SAMPLES_AUTO) {
      steps = Math.max(3, Math.floor(max / Math.max(255 - max, 67)));
    }

    var stepSize = max / steps;
    var colorStops = [];
    var maxDisplayedColor = max > 227 ? max : (max - stepSize * 0.72),
      factor, color, threshold,
      i = steps - 1;

    while (i >= 0) {
      factor = i / (steps - 1);
      color = maxDisplayedColor * factor;
      threshold = Math.min(max, (i + 1) * stepSize);
      i--;

      colorStops.push({
        value: whiteOnBlack ? 255 - threshold : threshold,
        colorIntensity: whiteOnBlack ? (255 - color) / 255 : 1 - color / 255
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
    var fillBlack = !this._whiteOnBlack;

    potrace.setParameters({ whiteOnBlack: !fillBlack });

    return ranges.map(function(colorStop, index) {
      potrace.setParameters({ threshold: colorStop.value });
      var element = potrace.getPathTag(noFillColor ? '' : null);

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
    if (params && params.threshold != null) {
      if (!utils.isNumber(params.threshold)) {
        throw new Error('Bad \'threshold\' value');
      } else {
        this._threshold = params.threshold;
        delete params.threshold;
      }
    }

    if (params && params.samples) {
      if (params.samples === Posterizer.SAMPLES_AUTO) {
        this._samples = Posterizer.SAMPLES_AUTO;
        delete params.samples;
      } else if (!utils.isNumber(params.samples) || params.samples < 1) {
        throw new Error('Bad \'samples\' value');
      } else {
        this._samples = params.samples;
        delete params.samples;
      }
    }

    if (params && params.whiteOnBlack != null) {
      this._whiteOnBlack = !!params.whiteOnBlack;
    }

    this._potrace.setParameters(params);
    this._potrace.setParameters({ whiteOnBlack: this._whiteOnBlack });
  },

  /**
   * Returns image as <symbol> tag. Always has viewBox specified
   *
   * @param {string} id
   */
  getSymbol: function(id) {
    var width = this._potrace._luminanceData.width;
    var height = this._potrace._luminanceData.height;
    var paths = this._pathTags();

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

    var tags = this._pathTags();

    return '<svg xmlns="http://www.w3.org/2000/svg" ' +
      'width="' + width + '" ' +
      'height="' + height + '" ' +
      'viewBox="0 0 ' + width + ' ' + height + '" ' +
      'version="1.1">\n\t' +
      tags.join('\n\t') +
      '\n</svg>';
  }
};

module.exports = Posterizer;

/**
 * Posterizer options
 *
 * @typedef {Potrace~Options} Posterizer~Options
 * @property {Number} [samples] - Number of samples that needs to be taken (and number of layers in SVG). (default: auto, which most likely will result in 3, sometimes 4)
 */
