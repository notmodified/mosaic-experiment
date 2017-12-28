import { range, splitEvery, zipWith, add, compose, reduce, map, into, zip, xprod } from "ramda";
const M = require("most");
const R = require("ramda");

export const avgColor = (data) => {
  const d = data.data || data
  return compose(
    map(x => x/(d.length/4)|0),
    reduce(zipWith(add), [0, 0, 0, 0]),
    splitEvery(4),
  )(d);
}

export const avgSquares = (width, height, data) => {
  // make this webwork

  const aw = width - width%2
  const ah = height - height%2
  const SF = 50
  const w = aw/SF |0
  const h = aw/SF |0

  const x = R.times(R.multiply(w), Math.ceil(aw/w));
  const y = R.times(R.multiply(h), Math.ceil(ah/h));
  const coords = R.xprod(x, y);

  const p = ([x, y]) => {
    const i = Math.ceil(y*width+x)*4;
    return data.slice(i, i+4)
  }
  const area = (x, y, w, h) => {
    const t = R.flatten(R.map(p, R.xprod(R.range(x, x+w), R.range(y, y+h))))
    return t
  }

  return compose(
    map(r => R.assoc('avg', avgColor(r.data), r)),
    map(r => R.assoc('data', area(r.x, r.y, r.w, r.h), r)),
    map(R.zipObj(['w', 'h', 'x', 'y'])),
    map(R.concat([w, h]))
  )(coords);
};
