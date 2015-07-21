# grunt-docbase

> Grunt plugin to generate html files from your docbase project.

## Getting Started
This plugin requires Grunt `~0.4.1`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-docbase --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-docbase');
```

## The "docbase" task

### Overview
In your project's Gruntfile, add a section named `docbase` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  docbase: {
    options: {
    },
    your_target: {
      // Target-specific file lists and/or options go here.
    },
  },
})
```

### Options

#### options.generatePath
Type: `String`
Default value: `html/`

A string value that is used to create the files generated.

#### options.urlToAcess
Type: `String`
Default value: `http://localhost:8080/`

A string value that will be crawled to generate the HTML files.

### Usage Examples

#### Default Options
In this example, the default options are used to do something with whatever. So if the `testing` file has the content `Testing` and the `123` file had the content `1 2 3`, the generated result would be `Testing, 1 2 3.`

```js
grunt.initConfig({
  docbase: {
    options: {
      generatePath: 'html/',
      urlToAcess: 'http://localhost:8080/',
    },
    files: {
      'dest/default_options': ['src/testing', 'src/123'],
    },
  },
})
```


## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
_(Nothing yet)_
