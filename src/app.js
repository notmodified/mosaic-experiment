import "./app.scss";
import "babel-polyfill";
import Flickr from "flickr-sdk";
import { range, splitEvery, zipWith, add, compose, reduce, map, into, zip, xprod } from "ramda";
const M = require("most");
const R = require("ramda");

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


document.addEventListener('DOMContentLoaded', async () => {
  const beacon = document.getElementById('bacon');
  const inspector = document.getElementById('inspector');
  const imag = document.getElementById('img');

  const imageContainer = document.getElementById("img__container");

  // fetch listing group
  // foreach
  //    load image
  //      place somewhere? in the bank?
  //      find average
  //
  //      gen pixelated version
  //      place somewhere? in the pixel bank?
  //      find pixel numbers
  //
  //      for each pixel find the closest from the bank
  //      store that relationship somehow
  const key = '51a9f6e2f76d707dfbed602811e9d911';

  const SF = 75;
  const perPage = 500;
  const xSize = 50;
  const ySize = 50;
  const nImg = SF * 2;

  // so we need
  const pages = (nImg/perPage|0) + ((nImg%perPage) > 0 ? 1 : 0);

  console.log(`#images ${nImg}, #pages ${pages}, #size ${xSize}, ${ySize}, #pixel ${xSize/SF}, ${ySize/SF}` );

  const api = page => `https://api.flickr.com/services/rest?method=flickr.photos.getRecent&format=json&nojsoncallback=1&api_key=51a9f6e2f76d707dfbed602811e9d911&per_page=${perPage}&page=${page+1}`;

  const pImageUrl = (s, {farm, server, id, secret}) => `https://farm${farm}.staticflickr.com/${server}/${id}_${secret}_${s}.jpg`;
  const imageUrl = R.curry(pImageUrl)("s")
  const fullImageUrl = R.curry(pImageUrl)("c")

  const avgCanvas = document.createElement("canvas");
  const actx = avgCanvas.getContext("2d");

  const avgColor = ({data}) =>
    compose(
      map(x => x/(data.length/4)|0),
      reduce(zipWith(add), [0, 0, 0, 0]),
      splitEvery(4)
    )(data);

  const avgSquares = ({data, mctx}) => {
    const w = beacon.width/SF
    const h = beacon.height/SF

    const x = R.times(R.multiply(w), SF);
    const y = R.times(R.multiply(h), SF);
    const coords = R.xprod(x, y);
    console.log(w,h,beacon.width/SF,SF)

    return compose(
      map(r => R.assoc('avg', avgColor(r.data), r)),
      map(r => R.assoc('data', mctx.getImageData(r.x, r.y, r.w, r.h), r)),
      map(R.zipObj(['w', 'h', 'x', 'y'])),
      map(R.concat([w, h]))
    )(coords);
  };

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
      img.onload = () => res(R.assoc('img', img, r))
    }))
    .awaitPromises()
    .map(r => {
      actx.drawImage(r.img, 0, 0);
      const idata = actx.getImageData(0,0,r.img.width,r.img.height);
      return R.merge(r, {actx, data: idata.data})
    })
    .map(i => R.assoc('avgColor', avgColor(i), i))
    .observe(i => {theState = R.append(i, theState); console.log(theState)})

  const mctx = beacon.getContext("2d");
  mctx.imageSmoothingEnabled =
    mctx.mozImageSmoothingEnabled =
    mctx.msImageSmoothingEnabled =
    mctx.webkitImageSmoothingEnabled = false;

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
      const ictx = inspector.getContext("2d");
      ictx.drawImage(r.fullImg, 0, 0, r.fullImg.width, r.fullImg.height)
      const idata = mctx.getImageData(0,0,beacon.width,beacon.height);
      return R.merge(r, {mctx, data: idata.data})
    })
    .map(i => R.assoc('avgSquares', avgSquares(i), i))
    .flatMap(R.compose(M.from, R.prop('avgSquares')))
    .tap(e => {
      mctx.fillStyle = `rgb(${e.avg[0]}, ${e.avg[1]}, ${e.avg[2]})`;
      mctx.fillRect(e.x, e.y, e.w, e.h);
    })
    .tap(e => {
      const distance = (c1, c2) => Math.abs(
        Math.pow((c2[0] - c1[0]),2) + Math.pow((c2[1] - c1[1]),2) + Math.pow((c2[2] - c1[2]), 2)
      )

      const draw = i => {
        mctx.drawImage(i.img, e.x, e.y, e.w, e.h);
      }
      const d = R.compose(R.curry(distance)(e.avg), R.prop("avgColor"))
      const rd = R.compose(R.gt(500), d)
      const matches = R.compose(R.sortBy(d), R.filter(rd))(theState)

      if (R.head(matches)) {
        draw(R.head(matches))
      }
    })
    .observe(() => {})//console.log.bind(console))

  return;

  const p = R.composeP(
    r => r.json(),
    fetch
  );

  const f = R.composeP(
    r => r.blob(),
    fetch,
    r => Promise.resolve(imageUrl(r)),
  );


  const addToBank = b => {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => res(img);
      img.src = URL.createObjectURL(b);
      img.addEventListener("click", e => {
        fill(beacon, showImg(beacon, img));
      });
      document.body.appendChild(img);
    });
  }

  const bank = document.createElement("canvas");
  const bctx = bank.getContext("2d");

  const avgColour = img => {
    return img.then(r => {

      bctx.drawImage(r, 0, 0);
      const idata = bctx.getImageData(0,0,r.width,r.height);

      // worked out the average of an image
      const t = data =>
        compose(
          map(x => x/(data.length/4)|0),
          reduce(zipWith(add), [0, 0, 0, 0]),
          splitEvery(4)
        )(data);

      return [r, t(idata.data)];
    });
  }

  const a = R.composeP(
    map(avgColour),
    map(addToBank),
    Promise.all.bind(Promise),
    map(f),
    p
  );

  const fill = (canvas, colors) => {

    const pos = R.xprod(colors, images);

    const score = a => {
      const c1 = R.last(a[0]);
      const c2 = R.last(a[1]);
      const distance = Math.abs((c2[0] - c1[0])^2 + (c2[1] - c1[1])^2 + (c2[2] - c1[2])^2);
      return a.concat([distance]);
    };

    const sorted = R.sortBy(
      R.prop(2),
      map(score, pos)
    );

    const uniq = R.uniqWith(
      (a, b) => a[0][0] == b[0][0] && a[0][1] == b[0][1],
      sorted
    );

    const x = (xSize/SF|0);
    const y = ySize/SF|0;

    uniq.forEach(e => {
      console.log('draw', e[0], e[1][0], beacon.width/x, beacon.height/y);
      ctx.drawImage(e[1][0], e[0][0] + 1, e[0][1] + 1, (beacon.width/x) *2, (beacon.height/y) *2);
    });

    console.log(uniq);
  };


  const ctx = beacon.getContext("2d");
  ctx.imageSmoothingEnabled =
    ctx.mozImageSmoothingEnabled =
    ctx.msImageSmoothingEnabled =
    ctx.webkitImageSmoothingEnabled = false;
  // ctx.clearRect(0, 0, beacon.width, beacon.height);
  // next draw pixelated first one
  const showImg = (target, img) => {
    const w = (img.width /SF) |0;
    const h = (img.height/SF) |0;
    console.log(w,h, w*h);
    ctx.drawImage(img, 0, 0, w, h);
    ctx.drawImage(beacon, 0, 0, w, h, 0, 0, beacon.width, beacon.height)

    const step = d => x => x+(d*x);
    const steps = x => map(step(beacon.width/x), range(0, x));
    const getColors = map(([x, y]) => [x, y, ctx.getImageData(x, y, 1, 1).data])

    const points = getColors(xprod(steps(w), steps(h)));
    // worked out the colors we need
    return points;
  }

  const images = await R.composeP(
    Promise.all.bind(Promise),
    a
  )(R.times(api, pages))

  console.log(images);

  return;

  fetch(`https://api.flickr.com/services/rest?method=flickr.photos.getRecent&format=json&nojsoncallback=1&api_key=51a9f6e2f76d707dfbed602811e9d911&per_page=5&page=${page}`)
    .then(r => {
      if(r.ok) {
        return r.json();
      }
      throw new Error('Network response was not ok.');
    })
    .then(r => {
      const i = r.photos.photo[getRandomInt(0, r.photos.photo.length)];

      fetch(`https://farm${i.farm}.staticflickr.com/${i.server}/${i.id}_${i.secret}_q.jpg`)
        .then(r => {
          if (r.ok) {
            return r.blob()
          }
      throw new Error('Network response was not ok.');
        })
        .then(r => {
          var objectURL = URL.createObjectURL(r);
          var ctx = beacon.getContext("2d");
          ctx.imageSmoothingEnabled =
            ctx.mozImageSmoothingEnabled =
            ctx.msImageSmoothingEnabled =
            ctx.webkitImageSmoothingEnabled = false;
          ctx.clearRect(0, 0, beacon.width, beacon.height);
          const ictx = inspector.getContext("2d");
          ictx.clearRect(0, 0, inspector.width, inspector.height);
          const img = new Image();
          img.onload = () => {
            const w = (img.width /SF) |0;
            const h = (img.height/SF) |0;
            console.log(w,h, w*h);
            ctx.drawImage(img, 0, 0, w, h);
            ctx.drawImage(beacon, 0, 0, w, h, 0, 0, beacon.width, beacon.height)

            const step = d => x => x+(d*x);
            const steps = x => map(step(beacon.width/x), range(0, x));
            const getColors = map(([x, y]) => [x, y, ctx.getImageData(x, y, 1, 1).data])

            const points = getColors(xprod(steps(w), steps(h)));
            // worked out the colors we need

            (points).forEach(e => {
              ctx.fillText(e[2], e[0], e[1]+10);
            });

            ictx.drawImage(img, 0, 0);
            const idata = ictx.getImageData(0,0,img.width,img.height);

            // worked out the average of an image
            const t = data =>
              compose(
                map(x => x/(data.length/4)|0),
                reduce(zipWith(add), [0, 0, 0, 0]),
                splitEvery(4)
              )(data);

            const rgba = t(idata.data);

            document.body.style.backgroundColor = 'rgba(' + rgba.join(', ') + ')';
          };
          img.src = imag.src = objectURL;

        }).catch(e => {
          console.log('There has been a problem with your fetch operation: ' + e.message);
        });

    });
});
