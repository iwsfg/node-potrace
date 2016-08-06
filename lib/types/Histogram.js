"use strict";

// Histogram

var utils = require('../utils');
var Jimp = null; try { Jimp = require('jimp'); } catch(e) {}
var Bitmap = require('./Bitmap');

/**
 * Calculates array index for pair of indexes. We multiple column (x) by 256 and then add row to it,
 * this way `(index(i, j) + 1) === index(i, j + i)` thus we can reuse `index(i, j)` we once calculated
 *
 * Note: this is different from how indexes calculated in {@link Bitmap} class, keep it in mind.
 *
 * @param x
 * @param y
 * @returns {*}
 * @private
 */
function index(x, y) {
  return 256 * x + y;
}

/**
 * 1D Histogram
 *
 * @param {Number|Bitmap|Jimp} imageSource - Image to collect pixel data from. Or integer to create empty histogram for image of specific size
 * @param [mode] Used only for Jimp images. {@link Bitmap} currently can only store 256 values per pixel, so it's assumed that it contains values we are looking for
 * @constructor
 */
function Histogram(imageSource, mode) {
  this.data = null;
  this.pixels = 0;
  this._sortedIndexes = null;
  this._cachedStats = {};
  this._lookupTableH = null;

  if (typeof imageSource === 'number') {
    this._createArray(imageSource);
  } else if (imageSource instanceof Bitmap) {
    this._collectValuesBitmap(imageSource);
  } else if (Jimp && imageSource instanceof Jimp) {
    this._collectValuesJimp(imageSource, mode);
  } else {
    throw new Error('Unsupported image source');
  }
}

Histogram.MODE_LUMINANCE = 'luminance';
Histogram.MODE_R = 'r';
Histogram.MODE_G = 'g';
Histogram.MODE_B = 'b';

Histogram.prototype = {
  _createArray: function(imageSize) {
    var ArrayType = imageSize <= Math.pow(2, 8) ? Uint8Array
      : imageSize <= Math.pow(2, 16) ? Uint16Array : Uint32Array;

    this.pixels = imageSize;
    
    return this.data = new ArrayType(256);
  },

	/**
   * Aggregates color data from {@link Jimp} instance
   * @param {Jimp} source
   * @param mode
   * @private
   */
  _collectValuesJimp: function(source, mode) {
    var pixelData = source.bitmap.data;
    var data = this._createArray(source.bitmap.width * source.bitmap.height);

    source.scan(0, 0, source.bitmap.width, source.bitmap.height, function(x, y, idx) {
      var val = mode === Histogram.MODE_R ? pixelData[idx]
        : mode === Histogram.MODE_G ? pixelData[idx + 1]
        : mode === Histogram.MODE_B ? pixelData[idx + 2]
        : utils.luminance(pixelData[idx], pixelData[idx + 1], pixelData[idx + 2]);

      data[val]++;
    });
  },

	/**
   * Aggregates color data from {@link Bitmap} instance
   * @param {Bitmap} source
   * @private
   */
  _collectValuesBitmap: function(source) {
    var data = this._createArray(source.size);
    var len = source.data.length;
    var color;

    for (var i = 0; i < len; i++) {
      color = source.data[i];
      data[color]++
    }
  },

  _getSortedIndexes: function(refresh) {
    if (!refresh && this._sortedIndexes) {
      return this._sortedIndexes;
    }

    var data = this.data;
    var indexes = new Uint8Array(256);
    var i = 0;

    for (i; i < 256; i++) {
      indexes[i] = i;
    }

    indexes.sort(function(a, b) {
      return data[a] > data[b] ? 1 : data[a] < data[b] ? -1 : 0;
    });

    this._sortedIndexes = indexes;
    return indexes;
  },

  _thresholdingBuildLookupTable: function() {
    var P = new Float64Array(256 * 256);
    var S = new Float64Array(256 * 256);
    var H = new Float64Array(256 * 256);
    var pixelsTotal = this.pixels;
    var i, j, idx, tmp;

    // diagonal
    for (i = 1; i < 256; ++i) {
      idx = index(i, i);
      tmp = this.data[i] / pixelsTotal;

      P[idx] = tmp;
      S[idx] = i * tmp;
    }

    // calculate first row (row 0 is all zero)
    for (i = 1; i < 255; ++i) {
      tmp = this.data[i + 1] / pixelsTotal;
      idx = index(1, i);

      P[idx+1] = P[idx] + tmp;
      S[idx+1] = S[idx] + (i + 1) * tmp;
    }

    // using row 1 to calculate others
    for (i = 2; i < 256; i++) {
      for (j=i+1; j < 256; j++) {
        P[index(i, j)] = P[index(1, j)] - P[index(1, i-1)];
        S[index(i, j)] = S[index(1, j)] - S[index(1, i-1)];
      }
    }

    // now calculate H[i][j]
    for (i = 1; i < 256; ++i) {
      for (j = i + 1; j < 256; j++) {
        idx = index(i, j);
        H[idx] = P[idx] !== 0 ? S[idx] * S[idx] / P[idx] : 0;
      }
    }
    
    return this._lookupTableH = H;
  },

	/**
   * Implements Algorithm For Multilevel Thresholding
   * Recieves desired number of color stops, returns array of said size. Could be limited to a range greyMin..greyMax
   *
   * @param amount how many thresholds should be calculated
   * @param [greyMin=0]
   * @param [greyMax=255]
   * @returns {*}
	 */
  multilevelThresholding: function (amount, greyMin, greyMax) {
    if (!this._lookupTableH)
      this._thresholdingBuildLookupTable();

    greyMin = greyMin || 0;
    greyMax = typeof greyMax === 'number' ? greyMax : 255;
    amount = Math.max(1, Math.min(greyMax - greyMin - 1, ~~amount));

    var H = this._lookupTableH;
    
    var colorStops = null;
    var maxSig = 0;

    if (amount > 4) {
      console.log('[Warning]: Threshold computation for more than 5 levels may take a long time');
    }

    function iterateRecursive (startingPoint, prevVariance, indexes, previousDepth) {
      startingPoint = (startingPoint || 0) + 1;
      prevVariance = prevVariance || 0;
      indexes = indexes || (new Array(amount));
      previousDepth = previousDepth || 0;

      var depth = previousDepth + 1; // t
      var variance;

      for (var i = startingPoint; i < greyMax - amount + previousDepth; i++) {
        variance = prevVariance + H[index(startingPoint, i)];
        indexes[depth - 1] = i;

	      if (depth + 1 < amount + 1) {
          // we need to go deeper
          iterateRecursive(i, variance, indexes, depth);
        } else {
          // enough, we can compare values now
          variance += H[index(i + 1, greyMax)];

          if (maxSig < variance) {
            maxSig = variance;
            colorStops = indexes.slice();
          }
        }
      }
    }

    iterateRecursive(greyMin || 0);

    return colorStops;
  },

  /**
   * Automatically finds threshold value using Algorithm For Multilevel Thresholding
   *
   * @param {number} [from]
   * @param {number} [to]
   * @returns {number}
   */
  autoThreshold: function(from, to) {
    var value = this.multilevelThresholding(1, from, to);
    return value[0];
  },

  getDominantColor: function(min, max, tolerance) {
    min = Math.round(min);
    max = Math.round(max);
    tolerance = tolerance || 1;

    if (min === max) { return min; }

    var colors = this.data,
      dominantIndex = -1,
      dominantValue = -1,
      i, j, tmp;

    if (min > max) {
      tmp = min;
      min = max;
      max = tmp;
    }

    for (i=min; i <= max; i++) {
      tmp = 0;

      for (j = ~~(tolerance / -2); j < tolerance; j++) {
        tmp += utils.between(i + j, 0, 255) ? colors[i + j] : 0;
      }

      if (dominantValue < tmp) {
        dominantIndex = i;
        dominantValue = tmp;
      }
    }

    return dominantIndex;
  },

  /**
   * Returns stats for histogram or its segment.
   *
   * Returned object contains median, mean and standard deviation for pixel values;
   * peak, mean and median number of pixels per level and few other values
   *
   * @param {Number} [from]
   * @param {Number} [to]
   * @param {Boolean} [refresh]
   * @returns {{levels: {mean: (number|*), median: *, stdDev: number, unique: number}, pixelsPerLevel: {mean: (number|*), median: (number|*), peak: number}, pixels: number}}
   */
  getStats: function(from, to, refresh) {
    from = Math.round(from || 0);
    to = to != null ? Math.round(to) : 255;

    if (!utils.between(from, 0, 255) || !utils.between(to, 0, 255) || from > to) {
      throw new Error('Bad parameters. Both from and to should be in range 0...255 and first attribute cannot be larger than second');
    }

    if (!refresh && this._cachedStats[from + '-' + to]) {
      return this._cachedStats[from + '-' + to];
    }

    var MAX_LEVELS = 256;
    var data = this.data;
    var sortedIndexes = this._getSortedIndexes();

    var pixelsTotal = 0;
    var medianValue = null;
    var meanValue;
    var medianPixelIndex;
    var pixelsPerLevelMean;
    var pixelsPerLevelMedian;
    var tmpSumOfDeviations = 0;
    var tmpPixelsIterated = 0;
    var allPixelValuesCombined = 0;
    var i, tmpPixels, tmpPixelValue;

    var uniqueValues = 0; // counter for levels that's represented by at least one pixel
    var mostPixelsPerLevel = 0;

    // Finding number of pixels and mean

    for (i = from; i <= to; i++) {
      pixelsTotal += data[i];
      allPixelValuesCombined += data[i] * i;

      uniqueValues += data[i] === 0 ? 0 : 1;

      if (mostPixelsPerLevel < data[i]) {
        mostPixelsPerLevel = data[i];
      }
    }

    meanValue = allPixelValuesCombined / pixelsTotal;
    pixelsPerLevelMean = pixelsTotal / (to - from);
    pixelsPerLevelMedian = pixelsTotal / uniqueValues;
    medianPixelIndex = Math.floor(pixelsTotal / 2);

    // Finding median and standard deviation

    for (i = 0; i < MAX_LEVELS; i++) {
      tmpPixelValue = sortedIndexes[i];
      tmpPixels = data[tmpPixelValue];

      if (tmpPixelValue < from || tmpPixelValue > to) {
        continue;
      }

      tmpPixelsIterated += tmpPixels;
      tmpSumOfDeviations += Math.pow(tmpPixelValue - meanValue, 2) * tmpPixels;

      if (medianValue === null && tmpPixelsIterated >= medianPixelIndex) {
        medianValue = tmpPixelValue;
      }

      if (mostPixelsPerLevel < data[i]) {
        mostPixelsPerLevel = data[i];
      }
    }

    return this._cachedStats[from + '-' + to] = {
      // various pixel counts for levels (0..255)

      levels: {
        mean: meanValue,
        median: medianValue,
        stdDev: Math.sqrt(tmpSumOfDeviations / pixelsTotal),
        unique: uniqueValues
      },

      // what's visually represented as bars
      pixelsPerLevel: {
        mean: pixelsPerLevelMean,
        median: pixelsPerLevelMedian,
        peak: mostPixelsPerLevel
      },

      pixels: pixelsTotal
    };
  }
};

module.exports = Histogram;