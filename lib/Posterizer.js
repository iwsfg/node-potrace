'use strict';

var Potrace = require('./Potrace');
var utils = require('./utils');
var crypto = require('crypto');
var attrRegexps = {};

function checksum(str, algorithm, encoding) {
  return crypto
    .createHash(algorithm || 'md5')
    .update(str, 'utf8')
    .digest(encoding || 'hex')
}

function getAttrRegexp(attrName) {
  if (attrRegexps[attrName]) {
    return attrRegexps[attrName];
  }

  attrRegexps[attrName] = new RegExp(' ' + attrName + '="((?:\\\\(?=")"|[^"])+)"', 'i')
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
 * @param {Posterizer~Options} [options]
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

  _putTogetherSVGDocument: function(pathTags, scale) {
    var fillBlack = !this._whiteOnBlack;
    var prefix = 'pm_' + checksum(this._potrace._luminanceData.data).slice(10) + this._blackLevel + (fillBlack ? 'b' : 'w');

    function layerId(index0) { return prefix + '_layer' + (index0 + 1) }
    function calcOpacity(greyLevel) { return (fillBlack ? 255 - greyLevel : greyLevel) / 255; }

    var tags = pathTags.map(function(tag, index) {
      var fillOpacity = calcOpacity(tag.brightness);
      var prevItem = pathTags[index - 1];
      var prevLayerOpacity = !prevItem ? 1 : calcOpacity(prevItem.brightness);
      var element = tag.tag,
          realOpacity;

      realOpacity = prevLayerOpacity === 1 || index === pathTags.length - 1
        ? fillOpacity
        : ((prevLayerOpacity - fillOpacity) / (prevLayerOpacity - 1));

      element = setAttr(element, 'id', layerId(index));
      element = setAttr(element, 'fill', '');
      element = setAttr(element, 'fill-opacity', realOpacity.toFixed(3));

      return element;
    });

    var width = (this._potrace._luminanceData.width * scale),
        height = (this._potrace._luminanceData.height * scale),
        viewBox = 'viewBox="0 0 ' + width + ' ' + height + '" ';

    return '<svg xmlns="http://www.w3.org/2000/svg" ' +
      'xmlns:xlink="http://www.w3.org/1999/xlink" ' +
      'width="' + width + '" ' +
      'height="' + height + '" ' +
      viewBox +
      'version="1.1">\n' +
      '\t<defs>\n' +
      '\t\t<symbol ' + viewBox + 'id="' + prefix + '">\n' +
      '\t\t\t' + tags.join('\n\t\t\t') + '\n' +
      '\t\t</symbol>\n' +
      '\t</defs>\n' +
      '\n'+
      // '\t<rect x="0" y="0" width="100%" height="100%" fill="#111111"/>\n' +
      '\t<use xlink:href="#' + prefix + '" fill="'+ (this._whiteOnBlack ? 'white' : 'black') +'" />\n' +
      '</svg>';
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
   *
   * @param {Number} [scale]
   * @returns {string}
   */
  getSVG: function(scale) {
    scale = scale || 1;

    var whiteOnBlack = this._whiteOnBlack;
    var max = whiteOnBlack ? 255 - this._blackLevel : this._blackLevel;
    var steps = this._getSamplesCount();
    var stepSize = max / steps;
    var maxDisplayedColor = max > 227 ? max : (max - stepSize * 0.72),
        tags = [],
        factor,
        color,
        threshold,
        i = steps - 1;

    while (i >= 0) {
      factor = i / (steps - 1);
      color = maxDisplayedColor * factor;
      threshold = Math.min(max, (i + 1) * stepSize);
      i--;

      if (whiteOnBlack) {
        color = 255 - color;
        threshold = 255 - threshold;
      }

      this._potrace.setParameter({
        blackLevel: threshold,
        whiteOnBlack: whiteOnBlack
      });

      tags.push({
        brightness: color,
        hexColor: '#' + utils.luminanceToGrey(color),
        tag: this._potrace.getPathTag(scale, false, '#' + utils.luminanceToGrey(color))
      });
    }
    
    return this._putTogetherSVGDocument(tags, scale);
  }
};

module.exports = Posterizer;

/**
 * Posterizer options
 *
 * @typedef {Potrace~Options} Posterizer~Options
 * @property {Number} [samples] - Number of samples that needs to be taken (and number of layers in SVG). (default: auto, which most likely will result in 3, sometimes 4)
 */
