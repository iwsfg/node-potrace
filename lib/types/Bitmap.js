'use strict';

var Point = require('./Point');

function Bitmap(w, h) {
  this.w = w;
  this.h = h;
  this.size = w * h;
  this.arraybuffer = new ArrayBuffer(this.size);
  this.data = new Int8Array(this.arraybuffer);
}

Bitmap.prototype = {
  at: function(x, y) {    
    return (x >= 0 && x < this.w && y >= 0 && y < this.h) &&
      this.data[this.w * y + x] === 1;
  },

  /**
   * 
   * @param i
   * @returns {Point}
   */
  index: function(i) {
    var point = new Point();

    point.y = Math.floor(i / this.w);
    point.x = i - point.y * this.w;

    return point;
  },

  flip: function(x, y) {
    this.data[this.w * y + x] = this.at(x, y) ? 0 : 1;
  },

  copy: function() {
    var bm = new Bitmap(this.w, this.h),
        i;

    for (i = 0; i < this.size; i++) {
      bm.data[i] = this.data[i];
    }

    return bm;
  }
};

module.exports = Bitmap;
