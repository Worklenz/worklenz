module.exports = function (grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),
    clean: {
      dist: "build"
    },
    compress: require("./grunt/grunt-compress"),
    copy: {
      main: {
        files: [
          {expand: true, cwd: "src", src: ["public/**"], dest: "build"},
          {expand: true, cwd: "src", src: ["views/**"], dest: "build"},
          {expand: true, cwd: "landing-page-assets", src: ["**"], dest: "build/public/assets"},
          {expand: true, cwd: "src", src: ["shared/sample-data.json"], dest: "build", filter: "isFile"},
          {expand: true, cwd: "src", src: ["shared/templates/**"], dest: "build", filter: "isFile"},
          {expand: true, cwd: "src", src: ["shared/postgresql-error-codes.json"], dest: "build", filter: "isFile"},
        ]
      },
      packages: {
        files: [
          {expand: true, cwd: "", src: [".env"], dest: "build", filter: "isFile"},
          {expand: true, cwd: "", src: [".gitignore"], dest: "build", filter: "isFile"},
          {expand: true, cwd: "", src: ["release"], dest: "build", filter: "isFile"},
          {expand: true, cwd: "", src: ["jest.config.js"], dest: "build", filter: "isFile"},
          {expand: true, cwd: "", src: ["package.json"], dest: "build", filter: "isFile"},
          {expand: true, cwd: "", src: ["package-lock.json"], dest: "build", filter: "isFile"},
          {expand: true, cwd: "", src: ["common_modules/**"], dest: "build"}
        ]
      }
    },
    sync: {
      main: {
        files: [
          {cwd: "src", src: ["views/**", "public/**"], dest: "build/"}, // makes all src relative to cwd
        ],
        verbose: true,
        failOnError: true,
        compareUsing: "md5"
      }
    },
    uglify: {
      all: {
        files: [{
          expand: true,
          cwd: "build",
          src: "**/*.js",
          dest: "build"
        }]
      },
      controllers: {
        files: [{
          expand: true,
          cwd: "build",
          src: "controllers/*.js",
          dest: "build"
        }]
      },
      routes: {
        files: [{
          expand: true,
          cwd: "build",
          src: "routes/**/*.js",
          dest: "build"
        }]
      },
      assets: {
        files: [{
          expand: true,
          cwd: "build",
          src: "public/assets/**/*.js",
          dest: "build"
        }]
      }
    },
    shell: {
      tsc: {
        command: "tsc --build tsconfig.prod.json"
      },
      esbuild: {
        // command: "esbuild `find src -type f -name '*.ts'` --platform=node --minify=false --target=esnext --format=cjs --tsconfig=tsconfig.prod.json --outdir=build"
        command: "node esbuild && node cli/esbuild-patch"
      },
      tsc_dev: {
        command: "tsc --build tsconfig.json"
      },
      swagger: {
        command: "node ./cli/swagger"
      },
      inline_queries: {
        command: "node ./cli/inline-queries"
      }
    },
    watch: {
      scripts: {
        files: ["src/**/*.ts"],
        tasks: ["shell:tsc_dev"],
        options: {
          debounceDelay: 250,
          spawn: false,
        }
      },
      other: {
        files: ["src/**/*.pug", "landing-page-assets/**"],
        tasks: ["sync"]
      }
    }
  });

  grunt.registerTask("clean", ["clean"]);
  grunt.registerTask("copy", ["copy:main"]);
  grunt.registerTask("swagger", ["shell:swagger"]);
  grunt.registerTask("build:tsc", ["shell:tsc"]);
  grunt.registerTask("build", ["clean", "shell:tsc", "copy:main", "compress"]);
  grunt.registerTask("build:es", ["clean", "shell:esbuild", "copy:main", "uglify:assets", "compress"]);
  grunt.registerTask("build:strict", ["clean", "shell:tsc", "copy:packages", "uglify:all", "copy:main", "compress"]);
  grunt.registerTask("dev", ["clean", "copy:main", "shell:tsc_dev", "shell:inline_queries", "watch"]);

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks("grunt-contrib-watch");
  grunt.loadNpmTasks("grunt-contrib-clean");
  grunt.loadNpmTasks("grunt-contrib-copy");
  grunt.loadNpmTasks("grunt-contrib-uglify");
  grunt.loadNpmTasks("grunt-contrib-compress");
  grunt.loadNpmTasks("grunt-shell");
  grunt.loadNpmTasks("grunt-sync");

  // Default task(s).
  grunt.registerTask("default", []);
};
