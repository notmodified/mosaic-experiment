import mi from "mithril";
const R = require("ramda");

const mainContain = mi("div", { id: "app" }, [
  mi(
    "div",
    { id: "main" },
    mi("div", { id: "aspect-box" }, mi("canvas", { id: "viewer" }))
  ),
  mi(
    "div",
    { id: "left" },
    mi("div", { class: "controls" }, [
      mi("div", { id: "loading" }),
      mi("input", { type: "text", id: "query", value: "mosaic" }),
      mi("button", { class: "more" }, "more")
    ]),
    mi("div", { id: "image-box" })
  )
]);

export const renderApp = () => {
  mi.render(document.body, mainContain);
};

const classes = (used, current) =>
  R.join(" ", [used ? "used" : "", current ? "current" : ""]);

const spread = num => R.clamp(0, 0.2, num / 100);

const images = {
  view: ({ attrs: { images } }) => {
    if (!images.length) {
      return mi("div", { class: "no-results" }, "no results..");
    }

    return R.map(
      ({ src, used, current }) =>
        mi(
          "div",
          {
            class: classes(used, current),
            "data-used": used,
            style: used
              ? `box-shadow: 0 0 0.3rem ${spread(used)}rem rgba(0, 0, 0, 0.6)`
              : ""
          },
          mi("img", { src })
        ),
      images
    );
  }
};

const loadingOverlay = {
  view: ({ attrs: { n } }) => {
    if (n > 0) {
      return mi("div", { class: "loading__message" }, `${n} left to load`);
    }
  }
};

const emptyOverlay = {
  view: () =>
    mi(
      "div",
      { class: "loading__message loading__message--empty" },
      `Nothing found`
    )
};

export const renderLoading = (root, n) => {
  mi.render(root, mi(loadingOverlay, { n }));
};

export const renderLoadingNoResults = root => {
  mi.render(root, mi(emptyOverlay));
  // almost but not entirely unlike the wrong way to do this
  setTimeout(() => mi.render(root, ""), 1500);
};

export const renderBox = (root, state) => {
  mi.render(
    root,
    mi(images, { images: R.project(["src", "used", "current"], state) })
  );
};
