import "./app.scss";
import "babel-polyfill";
import Flickr from "flickr-sdk";
import { range, splitEvery, zipWith, add, compose, reduce, map, into, zip, xprod } from "ramda";
const M = require("most");
const R = require("ramda");
const gcd = require("gcd")
import { avgColor, avgSquares } from './avgs.js'

import Worker from "worker-loader!./worker.js"
import Sorter from "worker-loader!./sorter.js"

document.addEventListener('DOMContentLoaded', async () => {

  const w = new Worker();
  const s = new Sorter();

  const beacon = document.getElementById('bacon');
  const inspector = document.getElementById('inspector');
  const imag = document.getElementById('img');

  const imageContainer = document.getElementById("img__container");

  const key = '51a9f6e2f76d707dfbed602811e9d911';

  const SF = 60;
  const perPage = 300;
  const nImg = 600;

  // so we need
  const pages = (nImg/perPage|0) + ((nImg%perPage) > 0 ? 1 : 0);

  const api = page => `https://api.flickr.com/services/rest?method=flickr.photos.getRecent&format=json&nojsoncallback=1&api_key=51a9f6e2f76d707dfbed602811e9d911&per_page=${perPage}&page=${page+1}`;

  const pImageUrl = (s, {farm, server, id, secret}) => `https://farm${farm}.staticflickr.com/${server}/${id}_${secret}_${s}.jpg`;
  const imageUrl = R.curry(pImageUrl)("s")
  const fullImageUrl = R.curry(pImageUrl)("b")

  const avgCanvas = document.createElement("canvas");
  const actx = avgCanvas.getContext("2d");

  const mctx = beacon.getContext("2d");

  let theState = [];

  M.from(R.times(api, pages))
    .map(fetch)
    .awaitPromises()
    .map(r => r.json())
    .awaitPromises()
    .map(R.path(["photos", "photo"]))
    .flatMap(M.from)
    .map(i => R.assoc("thumb", imageUrl(i), i))
    .map(i => R.assoc("full", fullImageUrl(i), i))

    .map(i => new Promise(res => {
      fetch(i.thumb)
        .then(r => r.blob())
        .then(r => res(R.assoc("thumbBlob", r, i)))
    }))
    .awaitPromises()

    .map(r => new Promise(res => {
      const img = new Image()
      imageContainer.appendChild(img);
      img.src = URL.createObjectURL(r.thumbBlob)
      img.onload = () => res(R.assoc('src', img.src, R.assoc('img', img, r)))
    }))
    .awaitPromises()
    .map(r => {
      actx.drawImage(r.img, 0, 0);
      const idata = actx.getImageData(0,0,r.img.width,r.img.height);
      return R.merge(r, {actx, data: idata.data})
    })
    .map(i => R.assoc('avgColor', avgColor(i), i))
    .observe(i => {
      theState = R.append(i, theState)
      s.postMessage({db: R.project(['avgColor','src'], theState)})
    })

  M.fromEvent('click', imageContainer)
    .filter(R.compose(R.test(/IMG/), R.path(['target', 'tagName'])))
    .map(R.path(['target', 'src']))
    .map(e => R.find(R.pathEq(['img', 'src'], e), theState))
    .map(i => new Promise(res => {
      fetch(i.full)
        .then(r => r.blob())
        .then(r => res(R.assoc("fullBlob", r, i)))
    }))
    .awaitPromises()
    .map(r => new Promise(res => {
      const img = new Image()
      img.src = URL.createObjectURL(r.fullBlob)
      img.onload = () => res(R.assoc('fullImg', img, r))
    }))
    .awaitPromises()
    .map(r => {
      beacon.width = r.fullImg.width
      beacon.height = r.fullImg.height
      mctx.clearRect(0, 0, beacon.width, beacon.height);
      mctx.drawImage(r.fullImg, 0, 0, r.fullImg.width, r.fullImg.height)
      return mctx.getImageData(0,0,r.fullImg.width,r.fullImg.height);
    })
    .observe(e => w.postMessage({data:e},[e.data.buffer]))


  w.onmessage = ({data}) => {
    M.from(data)
      .observe(e => {
        mctx.fillStyle = `rgb(${e.avg[0]}, ${e.avg[1]}, ${e.avg[2]})`;
        mctx.fillRect(e.x, e.y, e.w, e.h);

        s.postMessage({q:e.avg, coords: {x:e.x, y:e.y, w:e.w, h:e.h}})
      })
  }

  s.onmessage = ({data}) => {
    const img = document.querySelector(`img[src="${data.src}"]`)
    mctx.drawImage(img, data.coords.x, data.coords.y, data.coords.w, data.coords.h)
  }

});
