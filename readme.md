
# An unimaginatively titled experiment

[tldr; its lives here](https://notmodified.github.io/mosaic-experiment/)

This one started out as an excuse to play with a couple of things I wanted to add to my toolbox [canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) and [ramda](http://ramdajs.com/).

Things progressed from there with [web workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), [most](https://github.com/cujojs/most) and [mithril](https://mithril.js.org/) getting involved and even [immutable](https://facebook.github.io/immutable-js/) popping its head in.

All these bits have led to the inevitable mess that arises when you try things out for the first time. Many lessons learned and assumptions disproven.. for science.

[The result](https://notmodified.github.io/mosaic-experiment/) seems to mostly function in chrome and even slowly on edge. I haven't dared fire it up on a mobile and I wouldn't fancy its chances in safari but you never know.

## to run locally
It uses webpack dev server so a `yarn` then `yarn start` will have something running at http://localhost:8080/webpack-dev-server/index.html

## to build for production
Once you have done a quick `yarn` you should be able to `yarn build`. Assets will all be in dist/.
