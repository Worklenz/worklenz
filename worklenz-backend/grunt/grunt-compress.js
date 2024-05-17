module.exports = {
  brotli_js: {
    options: {
      mode: "brotli",
      brotli: {
        mode: 1
      }
    },
    expand: true,
    cwd: "build/public",
    src: ["**/*.js"],
    dest: "build/public",
    extDot: "last",
    ext: ".js.br"
  },
  gzip_js: {
    options: {
      mode: "gzip"
    },
    files: [{
      expand: true,
      cwd: "build/public",
      src: ["**/*.js"],
      dest: "build/public",
      ext: ".js.gz"
    }]
  }
};
