'use strict';

var Potrace = require('./Potrace');
var utils = require('./utils');
var attrRegexps = {};

function getAttrRegexp(attrName) {
  if (attrRegexps[attrName]) {
    return attrRegexps[attrName];
  }

  attrRegexps[attrName] = new RegExp(' ' + attrName + '="((?:\\\\(?=")"|[^"])+)"', 'i');
  return attrRegexps[attrName];
}

function setAttr(html, attrName, value) {
  var attr = ' ' + attrName + '="' + value + '"';

  if (html.indexOf(' ' + attrName + '="') === -1) {
    html = html.replace(/<[a-z]+/i, function(beginning) { return beginning + attr; });
  } else {
    html = html.replace(getAttrRegexp(attrName), attr);
  }

  return html;
}

/**
 * Takes multiple samples using {@link Potrace} with different blackLevel
 * settings and combines output into a single file.
 *
 * @param {Options} [options]
 * @constructor
 */
function Posterizer(options) {
  this._potrace = new Potrace();
  this._blackLevel = 142;
  this._whiteOnBlack = false;
  this._samples = Posterizer.SAMPLES_AUTO;

  if (options) {
    this.setParameter(options);
  }
}

Posterizer.SAMPLES_AUTO = -1;

Posterizer.prototype = {
  _getSamplesCount: function() {
    var colorSpace = this._whiteOnBlack ? 255 - this._blackLevel : this._blackLevel;
    var realSamplesCount = this._samples,
        autoColorsPerSample = Math.max(255 - colorSpace, 67);

    if (this._samples === Posterizer.SAMPLES_AUTO) {
      realSamplesCount = Math.max(3, Math.round(colorSpace / autoColorsPerSample));
    } else if (this._samples > colorSpace) {
      realSamplesCount = colorSpace;
    }

    return realSamplesCount;
  },

  /**
   *
   * @param {Boolean} [noFillColor]
   * @returns {string[]}
   * @private
   */
  _pathTags: function(noFillColor) {
    var ranges = this._getRanges();
    var potrace = this._potrace;
    var fillBlack = !this._whiteOnBlack;

    potrace.setParameter({ whiteOnBlack: !fillBlack });

    return ranges.map(function(colorStop, index) {
      potrace.setParameter({ blackLevel: colorStop.value });
      var element = potrace.getPathTag(1, noFillColor ? '' : null);

      var thisLayerOpacity = colorStop.colorIntensity;
      var prevLayerOpacity = !ranges[index - 1] ? 0 : ranges[index - 1].colorIntensity;

      var calculatedOpacity = prevLayerOpacity && index < ranges.length - 1
        ? ((prevLayerOpacity - thisLayerOpacity) / (prevLayerOpacity - 1))
        : thisLayerOpacity;

      //element = setAttr(element, 'fill', '');
      element = setAttr(element, 'fill-opacity', calculatedOpacity.toFixed(3));

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
  setParameter: function(params) {
    if (params && params.blackLevel != null) {
      if (!utils.isNumber(params.blackLevel)) {
        throw new Error('Bad \'blackLevel\' value');
      } else {
        this._blackLevel = params.blackLevel;
        delete params.blackLevel;
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

    this._potrace.setParameter(params);
    this._potrace.setParameter({ whiteOnBlack: this._whiteOnBlack });
  },

  /**
   * Returns <symbol> tag. Always has viewBox specified
   *
   * @param id
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
   * Calculates color stops and color representing each segment, returning them
   * from least to most intense color (black or white, depending on whiteOnBlack parameter)
   *
   * @private
   */
  _getRanges: function() {
    var whiteOnBlack = this._whiteOnBlack;
    var max = whiteOnBlack ? 255 - this._blackLevel : this._blackLevel;
    var steps = this._getSamplesCount();
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

  getSVG: function(scale) {
    scale = scale || 1;
    //var paths = this._generatePathTags(scale);
    var width = (this._potrace._luminanceData.width * scale),
        height = (this._potrace._luminanceData.height * scale);

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
