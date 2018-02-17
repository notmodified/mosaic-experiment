import "./app.scss";
import "babel-polyfill";
const M = require("most");
const R = require("ramda");
const gcd = require("gcd");

import { avgColor, avgSquares } from "./avgs.js";

import Averager from "worker-loader!./averager.js";
import Sorter from "worker-loader!./sorter.js";
import Color from "worker-loader!./color.js";

import {
  renderApp,
  renderLoading,
  renderBox,
  renderLoadingNoResults
} from "./ui.js";
import {
  appendToState,
  setUsed,
  setCurrent,
  getState,
  bySrc,
  setLoading,
  decLoading,
  getLoading
} from "./state.js";
import { api, imageUrl, fullImageUrl, perPage } from "./flickr.js";

document.addEventListener("DOMContentLoaded", () => {
  renderApp();

  const averager = new Averager();
  const sorter = new Sorter();
  const colorer = new Color();

  const viewer = document.getElementById("viewer");
  const vctx = viewer.getContext("2d");

  const imgBox = document.getElementById("image-box");
  const controls = document.getElementById("loading");

  const avgCanvas = document.createElement("canvas");
  const actx = avgCanvas.getContext("2d");

  const q = document.querySelector("#query");
  const qValue = () => q.value;

  const more = M.startWith(
    1,
    M.merge(
      M.fromEvent("click", document.querySelector("button.more")),
      M.fromEvent("keydown", q).filter(({ key }) => key === "Enter")
    )
  )
    .debounce(50)
    .map(qValue)
    .tap(() => setLoading(perPage))
    .map(api)
    .map(fetch)
    .awaitPromises()
    .map(r => r.json())
    .awaitPromises()
    .map(R.path(["photos", "photo"]))
    .tap(e => {
      setLoading(e.length);

      if (e.length === 0) {
        renderLoadingNoResults(controls);
      }
    })
    .flatMap(M.from)
    .map(i => R.assoc("thumb", imageUrl(i), i))
    .map(i => R.assoc("full", fullImageUrl(i), i))

    .map(
      i =>
        new Promise(res => {
          const notFound = require("./photo_unavailable.png");
          fetch(i.thumb)
            .then(r => r.blob())
            .then(r => res(R.assoc("thumbBlob", r, i)))
            .catch(e => {
              fetch(notFound)
                .then(r => r.blob())
                .then(r =>
                  res(R.assoc("full", notFound, R.assoc("thumbBlob", r, i)))
                );
            });
        })
    )
    .awaitPromises()

    .map(
      r =>
        new Promise(res => {
          const img = new Image();
          img.src = URL.createObjectURL(r.thumbBlob);
          img.onload = () =>
            res(R.assoc("src", img.src, R.assoc("img", img, r)));
        })
    )
    .awaitPromises()
    .observe(i => {
      actx.drawImage(i.img, 0, 0);
      const idata = actx.getImageData(0, 0, i.img.width, i.img.height);
      colorer.postMessage({ data: idata, full: i.full, src: i.src }, [
        idata.data.buffer
      ]);
    });

  const freshImages = M.fromEvent("message", colorer)
    .map(R.compose(R.curry(appendToState)(perPage), R.prop("data")))
    .tap(() =>
      sorter.postMessage({ db: R.project(["avgColor", "src"], getState()) })
    )
    .tap(decLoading);

  const imageChoose = M.fromEvent("click", document.getElementById("image-box"))
    .filter(R.compose(R.test(/IMG/), R.path(["target", "tagName"])))
    .map(R.path(["target", "src"]))
    .tap(src => {
      setCurrent(src);
    })
    .map(bySrc)
    .map(
      i =>
        new Promise((res, rej) => {
          const notFound = require("./photo_unavailable.png");
          fetch(i.full)
            .then(r => r.blob())
            .then(r => res(R.assoc("fullBlob", r, i)))
            .catch(e => {
              fetch(notFound)
                .then(r => r.blob())
                .then(r => res(R.assoc("fullBlob", notFound, i)));
            });
        })
    )
    .awaitPromises()
    .map(
      r =>
        new Promise(res => {
          const img = new Image();
          img.src = URL.createObjectURL(r.fullBlob);
          img.onload = () => res(R.assoc("fullImg", img, r));
        })
    )
    .awaitPromises()
    .map(r => {
      viewer.width = r.fullImg.width;
      viewer.height = r.fullImg.height;
      vctx.clearRect(0, 0, viewer.width, viewer.height);
      vctx.drawImage(r.fullImg, 0, 0, r.fullImg.width, r.fullImg.height);
      return vctx.getImageData(0, 0, r.fullImg.width, r.fullImg.height);
    })
    .tap(e => averager.postMessage({ data: e }, [e.data.buffer]));

  M.fromEvent("message", averager)
    .flatMap(R.compose(M.from, R.prop("data")))
    .observe(data => {
      vctx.fillStyle = `rgb(${data.avg[0]}, ${data.avg[1]}, ${data.avg[2]})`;
      vctx.fillRect(data.x, data.y, data.w, data.h);

      sorter.postMessage({
        q: data.avg,
        coords: { x: data.x, y: data.y, w: data.w, h: data.h }
      });
    });

  const placeImage = M.fromEvent("message", sorter).tap(({ data }) => {
    const img = document.querySelector(`img[src="${data.src}"]`);

    setUsed(data.src);

    if (img) {
      const args = R.prepend(img, R.props(["x", "y", "w", "h"], data.coords));
      vctx.drawImage(...args);
    }
  });

  const loading = freshImages
    .debounce(5)
    .tap(() => renderLoading(controls, getLoading()));

  M.merge(placeImage.debounce(10), loading, imageChoose).observe(() =>
    renderBox(imgBox, getState())
  );
});
